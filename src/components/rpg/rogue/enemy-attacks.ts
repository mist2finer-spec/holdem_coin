import {roundEven} from '../hunt-math';
import {LABYRINTH} from '../hunt-labyrinth';
import {canUseAttack,type MonsterAttack,type ImpactorCommand,type EffectCommand} from '../hunt-actions';
import metadata from '../data/enemy-attack-metadata.json';
import {hash} from './encounters';
export type EnemyStyle='dark'|'poison'|'pillar'|'fire'|'water'|'earth'|'sonic'|'meteor'|'explosion';
export type EnemyPlane='low'|'upper'|'ground'|'column';
export type NativeEnemy={id:number;species:number;room:number;x:number;y:number;hp:number;maxHP:number;radius:number;boss:boolean;state:string;until:number;target:{x:number;y:number};castSkill?:number;castStart?:number;castDuration?:number;castClip?:string;attackMove?:number};
export type EnemyTarget={x:number;y:number;airHeight:number;dodge:boolean;slide:boolean};
export type EnemyHazard={id:number;source:number;species:number;room:number;skill:number;x:number;originX:number;targetX:number;y:number;radius:number;style:EnemyStyle;plane:EnemyPlane;born:number;hitAt:number;expires:number;phase:'warning'|'flight'|'active';direction:number};
type LiveHazard=EnemyHazard&{command:ImpactorCommand;speed:number;tracking:boolean;arrived:boolean;released:boolean;movingHitAt:number;hits:Set<string>;lastX:number};
type EnemyState={entered:number;basics:number;uses:Record<number,number>;ready:Record<number,number>;counts:Record<number,number>;wait:number;serial:number;cast?:{skill:MonsterAttack;start:number;targetX:number;direction:number};};
export const RANGED_SPECIES=[1103,1151,1153,1251,1252,1253,1301,1302,1303,1311,1312,1313,1321,1322,1323] as const;
const raw=metadata.skills as unknown as Record<string,{at:number|null;AssetGuid:string|null;StartOriginRange:number|null;TargetOriginRange:number|null;ArriveHitRange:number|null;ReleaseHitRange:number|null;StartOnGround:number|null;TargetOnGround:number|null;MovingReleaseOnArrive:number|null}[]>;
export function nativeEnemySupported(m:Pick<NativeEnemy,'species'|'boss'>){return m.boss||RANGED_SPECIES.includes(m.species as typeof RANGED_SPECIES[number]);}
export function enemyStyle(species:number,skill:number,area=false):EnemyStyle{
 if([1251,1252,1253].includes(species))return 'sonic';if(species===1103)return skill===2161?'poison':'earth';if(species===1151)return 'dark';if(species===1153)return skill===2211?'pillar':'dark';
 if(species>=1301&&species<=1323){const element=species%10;return area?'explosion':element===2?'water':element===3?'earth':'fire';}return area?'meteor':'fire';
}
/** Source seconds/count domains remain separate. No forced every-third counter for time skills. */
export function nativeSkillReady(skill:MonsterAttack,state:{entered:number;basics:number;ready:Record<number,number>;counts:Record<number,number>},now:number){return skill.cooldownMethod===1?state.basics-(state.counts[skill.id]??0)>=Math.max(1,roundEven(skill.cooldown)):now+1e-8>=(state.ready[skill.id]??state.entered+skill.cooldown);}
export class EnemyAttackSystem{
 private states=new Map<number,EnemyState>();private live:LiveHazard[]=[];private serial=0;private impacts:{id:number;x:number;y:number;room:number;style:EnemyStyle;born:number;radius:number}[]=[];
 constructor(readonly seed:number,readonly cap=128){}
 /** Called before movement. Returns true when native actions own this actor. */
 actor(m:NativeEnemy,target:EnemyTarget,now:number,stageElapsed=now){
  if(!nativeEnemySupported(m))return false;m.attackMove=0;
  if(m.hp<=0)return true;
  let state=this.states.get(m.id);if(!state){state={entered:now,basics:0,uses:{},ready:{},counts:{},wait:now,serial:0};this.states.set(m.id,state);}
  const profile=LABYRINTH.monsters[m.species];if(!profile)return false;
  if(state.cast){const c=state.cast,age=now-c.start;m.state='windup';m.castClip=c.skill.animations.findLast(a=>a.at<=age)?.clip??c.skill.clip;
   if(age+1e-8>=c.skill.duration){state.cast=undefined;m.castSkill=undefined;m.castClip=undefined;m.state='recover';const ai=LABYRINTH.ai[profile.aiType];const jitter=hash(this.seed^m.id^state.serial)/4294967296;state.wait=now+(ai?ai.waitMin+(ai.waitMax-ai.waitMin)*jitter:profile.recovery);m.until=state.wait;}return true;
  }
  const distance=Math.abs(target.x-m.x),skills=profile.skills.map(id=>LABYRINTH.actions[id]).filter((a):a is MonsterAttack=>!!a&&a.mp===0&&canUseAttack(a,m.hp/m.maxHP*100,stageElapsed,state!.uses)&&a.commands.some(c=>c.condition.Condition===0&&c.effects.some(e=>e.target===2&&e.type===1&&e.value>0)));
  const basic=skills.find(a=>!!(a.tag&128))??skills[0];
  if(!basic){m.state='idle';return false;}
  if(now<state.wait){m.state='recover';return true;}
  const ready=skills.filter(a=>nativeSkillReady(a,state!,now)&&(!(a.tag&1)||m.hp/m.maxHP<.7));
  ready.sort((a,b)=>Number(!!(a.tag&128))-Number(!!(b.tag&128))||Number(!!(b.tag&64))-Number(!!(a.tag&64)));
  const attack=ready.find(a=>distance<=a.range+m.radius+12);
  if(!attack){m.state=distance<=basic.range+m.radius+12?'idle':'walk';m.attackMove=m.state==='walk'?Math.sign(target.x-m.x):0;return true;}
  const min=LABYRINTH.ai[profile.aiType]?.min??0;
  if(distance<Math.min(min,attack.range*.55)&&attack.range>=200&&m.species!==1251){m.state='walk';m.attackMove=-Math.sign(target.x-m.x);return true;}
  const direction=Math.sign(target.x-m.x)||1;state.cast={skill:attack,start:now,targetX:target.x,direction};state.serial++;state.uses[attack.id]=(state.uses[attack.id]??0)+1;
  if(attack.tag&128)state.basics++;state.ready[attack.id]=now+attack.cooldown;state.counts[attack.id]=state.basics;
  m.state='windup';m.until=now+attack.duration;m.castSkill=attack.id;m.castStart=now;m.castDuration=attack.duration;m.castClip=attack.clip;m.target={x:target.x,y:target.y};
  this.schedule(m,attack,target,now,direction,state.serial);return true;
 }
 private schedule(m:NativeEnemy,a:MonsterAttack,target:EnemyTarget,now:number,direction:number,castSerial:number){
  for(const [ci,c] of a.commands.entries()){
   if(c.condition.Condition!==0||!c.effects.some(e=>e.target===2&&e.type===1&&e.value>0))continue;
   const extra=raw[a.id]?.find(r=>r.at!==null&&Math.abs(r.at-c.at)<1e-4),fall=c.startOrigin===4,area=fall||c.speed===0&&!(a.tag&128),originRange=(extra?.StartOriginRange??0)*50;
   for(let n=0;n<Math.min(64,c.count)&&this.live.length<this.cap;n++){
    const scatter=fall?((hash(this.seed^m.id^Math.imul(castSerial+ci+1,8191)^n)%10000)/10000-.5)*Math.min(originRange,180):0;
    const x=fall||c.startOrigin===2||c.startOrigin===5?target.x+scatter:m.x+direction*m.radius;
    const destination=fall?x:c.targetOrigin===11||c.targetOrigin===1?x+direction*Math.max(a.range,350):target.x;
    const born=now+c.at+n*c.interval,travel=fall?.35:c.speed>0?Math.abs(destination-x)/c.speed:0;
    const style=enemyStyle(m.species,a.id,area),plane:EnemyPlane=fall?'column':style==='sonic'?'upper':area?'ground':'low';
    const h:LiveHazard={id:++this.serial,source:m.id,species:m.species,room:m.room,skill:a.id,x,originX:x,targetX:destination,y:m.y,radius:Math.max(6,c.width/2,c.arrive?(extra?.ArriveHitRange??0)*50:0,c.release?(extra?.ReleaseHitRange??0)*50:0),style,plane,born:area?now:born,hitAt:born+(fall?travel:0),expires:born+travel+(c.duration>0?Math.min(c.duration,30):.12),phase:area?'warning':'flight',direction,command:c,speed:fall?0:c.speed,tracking:c.tracking,arrived:false,released:false,movingHitAt:-Infinity,hits:new Set(),lastX:x};
    // Rain placement and vertical travel are explicit side-view adapters; preserve native count/interval/arrival width.
    if(area&&c.duration>0)h.expires=born+c.duration;
    this.live.push(h);
   }
  }
 }
 advance(now:number,dt:number,actors:readonly NativeEnemy[],hero:EnemyTarget,room:number,onEffect:(actor:NativeEnemy,effect:EffectCommand,h:EnemyHazard)=>void){
  const alive=new Map(actors.filter(a=>a.hp>0&&a.room===room).map(a=>[a.id,a]));for(const id of this.states.keys())if(!alive.has(id))this.states.delete(id);
  this.impacts=this.impacts.filter(i=>i.room===room&&now-i.born<.65);this.live=this.live.filter(h=>alive.has(h.source)&&h.room===room);
  for(const h of this.live){const source=alive.get(h.source)!;if(now<h.hitAt&&h.phase==='warning')continue;if(now<h.born)continue;
   h.lastX=h.x;if(h.tracking){if(h.speed===0){h.x=h.targetX=hero.x;}else h.targetX=hero.x;}
   if(h.speed>0){const delta=h.targetX-h.x;h.x+=Math.sign(delta)*Math.min(Math.abs(delta),h.speed*dt);}
   const arrived=h.speed===0||Math.abs(h.targetX-h.x)<.001;h.phase=h.speed>0&&!arrived?'flight':'active';
   const contact=hero.x+12>=Math.min(h.lastX,h.x)-h.radius&&hero.x-12<=Math.max(h.lastX,h.x)+h.radius;
   const avoid=hero.dodge||h.plane==='upper'&&hero.slide||h.plane==='low'&&hero.airHeight>24;
   const apply=(phase:string)=>{if(!contact||avoid)return;const effects=h.command.effects.filter(e=>e.phase===phase&&e.target===2);for(const e of effects){const key=h.command.unique?`hero:${e.type}`:`hero:${phase}:${e.type}`;if(h.hits.has(key)&&!(phase==='Moving'&&h.command.repeat>0&&now-h.movingHitAt>=h.command.repeat))continue;h.hits.add(key);onEffect(source,e,h);}if(effects.length&&phase==='Moving')h.movingHitAt=now;};
   if(h.command.moving)apply('Moving');
   if(arrived&&!h.arrived){h.arrived=true;if(h.command.arrive)apply('Arrive');this.impacts.push({id:h.id,x:h.x,y:h.y,room:h.room,style:h.style,born:now,radius:h.radius});if(h.speed>0)h.expires=Math.min(h.expires,now+.05);}
   if(now>=h.expires&&!h.released){h.released=true;if(h.command.release)apply('Release');}
  }
  this.live=this.live.filter(h=>now<h.expires);if(this.impacts.length>96)this.impacts=this.impacts.slice(-96);
 }
 view(now:number){return {hazards:this.live.filter(h=>h.phase==='warning'||now>=h.born).map(({command,hits,lastX,speed,tracking,arrived,released,movingHitAt,...h})=>({...h})),impacts:this.impacts.map(x=>({...x}))};}
 clear(){this.states.clear();this.live=[];this.impacts=[];}
}
