import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import type {RpgStore} from './rpg-store';
import type {RpgItemsStore} from './rpg-items';
import {sqliteAtomic} from './rpg-sqlite';
import {RogueService,isRogueAction,type RogueAction} from './rpg-rogue-service';
import {heroStats} from '../components/rpg/hunt-progression';
import {compileBuild} from '../components/rpg/hunt-build';
import {creditHybridRewards,initializeHybridProgress} from './rpg-hybrid-profile';
import {dungeonEncounter,zoneRewardBudget,HYBRID_BALANCE} from '../components/rpg/hybrid-balance';
import {generateRogueMap,roomGates} from '../components/rpg/rogue/map';
import core from './generated/rogue-stage-kernel.json';

export const STAGE_PROTOCOL='island-stage-v1';
const DAY=86400000,MAX_SECONDS=DAY/1000;
type Run={account:string;request_id:string;run_id:string;seed:number;difficulty:number;room:number;ticket:string;elapsed:number;kills:number;gold:number;xp:number;visited:string;status:string;expires_at:number;start_response:Uint8Array};
export type StageClaim={runId:string;ticket:string;room:number;result:'clear'|'dead';nextRoom:number|null;roomKills:number;totalKills:number;totalGold:number;totalXp:number;elapsed:number};
const packed=(value:unknown)=>deflateSync(Buffer.from(JSON.stringify(value)));
const unpack=(value:Uint8Array)=>JSON.parse(inflateSync(value).toString('utf8'));
const token=()=>randomBytes(16).toString('hex');
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export class StageService {
 constructor(readonly store:RpgStore,readonly items?:RpgItemsStore,readonly now=()=>Date.now(),readonly seed=()=>randomBytes(4).readUInt32LE()){
  if(items&&items.db!==store.db)throw Error('Stage rewards require shared game storage');
  store.db.exec(`CREATE TABLE IF NOT EXISTS rpg_stage_runs(account TEXT PRIMARY KEY,request_id TEXT NOT NULL,run_id TEXT NOT NULL,seed INTEGER NOT NULL,difficulty INTEGER NOT NULL,room INTEGER NOT NULL,ticket TEXT NOT NULL,elapsed REAL NOT NULL,kills INTEGER NOT NULL,gold INTEGER NOT NULL,xp INTEGER NOT NULL,visited TEXT NOT NULL,status TEXT NOT NULL,expires_at INTEGER NOT NULL,start_response BLOB NOT NULL);
   CREATE TABLE IF NOT EXISTS rpg_stage_receipts(account TEXT NOT NULL,run_id TEXT NOT NULL,ticket TEXT NOT NULL,digest TEXT NOT NULL,response BLOB NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(account,run_id,ticket));
   CREATE TABLE IF NOT EXISTS rpg_stage_actions(account TEXT NOT NULL,request_id TEXT NOT NULL,digest TEXT NOT NULL,response BLOB NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(account,request_id));`);
 }
 private profile(account:string,action?:RogueAction){
  // An isolated, paused legacy session reuses existing inventory/build transactions, never AI/ticks.
  const bridge=new RogueService(()=>0,()=>7,this.store,this.items,true,this.now);let view=bridge.start(account,'hong');
  if(action)view=bridge.command(account,view.id,1,{x:0,y:0,auto:false,paused:true},action);
  const revision=this.store.load(account).revision;
  return {metadata:{progress:view.progress,development:view.development,growth:view.growth,build:view.build,buildRevision:revision,loot:view.loot},combat:{progress:view.progress,build:view.progress.build!,growth:heroStats(view.progress),compiled:compileBuild(view.progress.build),transcended:this.items?.view(account).transcended??{}}};
 }
 private current(account:string){return this.store.db.prepare('SELECT * FROM rpg_stage_runs WHERE account=?').get(account) as unknown as Run|undefined;}
 private ticket(run:Pick<Run,'run_id'|'ticket'|'room'|'difficulty'|'kills'|'gold'|'xp'|'expires_at'>,terms?:{reward:{gold:number;xp:number};expectedKills:number}){return {runId:run.run_id,ticket:run.ticket,room:run.room,difficulty:run.difficulty,expectedKills:terms?.expectedKills??dungeonEncounter(run.difficulty).max,reward:terms?.reward??zoneRewardBudget(run.difficulty),settled:{kills:run.kills,gold:run.gold,xp:run.xp},expiresAt:run.expires_at};}
 start(account:string,requestId:string,kernel:string){
  if(!/^[a-f0-9]{32}$/.test(requestId))throw Error('잘못된 입장 요청입니다.');
  if(kernel!==core.sha256)throw Error('전투 규칙 버전이 다릅니다. 최신 테스트 앱을 설치해 주세요.');
  return sqliteAtomic(this.store.db,()=>{
   const old=this.current(account);if(old?.request_id===requestId)return unpack(old.start_response);
   const now=this.now(),profile=this.profile(account),difficulty=profile.metadata.progress.hybrid?.dungeonLevel??1;
   const run:Run={account,request_id:requestId,run_id:randomUUID(),seed:this.seed(),difficulty,room:0,ticket:token(),elapsed:0,kills:0,gold:0,xp:0,visited:'[]',status:'playing',expires_at:now+DAY,start_response:new Uint8Array()};
   const response={protocol:STAGE_PROTOCOL,kernel:core.sha256,seed:run.seed,stage:this.ticket(run),...profile};run.start_response=packed(response);
   this.store.db.prepare('INSERT OR REPLACE INTO rpg_stage_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(account,requestId,run.run_id,run.seed,difficulty,0,run.ticket,0,0,0,0,'[]','playing',run.expires_at,run.start_response);
   // Retain all receipts for the active run; older runs cannot become active again.
   this.store.db.prepare('DELETE FROM rpg_stage_receipts WHERE account=? AND run_id<>?').run(account,run.run_id);
   return response;
  });
 }
 settle(account:string,raw:unknown){
  const c=raw as StageClaim;
  if(!c||typeof c.runId!=='string'||c.runId.length>64||typeof c.ticket!=='string'||!/^[a-f0-9]{32}$/.test(c.ticket)||!integer(c.room,0,9)||!['clear','dead'].includes(c.result)||!(c.nextRoom===null||integer(c.nextRoom,0,9))||!integer(c.roomKills,0,200)||![c.totalKills,c.totalGold,c.totalXp].every(n=>integer(n))||typeof c.elapsed!=='number'||!Number.isFinite(c.elapsed)||c.elapsed<0||c.elapsed>MAX_SECONDS)throw Error('잘못된 구역 결과입니다.');
  // Canonical claim excludes arbitrary wallet/XP fields: only the fixed server budget can be credited.
  const claim:StageClaim={runId:c.runId,ticket:c.ticket,room:c.room,result:c.result,nextRoom:c.nextRoom,roomKills:c.roomKills,totalKills:c.totalKills,totalGold:c.totalGold,totalXp:c.totalXp,elapsed:c.elapsed};
  const digest=createHash('sha256').update(JSON.stringify(claim)).digest('hex');
  return sqliteAtomic(this.store.db,()=>{
   const receipt=this.store.db.prepare('SELECT digest,response FROM rpg_stage_receipts WHERE account=? AND run_id=? AND ticket=?').get(account,c.runId,c.ticket) as {digest:string;response:Uint8Array}|undefined;
   if(receipt){if(receipt.digest!==digest)throw Error('이미 확정된 구역 결과와 다릅니다.');return unpack(receipt.response);}
   const run=this.current(account);if(!run||run.run_id!==c.runId||run.ticket!==c.ticket||run.room!==c.room||run.status!=='playing')throw Error('다른 구역이거나 종료된 사냥입니다. 다시 입장해 주세요.');
   if(this.now()>run.expires_at)throw Error('사냥 결과 저장 기한이 지났습니다. 다시 입장해 주세요.');
   const terms=unpack(run.start_response).stage as {expectedKills:number;reward:{gold:number;xp:number}},target=terms.expectedKills,budget=terms.reward,visited=JSON.parse(run.visited) as number[];
   if(c.elapsed<run.elapsed||c.totalKills!==run.kills+c.roomKills||c.totalGold!==run.gold+Math.floor(c.roomKills*budget.gold/target)||c.totalXp!==run.xp+Math.floor(c.roomKills*budget.xp/target)||visited.includes(c.room))throw Error('구역 합계가 일치하지 않습니다.');
   if(c.result==='clear'){
    if(c.roomKills!==target)throw Error('구역 처치 합계가 일치하지 않습니다.');
    if(c.room===9?c.nextRoom!==null:!roomGates(generateRogueMap(run.seed),c.room).some(g=>g.nextRoom===c.nextRoom))throw Error('이동할 수 없는 다음 구역입니다.');
   }else if(c.nextRoom!==null)throw Error('실패한 사냥에서 구역을 이동할 수 없습니다.');
   const saved=this.store.load(account),progress=saved.progress;let awarded={xp:0,gold:0,levels:0,xpCapped:false,goldCapped:false};
   if(c.result==='clear'){
    awarded=creditHybridRewards(progress,budget,this.now());progress.kills=Math.min(1e12,progress.kills+target);
    if(c.room===9){const h=initializeHybridProgress(progress,this.now());if(h.dungeonLevel===run.difficulty)h.dungeonLevel=Math.min(HYBRID_BALANCE.maxDifficulty,h.dungeonLevel+1);this.items?.awardDungeonBossFirst(account,run.difficulty);}
    this.store.save(account,progress,saved.revision);visited.push(c.room);
   }
   const terminal=c.result==='dead'||c.room===9;const next={...run,room:c.nextRoom??run.room,ticket:terminal?'':token(),kills:c.totalKills,gold:c.totalGold,xp:c.totalXp,elapsed:c.elapsed,visited:JSON.stringify(visited),status:terminal?(c.result==='dead'?'dead':'won'):'playing'};
   const response={protocol:STAGE_PROTOCOL,kernel:core.sha256,accepted:true,receipt:{runId:c.runId,ticket:c.ticket,room:c.room,result:c.result,award:awarded},stage:terminal?null:this.ticket(next,terms),terminal:terminal?next.status:null,...this.profile(account)};
   this.store.db.prepare('UPDATE rpg_stage_runs SET room=?,ticket=?,kills=?,gold=?,xp=?,elapsed=?,visited=?,status=? WHERE account=?').run(next.room,next.ticket,next.kills,next.gold,next.xp,next.elapsed,next.visited,next.status,account);
   this.store.db.prepare('INSERT INTO rpg_stage_receipts VALUES(?,?,?,?,?,?)').run(account,c.runId,c.ticket,digest,packed(response),this.now());return response;
  });
 }
 action(account:string,requestId:string,runId:string,action:unknown){
  if(!/^[a-f0-9]{32}$/.test(requestId)||!isRogueAction(action)||action==='tick')throw Error('잘못된 성장 요청입니다.');
  const digest=createHash('sha256').update(JSON.stringify([runId,action])).digest('hex');
  return sqliteAtomic(this.store.db,()=>{
   const cached=this.store.db.prepare('SELECT digest,response FROM rpg_stage_actions WHERE account=? AND request_id=?').get(account,requestId) as {digest:string;response:Uint8Array}|undefined;
   if(cached){if(cached.digest!==digest)throw Error('성장 요청 번호가 충돌했습니다.');return unpack(cached.response);}
   const run=this.current(account);if(!run||run.run_id!==runId)throw Error('사냥 세션이 바뀌었습니다. 다시 입장해 주세요.');
   const response={protocol:STAGE_PROTOCOL,kernel:core.sha256,...this.profile(account,action)};
   this.store.db.prepare('INSERT INTO rpg_stage_actions VALUES(?,?,?,?,?)').run(account,requestId,digest,packed(response),this.now());
   this.store.db.prepare('DELETE FROM rpg_stage_actions WHERE account=? AND request_id NOT IN (SELECT request_id FROM rpg_stage_actions WHERE account=? ORDER BY created_at DESC,rowid DESC LIMIT 64)').run(account,account);return response;
  });
 }
}
