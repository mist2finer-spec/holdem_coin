import {randomUUID,createHash} from 'node:crypto';
import type {RpgStore} from './rpg-store';
import type {RpgItemsStore} from './rpg-items';
import {RogueService,isRogueAction,parseRogueInput,type RogueAction} from './rpg-rogue-service';
import {UnityBossEngine,UNITY_BOSS_PROTOCOL,type UnityInput} from './rpg-unity-boss-engine';
type Session={id:string;account:string;game:UnityBossEngine;sequence:number;lastAt:number;pending:number;input:UnityInput;metadata:any;digest:string;response:any;expires:number};
export class UnityBossService {
 private sessions=new Map<string,Session>();
 constructor(private store:RpgStore,private items?:RpgItemsStore,private now=()=>Date.now(),private seed=()=>111){}
 private profile(account:string,action?:RogueAction){const bridge=new RogueService(()=>0,()=>7,this.store,this.items,true,this.now);let view=bridge.start(account,'hong');if(action)view=bridge.command(account,view.id,1,{x:0,y:0,auto:false,paused:true},action);return {progress:view.progress,development:view.development,growth:view.growth,build:view.build,buildRevision:this.store.load(account).revision,compiled:view.compiled};}
 start(account:string){
  const now=this.now();for(const [k,s]of this.sessions)if(s.expires<now)this.sessions.delete(k);
  const metadata=this.profile(account),game=new UnityBossEngine(this.seed());game.skillEnabled=metadata.build.skills.map((s:any)=>!!s.enabled&&!!s.activeId&&!s.trigger);
  const s:Session={id:randomUUID(),account,game,sequence:0,lastAt:now,pending:0,input:{x:0,y:0,auto:true},metadata,digest:'',response:null,expires:now+30*60*1000};this.sessions.set(account,s);s.response=this.snapshot(s,true);return s.response;
 }
 command(account:string,id:string,sequence:number,raw:unknown,action:unknown='tick',knownBuildRevision?:number){
  if(!isRogueAction(action))throw Error('�߸��� �����Դϴ�.');const input=parseRogueInput(raw);
  const s=this.sessions.get(account);if(!s||s.id!==id||s.expires<this.now())throw Error('��� ������ �ٲ�����ϴ�. �ٽ� ������ �ּ���.');
  if(!Number.isSafeInteger(sequence)||sequence<1)throw Error('���� ������ �ùٸ��� �ʽ��ϴ�.');
  const digest=createHash('sha256').update(JSON.stringify({sequence,input,action,knownBuildRevision})).digest('hex');
  if(sequence===s.sequence){if(digest!==s.digest)throw Error('���� ���� ��ȣ�� ������ �ٸ��ϴ�.');return s.response;}
  if(sequence!==s.sequence+1)throw Error('���� ������ �ùٸ��� �ʽ��ϴ�.');
  const now=this.now(),delta=Math.max(0,(now-s.lastAt)/1000);s.lastAt=now;
  // A suspended/disconnected app resumes safely. It cannot advance arbitrary offline combat time.
  s.pending+=Math.min(delta,.5);
  while(s.pending+.0000001>=.02){s.game.step(.02,s.input);s.pending-=.02;}
  s.input=input;s.game.paused=!!input.paused;
  if(action==='tick')s.game.command(input);else {s.metadata=this.profile(account,action);s.game.skillEnabled=s.metadata.build.skills.map((v:any)=>!!v.enabled&&!!v.activeId&&!v.trigger);}
  s.sequence=sequence;s.digest=digest;s.expires=now+30*60*1000;s.response=this.snapshot(s,knownBuildRevision!==s.metadata.buildRevision);return s.response;
 }
 private snapshot(s:Session,full:boolean){
  const m=s.metadata;const metadata=full?m:{...m,compiled:undefined,build:{...m.build,tree:undefined},progress:{...m.progress,equipment:undefined,gemCollection:undefined,gacha:undefined,legacyBuild:undefined}};
  return {id:s.id,sequence:s.sequence,...s.game.view(),...metadata,...(full?{map:s.game.map}:{})};
 }
}
