import {heroStats,newHuntProgress,type HuntProgress} from '../hunt-progression';
import {TRANSCEND_OUTCOMES,type TranscendOutcome} from '../transcendence';
import {MANA,POTIONS,type PotionKind} from './resources';
import {big,damageBig,attachVitals,hurtBig,healBig,amountLabel,type BigSource,type BigVitals} from '../combat-big';
import {HORDE,SPAWN_SAFETY,spawnLanes,THEME_SPECIES,createWave,waveInterval,hash,CrowdIndex,type HordeWave,type HordeTuning} from './encounters';
import {ROGUE_PACE,rogueAttackTiming} from './pace';
import {newBuild,compileSkill,passiveBuild,basicBuild,type BuildState} from '../hunt-build';
import {generateRogueMap,roomGates,routeFrom,moveOnMap,walkable,lineClear,tileCenter,ROGUE_TILE,type Point,type RogueMap,type RogueGate} from './map';
import {TRAVERSAL,traversalLeg,traversalDuration,sampleTraversal,type TraversalLeg} from './traversal';
import {LABYRINTH} from '../hunt-labyrinth';
export const ROGUE_SPECIES=[1001,1002,1003,1101,1102,1152,1153,1201,1301] as const;
export const ROGUE_LABELS:Record<number,string>={1001:'불 슬라임',1002:'물 슬라임',1003:'숲 슬라임',1051:'오염체',1101:'정찰 고블린',1102:'검 고블린',1103:'주술 고블린',1152:'창 해골',1153:'마법 해골',1301:'불의 정령',1201:'별거미',1031:'슬라임 군주'};
export type RogueInput={potion?:PotionKind;paused?:boolean;branch?:'upper'|'lower';x:number;y:number;auto:boolean;attack?:boolean;skill?:number;jump?:boolean;dodge?:boolean;slide?:boolean};
export type RogueMob=Point&{id:number;room:number;species:number;hp:number;maxHP:number;bigHP?:string;bigMaxHP?:string;radius:number;state:'idle'|'walk'|'windup'|'recover'|'dead';until:number;hitUntil:number;target:Point;boss:boolean;born:number};
export type RogueFx=Point&{id:number;kind:'slash'|'rift'|'dash'|'heal'|'damage'|'gold';born:number;angle:number;room?:number;scale?:number;value?:number|string;target?:'hero'|'mob'};
export type RogueMotion={kind:'attack'|'jump'|'dodge'|'slide'|'skill'|'rush';start:number;duration:number;hitAt:number;done:boolean;from:Point;to:Point;skill?:number;targetId?:number;basic?:ReturnType<typeof basicBuild>;build?:ReturnType<typeof compileSkill>;pulse?:number;gateId?:number;legs?:TraversalLeg[]};
export type RogueSnapshot={defense:{shield:string;maxShield:string;shieldPercent:number;chaosImmune:boolean;guard:number};resources:{mana:number;maxMana:number;costs:readonly number[];potions:Record<PotionKind,number>;potionCooldowns:Record<PotionKind,number>};paused:boolean;wave:HordeWave;choices:(RogueGate&{ready:boolean;near:boolean})[];route:number[];elapsed:number;hero:Point&{elevation:number;airHeight:number;hp:number;maxHP:number;bigHP?:string;bigMaxHP?:string;action:string;serial:number;facing:number;direction:Point;motion:RogueMotion|null;hitUntil:number};mobs:RogueMob[];visited:number[];cleared:number[];room:number;status:'playing'|'dead'|'won';kills:number;gold:number;cooldowns:number[];pendingSkill:number|null;jumpReady:boolean;dodgeReady:boolean;slideReady:boolean;autoRoom:number;autoOrder:number[];auto:boolean;fx:RogueFx[];phase:'combat'|'exit-ready'|'traversing'|'complete';gate:(RogueGate&{ready:boolean;near:boolean})|null;transitions:number[]};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y);return d?{x:x/d,y:y/d}:{x:1,y:0};};
/** Separate test run. Does not advance Labyrinth stages or write account rewards. */
export class RogueEngine{
 mana:number=MANA.maximum;maxMana:number=MANA.maximum;potions:Record<PotionKind,number>={health:POTIONS.charges,mana:POTIONS.charges};private potionAt:Record<PotionKind,number>={health:0,mana:0};
 build:BuildState=newBuild();transcended:Record<string,TranscendOutcome>={};
 private growthDamage=1;private growthDefense=1;
 private shield:BigVitals=attachVitals({hp:0,maxHP:1},0,1);private shieldEnabled=false;private defenseKey='';private chaosImmune=false;private lastDamage=-100;private guard=big(0);private guardUntil=0;private auraUntil=0;private auraEffect=1;
 private critEvent=0;private hurtEvent=0;private critAt=-100;private hurtAt=-100;private triggerSeen=Array.from({length:6},()=>({crit:0,hurt:0}));private triggerAt=[0,0,0,0,0,0];private rollSerial=0;
 private dots:{mob:number;damage:string;next:number;left:number}[]=[];
 setGrowth(p:HuntProgress){const base=heroStats(newHuntProgress()),now=heroStats(p);this.growthDamage=now.attack/Math.max(1,base.attack);this.growthDefense=now.incomingDamageScale/base.incomingDamageScale;}
 private compiled(slot:number){const c=compileSkill(this.build,slot);for(const key of [`gem:${c.activeId}`,...(this.build.links[slot]??[]).filter(Boolean).map(id=>`gem:${id}`),'gear:axe']){const outcome=this.transcended[key];if(outcome){const m=TRANSCEND_OUTCOMES[outcome];c.effect*=m.damage;c.area*=m.area;c.range=Math.sqrt(c.area);c.mana*=m.mana;}}return c;}
 skillPreview(){return Array.from({length:6},(_,i)=>this.compiled(i));}
 private syncDefense(){const p=passiveBuild(this.build),maxLife=p.maxLifeOne?big(1):this.combatScale.mul(10000*(1+p.life)),maxShield=this.combatScale.mul(10000*p.energyShield),key=`${maxLife}:${maxShield}`;
  this.chaosImmune=p.chaosImmune;const maxMana=MANA.maximum*(1+p.mana);if(this.maxMana!==maxMana){this.mana=this.mana/this.maxMana*maxMana;this.maxMana=maxMana;}if(key===this.defenseKey)return;
  const oldMax=big(this.hero.bigMaxHP!).add(this.shieldEnabled?this.shield.bigMaxHP!:0),oldHP=big(this.hero.bigHP!).add(this.shieldEnabled?this.shield.bigHP!:0),ratio=oldHP.div(oldMax);
  this.hero.bigMaxHP=maxLife.toString();this.hero.bigHP=maxLife.mul(ratio).toString();this.shieldEnabled=maxShield.gt(0);this.shield.bigMaxHP=this.shieldEnabled?maxShield.toString():'1';this.shield.bigHP=this.shieldEnabled?maxShield.mul(ratio).toString():'0';this.defenseKey=key;
 }
 private manaCost(slot:number){return MANA.cost[this.compiled(slot).baseIndex]*this.compiled(slot).mana;}
 private scheduleTrigger(input:RogueInput){if(this.hero.motion)return false;for(let i=0;i<6;i++){const c=this.compiled(i);if(!c.trigger||this.cooldowns[i]>0||this.triggerAt[i]>this.elapsed||!this.afford(i))continue;const event=c.trigger==='timed'||c.trigger==='crit'&&this.elapsed-this.critAt<.8&&this.triggerSeen[i].crit<this.critEvent||c.trigger==='hurt'&&this.elapsed-this.hurtAt<.8&&this.triggerSeen[i].hurt<this.hurtEvent;
   if(!event)continue;this.triggerSeen[i]={crit:this.critEvent,hurt:this.hurtEvent};this.triggerAt[i]=this.elapsed+c.triggerInterval;return this.command({...input,skill:i},true,true);
  }return false;
 }
 /** Public for deterministic damage tests; only server logic calls this in production. */
 receiveDamage(amount:BigSource,element='physical'){this.syncDefense();if(this.chaosImmune&&element==='chaos')return big(0);let damage=big(amount);if(damage.lte(0))return big(0);const defense=passiveBuild(this.build);if(hash(this.map.seed+ ++this.rollSerial)%10000<defense.block*10000)return big(0);if(element!=='physical'&&element!=='chaos'&&hash(this.map.seed+ ++this.rollSerial)%10000<defense.suppression*10000)damage=damage.mul(.5);let applied=big(0);this.lastDamage=this.elapsed;
  if(this.elapsed<this.guardUntil&&this.guard.gt(0)){const used=this.guard.lt(damage)?this.guard:damage;this.guard=this.guard.sub(used);damage=damage.sub(used);applied=applied.add(used);}
  if(this.shieldEnabled&&element!=='chaos'){const used=hurtBig(this.shield,damage).applied;damage=damage.sub(used);applied=applied.add(used);}
  if(damage.gt(0))applied=applied.add(hurtBig(this.hero,damage).applied);if(applied.gt(0)){this.hurtEvent++;this.hurtAt=this.elapsed;}return applied;
 }
 readonly map:RogueMap;elapsed=0;hero:RogueSnapshot['hero'];mobs:RogueMob[]=[];visited=new Set<number>([0]);cleared=new Set<number>();room=0;status:RogueSnapshot['status']='playing';kills=0;gold=0;cooldowns=[0,0,0,0,0,0];autoRoom=0;autoOrder:number[]=[];auto=true;paused=false;fx:RogueFx[]=[];transitions:number[]=[];private spawned=new Set<number>();
 private pendingSkill:number|null=null;private jumpAt=0;private dodgeAt=0;private attackAt=0;private combo=0;private fxId=0;private waves=new Map<number,HordeWave>();private mobSerial=0;private hurtReady=0;private crowd=new CrowdIndex<RogueMob>();
 readonly combatScale;
 constructor(seed:number,readonly tuning:HordeTuning=HORDE,scale:BigSource=1){
  this.combatScale=big(scale);if(this.combatScale.lte(0))throw Error('Invalid combat scale');
  if(![tuning.initial,tuning.min,tuning.max,tuning.batch].every(Number.isInteger)||tuning.initial<1||tuning.min<2||tuning.max<tuning.min||tuning.max>300||tuning.initial>tuning.min||tuning.batch<1||!Number.isFinite(tuning.seconds)||tuning.seconds<0)throw Error('Invalid horde tuning');
  this.map=generateRogueMap(seed);this.hero={...this.map.start,elevation:this.map.rooms[0].elevation,airHeight:0,hp:10000,maxHP:10000,action:'stay1',serial:0,facing:1,direction:{x:1,y:0},motion:null,hitUntil:0};
  attachVitals(this.hero,this.combatScale.mul(10000),this.combatScale.mul(10000));this.spawnRoom(0);
 }
 private spawnRoom(id:number){
  if(this.spawned.has(id))return;this.spawned.add(id);const wave=createWave(this.map.seed,id,this.elapsed,this.tuning);this.waves.set(id,wave);
  this.spawnBatch(wave,Math.min(this.tuning.initial,wave.target-(id===9?1:0)));wave.nextAt=this.elapsed+waveInterval(wave,this.tuning);
 }
 private spawnBatch(wave:HordeWave,count:number,boss=false){
  const room=this.map.rooms[wave.room],roster=THEME_SPECIES[room.theme],left=room.x1*ROGUE_TILE+SPAWN_SAFETY.entryRetreat+SPAWN_SAFETY.outerMargin,right=(room.x2+1)*ROGUE_TILE-SPAWN_SAFETY.outerMargin;
  for(let i=0;i<count;i++){
   const ordinal=wave.spawned,random=hash(this.map.seed^Math.imul(wave.room+1,97531)^Math.imul(ordinal+1,197933));
   const species=boss?1031:roster[random%roster.length],radius=boss?22:species===1102||species===1152?15:12;
   const lanes=spawnLanes(left,right,this.hero.x);
   // Room width guarantees a distant nest, even when the hero stands against either boundary.
   const lane=lanes[0];
   if(!lane)throw Error('No safe spawn lane');
   let x=lane.left+(lane.right-lane.left)*((random>>>8)%10000)/10000;
   for(let attempt=0;attempt<40;attempt++){
    if(this.mobs.every(m=>m.hp<=0||m.room!==wave.room||Math.abs(m.x-x)>=SPAWN_SAFETY.spacing))break;
    x=lane.left+(lane.right-lane.left)*(hash(random+attempt+1)%10000)/10000;
   }
   const y=tileCenter(7),hp=boss?4000:[1102,1152,1153,1301].includes(species)?130:100;
   this.mobs.push(attachVitals({id:++this.mobSerial,room:wave.room,species,x,y,hp,maxHP:hp,radius,state:'idle',until:this.elapsed+.2,hitUntil:0,target:{x,y},boss,born:this.elapsed},this.combatScale.mul(hp),this.combatScale.mul(hp)));wave.spawned++;
  }
 }
 private advanceWaves(){
  const w=this.waves.get(this.room)!;if(this.cleared.has(this.room))return;
  const normalTarget=w.target-(this.room===9?1:0);
  if(w.spawned<normalTarget&&this.elapsed+1e-8>=w.nextAt){this.spawnBatch(w,Math.min(this.tuning.batch,normalTarget-w.spawned));w.nextAt+=waveInterval(w,this.tuning);}
  if(this.room===9&&w.spawned===normalTarget&&!w.bossSpawned&&!this.mobs.some(m=>m.room===9&&m.hp>0)){w.bossSpawned=true;this.spawnBatch(w,1,true);}
 }
 /** Combat lanes and traversal barriers stay server-owned, independent of AUTO. */
 private inRoom(p:Point,id=this.room,radius=12){const r=this.map.rooms[id];return p.x>=r.x1*ROGUE_TILE+radius&&p.x<=(r.x2+1)*ROGUE_TILE-radius&&p.y>=r.y1*ROGUE_TILE+radius&&p.y<=(r.y2+1)*ROGUE_TILE-radius;}
 private gateMotion(input:RogueInput){
  const gate=routeFrom(this.map,this.room,input.branch??'upper');if(!gate||!this.cleared.has(this.room)||dist(this.hero,gate.from)>40||input.x<-.1)return false;
  if(gate.kind==='jump'?!input.jump||this.elapsed<this.jumpAt:!input.slide||this.elapsed<this.dodgeAt)return false;
  if(!this.space(gate.to))return false;
  this.hero.direction={x:1,y:0};this.hero.facing=1;
  const points=[{x:this.hero.x,y:this.hero.y,elevation:gate.from.elevation},...gate.ledges,gate.to];
  const legs=points.slice(1).map((to,i)=>({...traversalLeg(points[i],to,gate.kind==='slide',gate.passage==='jump-climb'),hold:i<points.length-2?TRAVERSAL.climbStay:0}));
  this.hero.motion={kind:gate.kind,gateId:gate.id,legs,start:this.elapsed,duration:traversalDuration(legs),hitAt:0,done:true,from:{x:this.hero.x,y:this.hero.y},to:{...gate.to}};
  if(gate.kind==='jump')this.jumpAt=this.elapsed+1.05;else this.dodgeAt=this.elapsed+1.2;
  this.pose(gate.kind==='jump'?'jump1':'sliding1');return true;
 }
 private finishGate(m:RogueMotion){
  const gate=this.map.gates.find(g=>g.id===m.gateId&&g.fromRoom===this.room);
  if(m.gateId!==gate?.id||!gate||!this.cleared.has(this.room)||m.kind!==gate.kind||dist(this.hero,gate.to)>3||!this.space(this.hero)){this.hero.x=m.from.x;this.hero.y=m.from.y;this.hero.elevation=this.map.rooms[this.room].elevation;this.hero.airHeight=0;return;}
  this.hero.elevation=gate.to.elevation;this.hero.airHeight=0;this.transitions.push(gate.id);this.room=gate.nextRoom;this.visited.add(this.room);this.spawnRoom(this.room);
 }

 private pose(action:string){if(this.hero.action!==action){this.hero.action=action;this.hero.serial++;}}
 private space(p:Point,ignore=-1){return walkable(this.map,p.x,p.y)&&this.mobs.every(m=>m.id===ignore||m.hp<=0||dist(p,m)>=12+m.radius-1);}
 private heroMove(dx:number,dy:number,airborne=false,gateId?:number){
  const p=moveOnMap(this.map,this.hero,dx,0);p.y=tileCenter(7);
  const crossing=gateId!==undefined&&this.hero.motion?.gateId===gateId&&this.map.gates[gateId]?.fromRoom===this.room&&this.cleared.has(this.room);
  if(!crossing){const r=this.map.rooms[this.room];p.x=Math.max(r.x1*ROGUE_TILE+12,Math.min((r.x2+1)*ROGUE_TILE-12,p.x));p.y=Math.max(r.y1*ROGUE_TILE+12,Math.min((r.y2+1)*ROGUE_TILE-12,p.y));}
  if(airborne||this.space(p)){this.hero.x=p.x;this.hero.y=p.y;}else{for(const v of [{x:p.x,y:this.hero.y},{x:this.hero.x,y:p.y}])if(this.space(v)){this.hero.x=v.x;this.hero.y=v.y;}}
 }
 private eligible(m:RogueMob){return m.room===this.room;}

 private hit(m:RogueMob,damage:BigSource){
  if(!this.eligible(m)||m.hp<=0)return undefined;const dealt=hurtBig(m,damage).applied;m.hitUntil=this.elapsed+.15;
  this.fx.push({id:++this.fxId,kind:'damage',born:this.elapsed,x:m.x,y:m.y,angle:0,value:amountLabel(dealt),target:'mob',room:m.room});
  if(m.hp===0){m.state='dead';m.until=this.elapsed;this.kills++;this.waves.get(m.room)!.killed++;const reward=m.boss?100:10;this.gold+=reward;
   this.fx.push({id:++this.fxId,kind:'gold',born:this.elapsed,x:m.x,y:m.y,angle:0,value:reward,room:m.room});}
  if(this.fx.length>96)this.fx=this.fx.slice(-96);return dealt;
 }
 private effect(kind:RogueFx['kind'],scale=1){this.fx.push({id:++this.fxId,kind,scale,room:this.room,born:this.elapsed,x:this.hero.x,y:this.hero.y,angle:Math.atan2(this.hero.direction.y,this.hero.direction.x)});}
 private land(m:RogueMotion){if(this.space(this.hero))return;const span=dist(m.from,m.to),steps=Math.max(1,Math.ceil(span/4));for(let i=steps;i>=0;i--){const t=i/steps,p={x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t};if(this.inRoom(p)&&this.space(p)){this.hero.x=p.x;this.hero.y=p.y;return;}}this.hero.x=m.from.x;this.hero.y=m.from.y;}
 private afford(skill:number){return this.mana+1e-8>=this.manaCost(skill);}
 private drink(kind:PotionKind){
  if(this.potions[kind]<=0||this.elapsed+1e-8<this.potionAt[kind])return false;
  if(kind==='health'){if(big(this.hero.bigHP!).gte(this.hero.bigMaxHP!))return false;healBig(this.hero,big(this.hero.bigMaxHP!).mul(POTIONS.healthFraction));this.effect('heal');}
  else {if(this.mana>=this.maxMana-1e-8)return false;this.mana=Math.min(this.maxMana,this.mana+this.maxMana*POTIONS.manaFraction);}
  this.potions[kind]--;this.potionAt[kind]=this.elapsed+POTIONS.cooldown;return true;
 }
 command(input:RogueInput,automated=false,triggered=false){
  this.paused=!!input.paused;if(this.status!=='playing'||this.paused)return false;this.auto=input.auto;this.syncDefense();
  if(input.skill!==undefined&&this.compiled(input.skill).trigger&&!triggered)return false;
  if(input.potion!==undefined){if(!['health','mana'].includes(input.potion)||input.skill!==undefined||input.attack||input.jump||input.slide||input.dodge)return false;return this.drink(input.potion);}
  if([input.jump,input.slide,input.dodge].filter(Boolean).length>1||input.branch!==undefined&&!['upper','lower'].includes(input.branch))return false;
  if(this.hero.motion?.kind==='rush'&&(input.jump||input.slide||input.dodge)){this.hero.motion=null;this.pose('stay1');}
  if(this.hero.motion){if(input.skill!==undefined){this.pendingSkill=input.skill;return true;}return false;}
  if(this.gateMotion(input))return true;
  if(input.skill!==undefined&&(this.cooldowns[input.skill]>0||!this.afford(input.skill))){this.pendingSkill=input.skill;return true;}
  if(input.skill!==undefined&&this.cooldowns[input.skill]<=0){const skill=input.skill;this.mana=Math.max(0,this.mana-this.manaCost(skill));if(!automated||this.pendingSkill===skill)this.pendingSkill=null;const build=this.compiled(skill);this.cooldowns[skill]=[5,8,7,9,6,12][build.baseIndex]*build.cooldown;this.hero.motion={build,pulse:0,kind:'skill',skill,start:this.elapsed,duration:.7+build.repeats*build.repeatDelay,hitAt:.25,done:false,from:{x:this.hero.x,y:this.hero.y},to:{x:this.hero.x,y:this.hero.y}};this.pose(['skill1','skill2','skill3','skill4','skill5','rest1'][build.baseIndex]);return true;}
  if(input.jump&&this.elapsed>=this.jumpAt||(input.dodge||input.slide)&&this.elapsed>=this.dodgeAt){const jump=!!input.jump,dir=Math.abs(input.x)>.1?unit(input.x,0):jump?{x:0,y:0}:this.hero.direction,duration=jump ? .86 : .36,distance=jump?150:120;
   let to=moveOnMap(this.map,this.hero,dir.x*distance,dir.y*distance);const touched=this.mobs.filter(m=>m.hp>0&&dist(m,this.hero)+dist(m,to)<=dist(this.hero,to)+m.radius*2+24);
   if(touched.length>3)to={x:this.hero.x,y:this.hero.y};
   this.hero.motion={kind:jump?'jump':input.slide?'slide':'dodge',start:this.elapsed,duration,hitAt:0,done:true,from:{x:this.hero.x,y:this.hero.y},to};if(jump)this.jumpAt=this.elapsed+1.05;else this.dodgeAt=this.elapsed+1.2;this.pose(jump?'jump1':input.slide?'sliding1':'avoid1');return true;
  }
  if(input.attack)return this.attack();return false;
 }
 private attack(){if(this.elapsed<this.attackAt)return false;const target=this.mobs.filter(m=>m.hp>0&&this.eligible(m)&&dist(m,this.hero)<100*basicBuild(this.build).range+m.radius&&lineClear(this.map,this.hero,m)).sort((a,b)=>dist(a,this.hero)-dist(b,this.hero))[0];
  if(target){this.hero.direction=unit(target.x-this.hero.x,target.y-this.hero.y);if(Math.abs(this.hero.direction.x)>.1)this.hero.facing=Math.sign(this.hero.direction.x);}
  this.combo=(this.combo%5)+1;const timing=rogueAttackTiming(this.combo);this.attackAt=this.elapsed+timing.duration;this.hero.motion={kind:'attack',basic:(()=>{const b=basicBuild(this.build),outcome=this.transcended['gear:axe'];if(outcome){b.effect*=TRANSCEND_OUTCOMES[outcome].damage;b.range*=Math.sqrt(TRANSCEND_OUTCOMES[outcome].area);}return b;})(),start:this.elapsed,...timing,done:false,from:{x:this.hero.x,y:this.hero.y},to:{x:this.hero.x,y:this.hero.y}};this.pose('attack'+this.combo);this.hero.serial++;return true;
 }
 private autoHunt(dt:number,input:RogueInput){
  const gate=routeFrom(this.map,this.room),cleared=this.cleared.has(this.room),healing=this.cooldowns.findIndex((c,i)=>c<=0&&this.afford(i)&&this.compiled(i).heal&&!this.compiled(i).trigger);
  if(cleared&&gate&&dist(this.hero,gate.from)<5){this.gateMotion({...input,[gate.kind]:true,x:1,y:0});if(!this.hero.motion)this.pose('stay1');return;}
  const target=this.mobs.filter(m=>m.hp>0&&this.eligible(m)).sort((a,b)=>dist(a,this.hero)-dist(b,this.hero))[0];
  if(target&&dist(target,this.hero)<100*basicBuild(this.build).range+target.radius&&lineClear(this.map,this.hero,target)){
   if(this.hero.hp<this.hero.maxHP*.6&&healing>=0){this.command({...input,skill:healing},true);return;}
   const skill=this.cooldowns.findIndex((c,i)=>c<=0&&this.afford(i)&&!this.compiled(i).trigger&&!this.compiled(i).heal);if(skill>=0){this.hero.direction=unit(target.x-this.hero.x,target.y-this.hero.y);if(Math.abs(this.hero.direction.x)>.1)this.hero.facing=Math.sign(this.hero.direction.x);this.command({...input,skill},true);return;}
   this.attack();return;
  }
  if(target&&dist(target,this.hero)>=ROGUE_PACE.rushMin&&dist(target,this.hero)<=ROGUE_PACE.rushMax&&lineClear(this.map,this.hero,target)){
   const direction=Math.sign(target.x-this.hero.x),to={x:target.x-direction*ROGUE_PACE.rushStop,y:this.hero.y};
   this.hero.direction={x:direction,y:0};this.hero.facing=direction;this.hero.motion={kind:'rush',targetId:target.id,start:this.elapsed,duration:Math.abs(to.x-this.hero.x)/ROGUE_PACE.rushSpeed,hitAt:0,done:true,from:{x:this.hero.x,y:this.hero.y},to};this.pose('dash');this.effect('dash');return;
  }
  if(!target&&!cleared){if(this.hero.hp<this.hero.maxHP*.6&&healing>=0)this.command({...input,skill:healing},true);else this.pose('stay1');return;}
  const goal=target??(gate?gate.from:this.map.exit),distance=Math.abs(goal.x-this.hero.x);
  if(distance<2){this.pose('stay1');return;}
  const direction={x:Math.sign(goal.x-this.hero.x),y:0},travel=Math.min(distance,ROGUE_PACE.moveSpeed*(1+passiveBuild(this.build).movement)*dt);this.hero.direction=direction;this.hero.facing=direction.x;this.heroMove(direction.x*travel,0);this.pose('run1');
 }
 step(dt:number,input:RogueInput){
  this.paused=!!input.paused;if(this.status!=='playing'||this.paused)return;this.auto=input.auto;dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.025));this.elapsed+=dt;this.syncDefense();const passive=passiveBuild(this.build);this.mana=Math.min(this.maxMana,this.mana+MANA.regen*(1+passive.manaRegen)*dt);
  if(this.shieldEnabled&&this.elapsed-this.lastDamage>=4)healBig(this.shield,big(this.shield.bigMaxHP!).mul(.2*dt));if(passive.regeneration>0)healBig(this.hero,big(this.hero.bigMaxHP!).mul(passive.regeneration*dt));
  for(const dot of this.dots){if(dot.left>0&&this.elapsed>=dot.next){const target=this.mobs.find(e=>e.id===dot.mob&&e.hp>0);if(target)this.hit(target,dot.damage);dot.next+=.5;dot.left--;}}this.dots=this.dots.filter(d=>d.left>0&&this.mobs.some(m=>m.id===d.mob&&m.hp>0));this.cooldowns=this.cooldowns.map(c=>Math.max(0,c-dt));this.fx=this.fx.filter(f=>this.elapsed-f.born<(f.kind==='damage'||f.kind==='gold'?1:.65)).slice(-96);
  this.mobs=this.mobs.filter(m=>m.hp>0||this.elapsed-m.until<.65);this.advanceWaves();
  const m=this.hero.motion;
  if(m){const age=this.elapsed-m.start;
   if(m.kind==='rush'){
    const target=this.mobs.find(e=>e.id===m.targetId&&e.hp>0&&this.eligible(e));
    if(!target||!input.auto||Math.abs(input.x)>.1){this.hero.motion=null;this.pose('stay1');}
    else {const delta=m.to.x-this.hero.x;this.heroMove(Math.sign(delta)*Math.min(Math.abs(delta),ROGUE_PACE.rushSpeed*dt),0);
     if(age>=m.duration||dist(this.hero,target)<=ROGUE_PACE.rushStop){this.hero.motion=null;this.pose('stay1');}}
   }
   if(m.kind==='jump'||m.kind==='dodge'||m.kind==='slide'){
    let t=Math.min(1,age/m.duration),holding=false;
    if(m.gateId!==undefined&&m.legs){
     const p=sampleTraversal(m.legs,age);this.hero.x=p.x;this.hero.y=p.y;this.hero.elevation=p.elevation;this.hero.airHeight=p.airHeight;t=p.progress;holding=p.holding;
    }else{this.heroMove(m.from.x+(m.to.x-m.from.x)*t-this.hero.x,m.from.y+(m.to.y-m.from.y)*t-this.hero.y,true);this.hero.airHeight=m.kind==='jump'?4*100*t*(1-t):0;}
    if(m.kind==='jump')this.pose(holding?'jump5':t<.12?'jump1':t<.35?'jump2':t<.65?'jump3':t<.9?'jump4':'jump5');else if(m.kind==='slide')this.pose(t<.7?'sliding1':'sliding2');
   }
   if(!m.done&&age>=m.hitAt+(m.pulse??0)*(m.build?.repeatDelay??0)){m.pulse=(m.pulse??0)+1;m.done=m.pulse>(m.build?.repeats??0);const slot=m.kind==='skill'?m.skill:undefined,skill=slot===undefined?-1:m.build!.baseIndex;this.effect([0,2,3,4].includes(skill??-1)?'rift':skill===1?'dash':skill===5?'heal':'slash',m.build?.range??m.basic?.range??1);
    const c=m.build;
    if(c?.heal)healBig(this.hero,damageBig(this.combatScale.mul(2500),0,[c.effect]));
    if(c?.guard){this.guard=this.combatScale.mul(10000*c.guard);this.guardUntil=this.elapsed+4*c.duration;}
    if(c?.aura){this.auraEffect=1+c.aura;this.auraUntil=this.elapsed+8*c.duration;}
    if(!c?.heal){let hits=0;const projectile=c?.tags.includes('PROJECTILE'),cap=projectile&&c?(c.projectiles+c.chain+c.pierce):Infinity;
     for(const enemy of this.mobs){if(enemy.hp<=0||!this.eligible(enemy)||!lineClear(this.map,this.hero,enemy)||hits>=cap)continue;const d=dist(enemy,this.hero),dot=((enemy.x-this.hero.x)*this.hero.direction.x+(enemy.y-this.hero.y)*this.hero.direction.y)/(d||1),range=skill===-1?100*(m.basic?.range??1):projectile?300:skill===3?220:skill===1?200:180;
      if(d<=range*(c?.range??1)+enemy.radius&&(skill!==-1&&skill!==1||dot>-.15)){
       const critChance=c?.crit??m.basic?.crit??0,crit=(hash(this.map.seed+ ++this.rollSerial)%10000)/10000<critChance,factor=(skill===-1?m.basic?.effect??1:c?.effect??1)*this.growthDamage*(this.elapsed<this.auraUntil?this.auraEffect:1)*(crit?c?.critMultiplier??m.basic?.critMultiplier??1.5:1),damage=damageBig(this.combatScale.mul(skill===-1?50:skill===3?135:110),0,[factor]);
       const actual=this.hit(enemy,damage);hits++;const leech=c?.leech??m.basic?.leech??0;if(leech&&actual)healBig(this.hero,actual.mul(leech));if(crit&&(!c||c.canTriggerEvents)){this.critEvent++;this.critAt=this.elapsed;}
       if(c?.dot&&enemy.hp>0){const ticks=Math.max(1,Math.ceil(c.dotDuration*2));this.dots.push({mob:enemy.id,damage:damage.mul(c.dot/ticks).toString(),next:this.elapsed+.5,left:ticks});if(this.dots.length>300)this.dots.shift();}
      }
     }
    }
   }
   if(m.kind!=='rush'&&age>=m.duration){if(m.gateId!==undefined)this.finishGate(m);else if(m.kind==='jump'||m.kind==='dodge'||m.kind==='slide')this.land(m);this.hero.motion=null;this.hero.airHeight=0;this.pose('stay1');}
  }else if(this.scheduleTrigger(input)){
  }else if(this.pendingSkill!==null&&this.cooldowns[this.pendingSkill]<=0&&this.afford(this.pendingSkill)){const skill=this.pendingSkill;this.pendingSkill=null;this.command({...input,skill});
  }else{const move=unit(input.x,0),length=Math.min(1,Math.abs(input.x));
   if(length>.1){this.hero.direction=move;if(Math.abs(move.x)>.15)this.hero.facing=Math.sign(move.x);this.heroMove(move.x*ROGUE_PACE.moveSpeed*(1+passive.movement)*length*dt,move.y*ROGUE_PACE.moveSpeed*(1+passive.movement)*length*dt);this.pose('run1');}
   else if(input.attack)this.attack();else if(input.auto)this.autoHunt(dt,input);else this.pose('stay1');
  }
  if(!this.cleared.has(this.room)&&this.waves.get(this.room)!.spawned>=this.waves.get(this.room)!.target&&!this.mobs.some(e=>e.room===this.room&&e.hp>0)){
   this.cleared.add(this.room);this.autoOrder.push(this.room);this.autoRoom=routeFrom(this.map,this.room)?.nextRoom??9;
  }
  const active=this.mobs.filter(e=>e.hp>0&&e.room===this.room);this.crowd.rebuild(active);
  for(const enemy of this.mobs){if(enemy.hp<=0)continue;if(!this.eligible(enemy)){enemy.state='idle';continue;}const d=dist(enemy,this.hero),profile=LABYRINTH.monsters[enemy.species];
   if(enemy.state==='windup'){if(this.elapsed>=enemy.until){enemy.state='recover';enemy.until=this.elapsed+.8;
     if(this.elapsed>=this.hurtReady&&this.hero.motion?.kind!=='dodge'&&this.hero.motion?.kind!=='slide'&&d<enemy.radius+38&&dist(this.hero,enemy.target)<48&&lineClear(this.map,enemy,this.hero)){const damage=this.receiveDamage(damageBig(this.combatScale.mul(enemy.boss?350:65),0,[1-passive.reduction,this.growthDefense]),[1051,1201,1153].includes(enemy.species)?'chaos':enemy.species===1301?'fire':'physical');this.hurtReady=this.elapsed+.4;this.hero.hitUntil=this.elapsed+.15;this.fx.push({id:++this.fxId,kind:'damage',born:this.elapsed,x:this.hero.x,y:this.hero.y,angle:0,value:amountLabel(damage),target:'hero'});}
    }continue;}
   if(this.elapsed<enemy.until)continue;
   if(!this.visited.has(enemy.room)&&d>ROGUE_TILE*5){enemy.state='idle';continue;}
   if(d<enemy.radius+28&&lineClear(this.map,enemy,this.hero)){enemy.state='windup';enemy.until=this.elapsed+Math.max(.35,profile.windup);enemy.target={x:this.hero.x,y:this.hero.y};continue;}
   if(d>ROGUE_TILE*14){enemy.state='idle';continue;}enemy.state='walk';if(this.hero.motion?.kind==='jump'||this.hero.motion?.kind==='dodge'||this.hero.motion?.kind==='slide')continue;
   const goal=this.hero;if(!lineClear(this.map,enemy,goal)){enemy.state='idle';continue;}
   const dir=unit(goal.x-enemy.x,goal.y-enemy.y),speed=enemy.species===1201?90:enemy.species===1101?80:60,p=moveOnMap(this.map,enemy,dir.x*speed*dt,dir.y*speed*dt,enemy.radius);
   if(this.inRoom(p,enemy.room,enemy.radius)&&dist(p,this.hero)>=enemy.radius+12&&this.crowd.nearby(p.x).every(o=>o.id===enemy.id||o.hp<=0||Math.abs(o.x-p.x)>=4)){enemy.x=p.x;enemy.y=tileCenter(7);this.crowd.moved(enemy);}
  }
  if(this.hero.hp<=0){this.status='dead';if(this.hero.motion)this.land(this.hero.motion);this.hero.motion=null;this.hero.airHeight=0;this.hero.elevation=this.map.rooms[this.room].elevation;this.pose('die1');}
  else if(this.room===9&&this.cleared.has(9)&&this.mobs.every(e=>e.hp<=0)&&dist(this.hero,this.map.exit)<ROGUE_TILE){this.status='won';this.hero.motion=null;this.hero.airHeight=0;this.pose('stay1');}
 }
 view():RogueSnapshot{const choices=roomGates(this.map,this.room).map(g=>({...g,ready:this.cleared.has(this.room),near:dist(this.hero,g.from)<=40})),gate=choices.find(g=>g.id===this.hero.motion?.gateId)??choices.find(g=>this.map.rooms[g.nextRoom].branch==='upper')??choices[0];return {defense:{shield:this.shieldEnabled?this.shield.bigHP!:'0',maxShield:this.shieldEnabled?this.shield.bigMaxHP!:'0',shieldPercent:this.shieldEnabled?big(this.shield.bigHP!).div(this.shield.bigMaxHP!).toNumber()*100:0,chaosImmune:this.chaosImmune,guard:this.elapsed<this.guardUntil?this.guard.div(this.combatScale).toNumber():0},resources:{mana:this.mana,maxMana:this.maxMana,costs:MANA.cost.map((_,i)=>this.manaCost(i)),potions:{...this.potions},potionCooldowns:{health:Math.max(0,this.potionAt.health-this.elapsed),mana:Math.max(0,this.potionAt.mana-this.elapsed)}},paused:this.paused,wave:{...this.waves.get(this.room)!},choices,route:[...this.visited],phase:this.status==='won'?'complete':this.hero.motion?.gateId!==undefined?'traversing':this.cleared.has(this.room)?'exit-ready':'combat',gate:gate?{...gate,ready:this.cleared.has(this.room),near:dist(this.hero,gate.from)<=40}:null,transitions:[...this.transitions],elapsed:this.elapsed,hero:{...this.hero,direction:{...this.hero.direction},motion:this.hero.motion?{...this.hero.motion,from:{...this.hero.motion.from},to:{...this.hero.motion.to},legs:this.hero.motion.legs?.map(l=>({...l,from:{...l.from},to:{...l.to}}))}:null},mobs:this.mobs.map(m=>({...m,target:{...m.target}})),visited:[...this.visited],cleared:[...this.cleared],room:this.room,status:this.status,kills:this.kills,gold:this.gold,cooldowns:[...this.cooldowns],pendingSkill:this.pendingSkill,jumpReady:this.elapsed>=this.jumpAt&&!this.hero.motion,dodgeReady:this.elapsed>=this.dodgeAt&&!this.hero.motion,slideReady:this.elapsed>=this.dodgeAt&&!this.hero.motion,autoRoom:this.autoRoom,autoOrder:[...this.autoOrder],auto:this.auto,fx:this.fx.slice(-96).map(f=>({...f}))};}
}
