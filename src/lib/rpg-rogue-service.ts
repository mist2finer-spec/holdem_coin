import {randomBytes,randomUUID} from 'node:crypto';
import {RogueEngine,type RogueInput,type RogueSnapshot} from '../components/rpg/rogue/engine';
import type {RogueMap} from '../components/rpg/rogue/map';
export type RogueView=RogueSnapshot&{id:string;sequence:number;map?:RogueMap};
export function parseRogueInput(raw:unknown):RogueInput{
 if(!raw||typeof raw!=='object')throw Error('Invalid input');const p=raw as Record<string,unknown>;
 if(typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1||Math.abs(p.y)>1||typeof p.auto!=='boolean')throw Error('Invalid direction');
 for(const field of ['attack','jump','dodge'])if(p[field]!==undefined&&typeof p[field]!=='boolean')throw Error('Invalid action');
 if(p.skill!==undefined&&(!Number.isInteger(p.skill)||Number(p.skill)<0||Number(p.skill)>2))throw Error('Invalid skill');
 return {x:p.x,y:p.y,auto:p.auto,attack:p.attack as boolean|undefined,jump:p.jump as boolean|undefined,dodge:p.dodge as boolean|undefined,skill:p.skill as number|undefined};
}
const idle:RogueInput={x:0,y:0,auto:false};
type Session={id:string;game:RogueEngine;last:number;seen:number;input:RogueInput;sequence:number;cached:RogueView};
/** Commands are synchronous and use the existing session sequence/idempotency contract. */
export class RogueService{
 private sessions=new Map<string,Session>();
 constructor(readonly now=()=>performance.now(),readonly seed=()=>randomBytes(4).readUInt32LE()){}
 start(account:string,character:string){
  if(character!=='hong')throw Error('현재 홍만 선택할 수 있습니다.');
  const now=this.now();for(const [id,s] of this.sessions)if(now-s.seen>20*60*1000)this.sessions.delete(id);
  if(!this.sessions.has(account)&&this.sessions.size>=500)throw Error('던전 접속자가 많습니다.');
  const game=new RogueEngine(this.seed()),id=randomUUID(),s:Session={id,game,last:now,seen:now,input:{...idle},sequence:0,cached:null as unknown as RogueView};
  s.cached={...game.view(),id,sequence:0,map:game.map};this.sessions.set(account,s);return s.cached;
 }
 command(account:string,id:string,sequence:number,input:RogueInput){
  const s=this.sessions.get(account);if(!s||s.id!==id)throw Error('던전 세션이 만료됐습니다. 다시 입장해 주세요.');
  if(!Number.isSafeInteger(sequence)||sequence<1)throw Error('Invalid sequence');if(sequence===s.sequence)return s.cached;if(sequence!==s.sequence+1)throw Error('Invalid sequence');
  const now=this.now();let remaining=Math.max(0,Math.min(.25,(now-s.last)/1000));s.last=now;s.seen=now;
  while(remaining>1e-8){const dt=Math.min(.02,remaining);s.game.step(dt,s.input);remaining-=dt;}
  s.input=input;s.game.command(input);s.sequence=sequence;s.cached={...s.game.view(),id:s.id,sequence};return s.cached;
 }
}
