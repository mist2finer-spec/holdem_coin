import {sqliteAtomic} from './rpg-sqlite';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {randomBytes,randomInt} from 'node:crypto';
import path from 'node:path';
import {ACTIVE_CATALOG,GEMS,migrateBuild} from '../components/rpg/hunt-build';
import {ACQUIRABLE_ACTIVE_GEMS,validateGemCollection} from '../components/rpg/idle-gacha';
import {validateEquipmentState,EQUIPMENT_WEAPONS} from '../components/rpg/idle-equipment';
import type {HuntProgress} from '../components/rpg/hunt-progression';
import {JEWELS_BY_ID} from '../components/rpg/jewel-catalog';
import type {JewelInstance} from '../components/rpg/jewel-system';
import {TRANSCEND_OUTCOMES,ITEM_REWARD_POLICY,type TranscendOutcome,type BuildItems} from '../components/rpg/transcendence';
export type {BuildItems} from '../components/rpg/transcendence';
const requestPattern=/^[-a-zA-Z0-9]{16,80}$/;
const DAY=86400000;
function weekStart(now:number){if(!Number.isSafeInteger(now)||now<0)throw Error('잘못된 서버 시간입니다.');return Math.floor((now+3*DAY)/(7*DAY))*7*DAY-3*DAY;}
/** Shared web/poker reward wallet. SQL uniqueness is the authority, never a client winner claim. */
export class RpgItemsStore{
 readonly db:DatabaseSync;private ownsDatabase:boolean;
 constructor(filename:string,shared?:DatabaseSync){this.ownsDatabase=!shared;if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});this.db=shared??new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS rpg_items(account TEXT PRIMARY KEY,orbs INTEGER NOT NULL DEFAULT 5,transcended TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,link TEXT UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_jewels(instance TEXT PRIMARY KEY,account TEXT NOT NULL,jewel TEXT NOT NULL,seed INTEGER NOT NULL,conqueror TEXT);
 CREATE TABLE IF NOT EXISTS rpg_jewel_receipts(id TEXT PRIMARY KEY,account TEXT NOT NULL,jewel TEXT NOT NULL,variant TEXT NOT NULL,instance TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_item_events(id TEXT PRIMARY KEY,account TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS rpg_item_rewards(account TEXT PRIMARY KEY,mileage INTEGER NOT NULL DEFAULT 0,reroll_tickets INTEGER NOT NULL DEFAULT 0,week_start INTEGER NOT NULL DEFAULT 0,weekly_wins INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS rpg_item_requests(id TEXT PRIMARY KEY,account TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL);`);}
 private ensure(account:string){this.db.prepare('INSERT OR IGNORE INTO rpg_items(account,link) VALUES(?,?)').run(account,randomBytes(32).toString('hex'));this.db.prepare('INSERT OR IGNORE INTO rpg_item_rewards(account) VALUES(?)').run(account);}
 private profile(account:string){
  if(!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rpg_players'").get())return undefined;
  const row=this.db.prepare('SELECT progress,revision FROM rpg_players WHERE id=?').get(account) as {progress:string;revision:number}|undefined;
  if(!row)return undefined;return {progress:JSON.parse(row.progress) as HuntProgress,revision:row.revision};
 }
 view(account:string,now=Date.now()):BuildItems{
  this.ensure(account);const row=this.db.prepare('SELECT * FROM rpg_items WHERE account=?').get(account) as {orbs:number;transcended:string;revision:number};
  const reward=this.db.prepare('SELECT * FROM rpg_item_rewards WHERE account=?').get(account) as {mileage:number;reroll_tickets:number;week_start:number;weekly_wins:number},saved=this.profile(account),p=saved?.progress;
  const gemCollection=p?.gemCollection??{version:1 as const,active:saved?{}:Object.fromEntries(ACTIVE_CATALOG.map(g=>[g.id,1])),support:saved?{}:Object.fromEntries(GEMS.map(g=>[g.id,1]))};validateGemCollection(gemCollection);
  if(p?.equipment)validateEquipmentState(p.equipment);
  const ownedWeapons=saved?[...new Set(p?.equipment?.items.filter(i=>i.slot==='weapon').map(i=>i.weaponType!)??[])]:[...EQUIPMENT_WEAPONS],equippedJewelIds=p?.build?migrateBuild(p.build,p.level).jewels?.map(j=>j.instanceId)??[]:[],weeklyWins=reward.week_start===weekStart(now)?reward.weekly_wins:0;
  return {jewels:this.jewels(account),testCollection:!saved,gemCollection:structuredClone(gemCollection),ownedWeapons,equippedJewelIds,mileage:reward.mileage,rerollTickets:reward.reroll_tickets,weeklyWins,weeklyWinsForOrb:ITEM_REWARD_POLICY.weeklyWinsForOrb,weeklyOrbClaimed:weeklyWins>=ITEM_REWARD_POLICY.weeklyWinsForOrb,orbs:row.orbs,transcended:JSON.parse(row.transcended),revision:row.revision,recent:(this.db.prepare('SELECT kind FROM rpg_item_events WHERE account=? ORDER BY created DESC,rowid DESC LIMIT 6').all(account) as {kind:string}[]).map(r=>r.kind)};
 }
 private assertRequest(request:string,revision:number){if(typeof request!=='string'||!requestPattern.test(request)||!Number.isSafeInteger(revision)||revision<0)throw Error('잘못된 보관함 요청입니다.');}
 private replay(account:string,request:string,action:string,target:string){const id=`item:${account}:${request}`,old=this.db.prepare('SELECT action,target FROM rpg_item_requests WHERE id=?').get(id) as {action:string;target:string}|undefined;if(old&&(old.action!==action||old.target!==target))throw Error('같은 요청 번호의 대상을 변경할 수 없습니다.');return !!old;}
 private receipt(account:string,request:string,action:string,target:string){this.db.prepare('INSERT INTO rpg_item_requests VALUES(?,?,?,?)').run(`item:${account}:${request}`,account,action,target);}
 private record(id:string,account:string,kind:string,now=Date.now()){this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,kind,now);}

 link(account:string){this.ensure(account);return (this.db.prepare('SELECT link FROM rpg_items WHERE account=?').get(account) as {link:string}).link;}
 resolve(link:unknown){if(typeof link!=='string'||!/^[a-f0-9]{64}$/.test(link))return null;return (this.db.prepare('SELECT account FROM rpg_items WHERE link=?').get(link) as {account:string}|undefined)?.account??null;}
 private atomic<T>(fn:()=>T){return sqliteAtomic(this.db,fn);}
 awardChampion(tournamentId:string,account:string){return this.atomic(()=>{this.ensure(account);const id=`champion:${tournamentId}`;const exists=this.db.prepare('SELECT account FROM rpg_item_events WHERE id=?').get(id);if(exists)return false;this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,'토너먼트 1위 · 초월석 +1',Date.now());this.db.prepare('UPDATE rpg_items SET orbs=MIN(1000000,orbs+1),revision=revision+1 WHERE account=?').run(account);return true;});}
 transcend(account:string,target:string,request:string,revision:number,roll=()=>randomInt(4)){
  if(typeof target!=='string'||!(/^(gear:(axe|sword|dual|spear))$/.test(target)||[...ACTIVE_CATALOG,...GEMS].some(g=>`gem:${g.id}`===target))||!/^[-a-zA-Z0-9]{16,80}$/.test(request)||!Number.isSafeInteger(revision))throw Error('잘못된 초월 요청입니다.');
  return this.atomic(()=>{const id=`transcend:${account}:${request}`,old=this.db.prepare('SELECT kind FROM rpg_item_events WHERE id=?').get(id);if(old){if(!(old as {kind:string}).kind.startsWith(`${target} · `))throw Error('같은 요청 번호의 대상을 변경할 수 없습니다.');return this.view(account);}
   const v=this.view(account);if(v.revision!==revision)throw Error('다른 창에서 보관함이 변경됐습니다. 다시 열어 주세요.');if(!v.testCollection){const [kind,key]=target.split(':');if(kind==='gem'&&!((v.gemCollection.active[key]??0)+(v.gemCollection.support[key]??0)>0)||kind==='gear'&&!v.ownedWeapons.includes(key as any))throw Error('보유하지 않은 초월 대상입니다.');}if(v.orbs<1)throw Error('초월석이 부족합니다.');if(v.transcended[target])throw Error('이미 초월한 대상입니다.');const n=roll();if(!Number.isInteger(n)||n<0||n>3)throw Error('Invalid roll');const outcome=(Object.keys(TRANSCEND_OUTCOMES) as TranscendOutcome[])[n];v.transcended[target]=outcome;
   this.db.prepare('UPDATE rpg_items SET orbs=orbs-1,transcended=?,revision=revision+1 WHERE account=?').run(JSON.stringify(v.transcended),account);this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,`${target} · ${TRANSCEND_OUTCOMES[outcome].name} 초월`,Date.now());return this.view(account);
  });
 }
 /** Server settlement only: callers establish a real human net-profit winner. */
 awardCashWin(eventId:string,account:string,{flushPlus}:{flushPlus:boolean},now=Date.now()){
  if(typeof eventId!=='string'||eventId.length<1||eventId.length>200||typeof flushPlus!=='boolean')throw Error('잘못된 승리 보상입니다.');const week=weekStart(now);
  return this.atomic(()=>{this.ensure(account);const id=`cashwin:${account}:${eventId}`;if(this.db.prepare('SELECT 1 FROM rpg_item_events WHERE id=?').get(id))return false;
   const r=this.db.prepare('SELECT week_start,weekly_wins FROM rpg_item_rewards WHERE account=?').get(account) as {week_start:number;weekly_wins:number};
   const wins=(r.week_start===week?r.weekly_wins:0)+1,orbId=`cashweek:${account}:${week}`,orb=wins===ITEM_REWARD_POLICY.weeklyWinsForOrb&&!this.db.prepare('SELECT 1 FROM rpg_item_events WHERE id=?').get(orbId)?1:0,tickets=flushPlus?ITEM_REWARD_POLICY.flushPlusRerollTickets:0;
   this.db.prepare('UPDATE rpg_item_rewards SET mileage=MIN(1000000000,mileage+?),reroll_tickets=MIN(1000000,reroll_tickets+?),week_start=?,weekly_wins=? WHERE account=?').run(ITEM_REWARD_POLICY.cashWinMileage,tickets,week,Math.min(1000000000,wins),account);
   this.db.prepare('UPDATE rpg_items SET orbs=MIN(1000000,orbs+?),revision=revision+1 WHERE account=?').run(orb,account);
   if(orb)this.record(orbId,account,'캐시 게임 주간 10승 · 초월석 +1',now);this.record(id,account,`캐시 게임 승리 · 마일리지 +${ITEM_REWARD_POLICY.cashWinMileage}${tickets?' · 플러시 이상 시드 변경권 +1':''}${orb?' · 주간 10승 초월석 +1':''}`,now);return true;
  });
 }
 awardBossFirst(account:string,stage:number){
  if(!Number.isSafeInteger(stage)||stage<0||stage>6000)throw Error('잘못된 보스 단계입니다.');
  return this.atomic(()=>{this.ensure(account);const id=`bossfirst:${account}:${stage}`;if(this.db.prepare('SELECT 1 FROM rpg_item_events WHERE id=?').get(id))return false;this.record(id,account,`보스 ${stage}단계 첫 처치 · 초월석 +1`);this.db.prepare('UPDATE rpg_items SET orbs=MIN(1000000,orbs+1),revision=revision+1 WHERE account=?').run(account);return true;});
 }
 rerollJewel(account:string,instanceId:string,request:string,revision:number,roll=(max:number)=>randomInt(max)){
  this.assertRequest(request,revision);if(typeof instanceId!=='string'||!/^\w{1,64}$/.test(instanceId))throw Error('잘못된 주얼 인스턴스입니다.');
  return this.atomic(()=>{if(this.replay(account,request,'reroll',instanceId))return this.view(account);const v=this.view(account);if(v.revision!==revision)throw Error('다른 창에서 보관함이 변경됐습니다. 다시 열어 주세요.');
   const jewel=v.jewels!.find(j=>j.instanceId===instanceId);if(!jewel||JEWELS_BY_ID.get(jewel.jewelId)?.kind!=='timeless')throw Error('보유한 Timeless 주얼만 시드를 변경할 수 있습니다.');if(v.equippedJewelIds.includes(instanceId))throw Error('장착 중인 주얼은 먼저 해제해 주세요.');if(v.rerollTickets<1)throw Error('시드 변경권이 부족합니다.');
   const draw=roll(9999);if(!Number.isInteger(draw)||draw<0||draw>=9999)throw Error('Invalid roll');const seed=draw+1>=jewel.seed?draw+2:draw+1;
   this.db.prepare('UPDATE rpg_jewels SET seed=? WHERE instance=? AND account=?').run(seed,instanceId,account);this.db.prepare('UPDATE rpg_item_rewards SET reroll_tickets=reroll_tickets-1 WHERE account=?').run(account);this.db.prepare('UPDATE rpg_items SET revision=revision+1 WHERE account=?').run(account);this.receipt(account,request,'reroll',instanceId);this.record(`reroll:${account}:${request}`,account,`${JEWELS_BY_ID.get(jewel.jewelId)!.name} 시드 ${jewel.seed} → ${seed} · 변경권 -1`);return this.view(account);
  });
 }
 redeemMileage(account:string,reward:'gem'|'reroll',request:string,revision:number,roll=(max:number)=>randomInt(max)){
  this.assertRequest(request,revision);if(reward!=='gem'&&reward!=='reroll')throw Error('잘못된 마일리지 교환입니다.');
  return this.atomic(()=>{if(this.replay(account,request,'mileage',reward))return this.view(account);const v=this.view(account);if(v.revision!==revision)throw Error('다른 창에서 보관함이 변경됐습니다. 다시 열어 주세요.');const cost=reward==='gem'?ITEM_REWARD_POLICY.mileagePerGem:ITEM_REWARD_POLICY.mileagePerReroll;if(v.mileage<cost)throw Error('마일리지가 부족합니다.');let label='시드 변경권 +1';
   if(reward==='gem'){
    const saved=this.profile(account);if(!saved?.progress.gemCollection)throw Error('성장 보관함을 먼저 불러와 주세요.');const random=(max:number)=>{const n=roll(max);if(!Number.isInteger(n)||n<0||n>=max)throw Error('Invalid roll');return n;},kind=random(100)<45?'active':'support',pool=kind==='active'?ACQUIRABLE_ACTIVE_GEMS:GEMS,gem=pool[random(pool.length)],collection=structuredClone(saved.progress.gemCollection);collection[kind][gem.id]=(collection[kind][gem.id]??0)+1;validateGemCollection(collection);saved.progress.gemCollection=collection;
    const result=this.db.prepare('UPDATE rpg_players SET progress=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(saved.progress),Date.now(),account,saved.revision);if(result.changes!==1)throw Error('다른 세션에서 진행이 변경됐습니다. 다시 열어 주세요.');label=`${gem.name} 젬 +1`;
   }
   this.db.prepare('UPDATE rpg_item_rewards SET mileage=mileage-?,reroll_tickets=MIN(1000000,reroll_tickets+?) WHERE account=?').run(cost,reward==='reroll'?1:0,account);this.db.prepare('UPDATE rpg_items SET revision=revision+1 WHERE account=?').run(account);this.receipt(account,request,'mileage',reward);this.record(`mileage:${account}:${request}`,account,`마일리지 -${cost} · ${label}`);return this.view(account);
  });
 }
 jewels(account:string):JewelInstance[]{return (this.db.prepare('SELECT instance,jewel,seed,conqueror FROM rpg_jewels WHERE account=? ORDER BY rowid').all(account) as {instance:string;jewel:string;seed:number;conqueror:string|null}[]).map(r=>({instanceId:r.instance,jewelId:r.jewel,seed:r.seed,...(r.conqueror?{conqueror:r.conqueror}:{})}));}
 /** Called inside a synchronous wallet purchase. A duplicate receipt grants and charges nothing. */
 purchaseJewel(account:string,jewelId:string,requestId:string,conqueror?:string){
  const def=JEWELS_BY_ID.get(jewelId);if(!def||typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))throw Error('잘못된 주얼 구매 요청입니다.');
  const variant=conqueror??def.variants?.[0]??'';if(def.variants?!def.variants.includes(variant):variant!=='')throw Error('주얼 변종이 올바르지 않습니다.');
  return this.atomic(()=>{this.ensure(account);const id=`jewel:${account}:${requestId}`,old=this.db.prepare('SELECT jewel,variant FROM rpg_jewel_receipts WHERE id=?').get(id) as {jewel:string;variant:string}|undefined;
   if(old){if(old.jewel!==jewelId||old.variant!==variant)throw Error('같은 구매 번호의 상품을 변경할 수 없습니다.');return false;}
   if(this.jewels(account).length>=200)throw Error('주얼 보관함이 가득 찼습니다. (200개)');
   // Matched Forbidden pair uses the same account seed; ordinary seeds are immutable random values.
   const seed=def.pair?(parseInt(account.slice(0,8),16)||0)%10000+1:randomInt(1,10001),instance=randomBytes(16).toString('hex');
   this.db.prepare('INSERT INTO rpg_jewels VALUES(?,?,?,?,?)').run(instance,account,jewelId,seed,variant||null);
   this.db.prepare('INSERT INTO rpg_jewel_receipts VALUES(?,?,?,?,?)').run(id,account,jewelId,variant,instance);
   this.db.prepare('UPDATE rpg_items SET revision=revision+1 WHERE account=?').run(account);
   this.db.prepare('INSERT INTO rpg_item_events VALUES(?,?,?,?)').run(id,account,`${def.name} 구매`,Date.now());return true;
  });
 }
 jewelReceipt(account:string,requestId:string){return !!this.db.prepare('SELECT 1 FROM rpg_jewel_receipts WHERE id=? AND account=?').get(`jewel:${account}:${requestId}`,account);}
 close(){if(this.ownsDatabase)this.db.close();}
}
