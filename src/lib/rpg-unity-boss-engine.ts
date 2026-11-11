// Unity-only training encounter. The web RogueEngine, economy and its stage kernel stay unchanged.
import {ElementalCombat,elementalVariant,swordAction,elementLineClear} from './rpg-elemental-combat';
import {referenceSkill,skillAim,skillContains} from './rpg-reference-skills';
import {BOSS_CONTACT,hookContact} from './rpg-boss-contact';
import {HERO_CONTACT,heroAttackDefinition,weaponContact} from './rpg-hero-contact';
import {blocksAt,clearLanding,settleLanding} from './rpg-traversal';
import natureMap from './generated/unity-nature-map.json';
export const UNITY_BOSS_PROTOCOL='island-unity-boss-v2';
export type UnityInput={x:number;y:number;auto:boolean;paused?:boolean;attack?:boolean;jump?:boolean;slide?:boolean;dodge?:boolean;skill?:number;potion?:'health'|'mana'};
type Motion={next?:Motion;nextAction?:string;cancelledAttackId?:number;jump?:ReturnType<typeof beginJump>;flightDuration?:number;linkedSupports?:number;variant?:number;skillId?:string;target?:{x:number;y:number};radius?:number;damage?:number;kind:string;start:number;duration:number;hitAt:number;from:{x:number;y:number};to:{x:number;y:number};hits?:number[];done?:number;slot?:number;attackId?:number;hitMask?:number;definitionId?:string;timeline?:any;hitIds?:number[];comboStep?:number};
export type UnityRules={playerHP:number;bossHP:number;slimeCount:number;slimeHP:number;attackDamage:number;comboDuration:number;comboHitTimes:number[];warningSeconds:number;blastDamage:number;blastRadius:number;knockbackSeconds:number};
export const UNITY_BOSS_RULES:Readonly<UnityRules>=Object.freeze({playerHP:1_000_000,bossHP:1_000_000_000,slimeCount:8,slimeHP:120,attackDamage:60,comboDuration:2.2,comboHitTimes:[.85,1.55],warningSeconds:2,blastDamage:10000,blastRadius:120,knockbackSeconds:1.8});
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const LANE_Y=5000,ARENA_X=2670;
const VILLAGE_EXIT_OPEN_SECONDS=.9;
const point=(x:number,y=LANE_Y)=>({x,y});
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const normalized=(x:number,y:number)=>{const n=Math.hypot(x,y);return n>1e-8?{x:x/n,y:y/n}:{x:1,y:0};};
import {cancelAttack,stepAttackCancel} from './rpg-action-cancel';
import {type TraversalProfile,jumpDuration,jumpHeight,actionDistance,beginJump,sampleJump,landJump,JUMP_LANDING_SECONDS} from './rpg-traversal-profile';
export class UnityBossEngine {
 private elemental=new ElementalCombat();
 public bossDefeated=false;private defeatedAt=-1;private exitWaypoint=0;
 public introStage:'none'|'approach'|'reveal'='none';private introAt=0;private introStartX=0;
 public traversal?:TraversalProfile;
 readonly rules:UnityRules;readonly map:any;elapsed=0;room=0;kills=0;status='playing';phase='combat';paused=false;auto=true;
 hero={x:1200,y:LANE_Y,elevation:0,airHeight:0,facing:1,direction:{x:1,y:0},hp:0,maxHP:0,action:'stay1',serial:0,motion:null as Motion|null};
 boss={id:9001,species:9001,unityBoss:true,room:1,x:3500,y:LANE_Y,elevation:0,hp:0,maxHP:0,radius:140,direction:{x:-1,y:0},state:'idle',action:'idle',facing:-1,motion:null as Motion|null};
 slimes:Array<any>=[];fx:Array<any>=[];warning:null|{id:number;attackId:number;x:number;z:number;radius:number;born:number;explodeAt:number}=null;
 skillSupportCounts=Array<number>(6).fill(0);skillIds=Array<string>(6).fill('');cooldowns=[0,0,0,0,0,0];cooldownTotals=[4,4,4,4,4,4];skillEnabled=[false,false,false,false,false,false];
 resources={mana:1000,maxMana:1000,potions:{health:3,mana:3},potionCooldowns:{health:0,mana:0}};
 private bossIdleUntil=0;private bossChaseUntil=0;private attackSerial=0;private heroComboStep=0;private previousHero={x:0,y:0,elevation:0,airHeight:0};
 private dodgeAt=0;private jumpAt=0;private attackAt=0;private bossAt=0;private bossTurn=0;private effectSerial=0;private rollRecoveryUntil=0;
 constructor(seed=111,rules:Partial<UnityRules>={},public readonly arena?:any){
  this.rules={...UNITY_BOSS_RULES,...rules,comboHitTimes:[...(rules.comboHitTimes??UNITY_BOSS_RULES.comboHitTimes)]};this.hero.hp=this.hero.maxHP=this.rules.playerHP;this.boss.hp=this.boss.maxHP=this.rules.bossHP;
  const width=185,height=216;this.map=arena?{seed,unityBossMode:true,zoneTenArena:true,environment:arena.revision,laneY:LANE_Y,zone:9,terrain:arena.terrain,obstacles:arena.obstacles,arena,rooms:[],tiles:[],gates:[],width:0,height:0}:{seed,width,height,unityBossMode:true,environment:'nature-authored-v2',laneY:LANE_Y,
   rooms:[{id:0,x1:22,x2:44,y1:103,y2:105,elevation:0,kind:'slime',branch:'main'},{id:1,x1:55,x2:184,y1:25,y2:215,elevation:0,kind:'boss',branch:'main'}],
   tiles:Array(width*height).fill(0),gates:[],bridge:natureMap.bridge,terrain:{originX:natureMap.originX,originZ:natureMap.originZ,step:natureMap.step,width:natureMap.width,height:natureMap.height,heights:natureMap.heights},obstacles:natureMap.obstacles};
  for(let i=0;i<this.rules.slimeCount;i++)this.slimes.push({id:i+1,species:1003,room:0,x:1500+i*80,y:LANE_Y,elevation:0,hp:this.rules.slimeHP,maxHP:this.rules.slimeHP,radius:16,state:'walk',facing:-1,nextAttack:0});
  if(arena){this.boss.x=arena.boss.x;this.boss.y=arena.boss.y;this.hero.x=arena.entry.x;this.hero.y=arena.entry.y;}
  this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);this.boss.elevation=this.groundAt(this.boss.x,this.boss.y);

 }
 enterArena(staged=false){this.slimes=[];this.room=1;this.phase='boss';this.hero.x=this.boss.x-240;this.hero.y=this.boss.y;this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);this.bossIdleUntil=this.elapsed+.9;this.bossChaseUntil=this.elapsed+2.25;this.bossAt=this.elapsed+2.5;if(staged){this.introStage='approach';this.introAt=this.elapsed;this.hero.x=this.arena?this.arena.entry.x:this.boss.x-600;this.hero.y=this.arena?this.arena.entry.y:this.boss.y;this.introStartX=this.hero.x;this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);this.phase='boss-approach';}}
 private effect(kind:string,x:number,value?:number,extra:any={}){this.fx.push({id:++this.effectSerial,kind,x,room:this.room,born:this.elapsed,value,...extra});if(this.fx.length>48)this.fx.splice(0,this.fx.length-48);}
 get slimeCleared(){return this.slimes.every(m=>m.hp<=0);}
 private bounds(){if(this.arena){const t=this.map.terrain;return {minX:t.originX*100,maxX:(t.originX+(t.width-1)*t.step)*100,minY:LANE_Y+t.originZ*100,maxY:LANE_Y+(t.originZ+(t.height-1)*t.step)*100};}return this.room===1?{minX:ARENA_X,maxX:8700,minY:1200,maxY:10300}:this.slimeCleared?{minX:1100,maxX:8700,minY:LANE_Y,maxY:LANE_Y}:{minX:1100,maxX:2140,minY:LANE_Y,maxY:LANE_Y};}
 private blocked(x:number,y:number,radius=18){return this.outsideArena(x,y,radius)||this.map.obstacles.some((o:any)=>Math.hypot(o.x-x,o.y-y)<o.radius+radius);}
 private heroBlocked(x:number,y:number){if(this.outsideArena(x,y,20))return true;const kind=this.hero.motion?.kind;if(kind==='dodge')return this.traversal?this.blocked(x,y):false;const feet=this.hero.motion?.jump?.worldY??this.groundAt(x,y)+this.hero.airHeight;if(kind==='jump')return this.map.obstacles.some((o:any)=>blocksAt(x,y,feet,o,(a,b)=>this.groundAt(a,b)))||this.room===1&&this.boss.hp>0&&blocksAt(x,y,feet,{...this.boss,bodyHeight:650},(a,b)=>this.groundAt(a,b));return this.blocked(x,y)||this.room===1&&this.boss.hp>0&&Math.hypot(x-this.boss.x,y-this.boss.y)<BOSS_CONTACT.bodyRadius+BOSS_CONTACT.heroRadius;}
 private separateBody(){
  if(this.room!==1||this.boss.hp<=0||this.hero.motion?.kind==='dodge')return;
  const dx=this.hero.x-this.boss.x,dy=this.hero.y-this.boss.y,r=BOSS_CONTACT.bodyRadius+BOSS_CONTACT.heroRadius,d=Math.hypot(dx,dy);if(d>=r)return;
  const angle=d>1e-6?Math.atan2(dy,dx):Math.atan2(-this.boss.direction.y,-this.boss.direction.x),bounds=this.bounds();
  // A radial correction may be outside the arena or inside a tree. Search a bounded ring,
  // preferring the nearest direction, rather than clamping back into the boss cylinder.
  for(let i=0;i<=64;i++){const offset=i===0?0:Math.ceil(i/2)*Math.PI/32*(i%2?1:-1),a=angle+offset;
   const x=this.boss.x+Math.cos(a)*(r+.01),y=this.boss.y+Math.sin(a)*(r+.01);
   if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY||this.blocked(x,y))continue;
   this.hero.x=x;this.hero.y=y;return;
  }
 }

 private moveHero(x:number,y=this.hero.y){
  const b=this.bounds(),px=this.hero.x,py=this.hero.y;
  x=clamp(x,b.minX,b.maxX);y=this.room===1?clamp(y,b.minY,b.maxY):LANE_Y;
  // Small collision substeps keep a dash from tunnelling through authored tree trunks.
  const steps=Math.max(1,Math.ceil(Math.hypot(x-px,y-py)/8));
  for(let i=1;i<=steps;i++){const nx=px+(x-px)*i/steps,ny=py+(y-py)*i/steps;if(!this.heroBlocked(nx,ny)){this.hero.x=nx;this.hero.y=ny;}else if(Math.abs(nx-this.hero.x)>.001&&!this.heroBlocked(nx,this.hero.y))this.hero.x=nx;else if(Math.abs(ny-this.hero.y)>.001&&!this.heroBlocked(this.hero.x,ny))this.hero.y=ny;else break;}
  if(this.arena)return;
  if(this.hero.x>=ARENA_X&&this.slimeCleared){if(this.room!==1){this.bossIdleUntil=this.elapsed+.9;this.bossChaseUntil=this.bossIdleUntil+1.35;this.bossAt=this.bossChaseUntil+.25;}this.room=1;this.phase='boss';}else if(this.slimeCleared)this.phase='bridge';
 }
 private inputDirection(input:UnityInput){let x=clamp(input.x,-1,1),y=this.room===1?clamp(input.y,-1,1):0;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}return {x,y};}
 private faceHero(x:number,y:number){this.hero.direction=normalized(x,y);if(Math.abs(x)>.01)this.hero.facing=Math.sign(x);}
 command(input:UnityInput){
  if(this.status!=='playing'||this.paused||input.paused||this.introStage!=='none'||this.bossDefeated)return false;
  if(input.potion){const k=input.potion;if(this.resources.potions[k]<=0||this.resources.potionCooldowns[k]>0)return false;this.resources.potions[k]--;this.resources.potionCooldowns[k]=5;if(k==='health')this.hero.hp=Math.min(this.hero.maxHP,this.hero.hp+this.hero.maxHP*.3);else this.resources.mana=this.resources.maxMana;return true;}
  const cancelled=cancelAttack(this.hero,input,this.elapsed,()=>this.command(input));if(cancelled!==undefined)return cancelled;
  if(input.jump||input.slide||input.dodge){
   if(input.jump?this.elapsed<this.jumpAt:this.elapsed<this.dodgeAt)return false;
   const inputDir=this.inputDirection(input),dir=Math.hypot(inputDir.x,inputDir.y)>.1?normalized(inputDir.x,inputDir.y):this.room===1?this.hero.direction:{x:this.hero.facing,y:0};const kind=input.jump?'jump':input.slide?'slide':'dodge',duration=input.jump ? (this.traversal?jumpDuration(this.traversal):.86) : .65;
   const b=this.bounds(),distance=this.traversal?actionDistance(this.traversal,kind,duration):input.jump?150:input.slide?200:120;
   this.hero.motion={kind,attackId:++this.attackSerial,definitionId:'hero-'+kind,timeline:{active:[],cancelFrom:1},start:this.elapsed,duration,hitAt:0,from:point(this.hero.x,this.hero.y),to:point(clamp(this.hero.x+dir.x*distance,b.minX,b.maxX),clamp(this.hero.y+dir.y*distance,b.minY,b.maxY))};if(input.jump&&this.traversal){this.hero.motion.jump=beginJump(this.hero.elevation);this.hero.motion.flightDuration=duration;this.hero.motion.duration+=JUMP_LANDING_SECONDS;}this.faceHero(dir.x,dir.y);this.hero.action=input.jump?'jump1':input.slide?'sliding1':'avoid1';this.hero.serial++;
   if(input.jump)this.jumpAt=this.elapsed+1.05;else this.dodgeAt=this.elapsed+1.2;if(input.dodge)this.rollRecoveryUntil=this.elapsed+.72;return true;
  }
  if(input.skill!==undefined){const slot=input.skill;if(!Number.isInteger(slot)||slot<0||slot>=6||!this.skillEnabled[slot]||this.cooldowns[slot]>0||this.resources.mana<50)return false;
   const spec=referenceSkill(this.skillIds[slot]);if(this.resources.mana<spec.mana)return false;const targets=this.room===0?this.slimes:[this.boss];const center=skillAim(this.hero,targets,spec);this.faceHero(center.x-this.hero.x,this.room===1?center.y-this.hero.y:0);this.resources.mana-=spec.mana;this.cooldowns[slot]=this.cooldownTotals[slot]=spec.cooldown;this.hero.motion={kind:'skill',slot,skillId:spec.id,variant:elementalVariant(this.skillIds[slot]),linkedSupports:this.skillSupportCounts[slot],target:center,radius:spec.radius,damage:spec.damage,attackId:++this.attackSerial,definitionId:spec.id,start:this.elapsed,duration:spec.duration,hitAt:spec.hitAt,from:point(this.hero.x,this.hero.y),to:point(this.hero.x,this.hero.y),done:0};this.hero.action=spec.id==='sun-cleave'?'skill1':'skill2';this.hero.serial++;return true;}
  if(input.attack&&this.elapsed>=this.attackAt){this.attackAt=this.elapsed+.55;this.hero.motion={kind:'attack',start:this.elapsed,duration:.55,hitAt:.22,from:point(this.hero.x,this.hero.y),to:point(this.hero.x,this.hero.y),done:0};this.hero.action=swordAction(++this.heroComboStep);this.hero.motion.comboStep=(this.heroComboStep-1)%5+1;this.hero.motion.hitIds=[];this.hero.motion.attackId=++this.attackSerial;this.hero.motion.definitionId='hero-'+this.hero.action;const d=heroAttackDefinition(this.hero.action);this.hero.motion.timeline={active:[{strike:0,from:d.activeFrom,to:d.activeTo}],cancelFrom:d.cancelFrom,contactRevision:HERO_CONTACT.revision};const dir=this.inputDirection(input);if(Math.hypot(dir.x,dir.y)>.1)this.faceHero(dir.x,dir.y);this.hero.serial++;return true;}return false;
 }
 private damageHero(amount:number,kind:string,contact:any={}){if(this.hero.motion?.kind==='dodge'||this.hero.motion?.kind==='knockback')return false;this.hero.hp=Math.max(1,this.hero.hp-amount);this.effect('damage',this.hero.x,amount,{target:'hero',damageKind:kind,...contact});return true;}
 private heroHit(skill:boolean){
  const motion=this.hero.motion;if(!skill||!motion?.target)return;if(motion.skillId!=='sun-cleave'){this.elemental.cast(motion.skillId!,motion.variant??1,this.hero,{...motion.target,elevation:this.groundAt(motion.target.x,motion.target.y)},motion.start+motion.hitAt,motion.attackId!,motion.damage!,this.elementWorld(),motion.linkedSupports);return;}
  this.effect('skill-impact',motion.target.x,undefined,{skillId:motion.skillId,attackId:motion.attackId,z:motion.target.y,elevation:this.groundAt(motion.target.x,motion.target.y),radius:motion.radius,born:motion.start+motion.hitAt});
  const candidates=this.room===0?this.slimes:this.boss.hp>0?[this.boss]:[];
  for(const target of candidates){if(target.hp<=0||!skillContains(target,motion.target,motion.radius!))continue;
   const damage=motion.damage!;target.hp=Math.max(0,target.hp-damage);this.effect('damage',target.x,damage,{target:target.unityBoss?'boss':'mob'+target.id,damageKind:'skill',attackId:motion.attackId,strike:0,contactAt:motion.start+motion.hitAt,point:{x:target.x,y:target.elevation+30,z:target.y}});
   if(target.hp<=0){this.kills++;target.state='death';if(target.unityBoss){this.defeatBoss();}else if(this.slimeCleared){this.phase='bridge';this.effect('slime-clear',this.hero.x);}}
  }
 }
 private stepWeapon(dt:number){
  const m=this.hero.motion!;if(this.hero.hp<=0)return;const d=heroAttackDefinition(this.hero.action),end=Math.min(d.activeTo,(this.elapsed-m.start)/m.duration),start=Math.max(d.activeFrom,(this.elapsed-dt-m.start)/m.duration);if(end<start)return;
  const candidates=this.room===0?this.slimes:this.boss.hp>0?[this.boss]:[];const samples=Math.max(1,Math.ceil((end-start)*d.segments*2));
  for(let i=0;i<=samples;i++){const phase=start+(end-start)*i/samples;for(const target of candidates){if(target.hp<=0||(m.hitIds??=[]).includes(target.id))continue;const hit=weaponContact(this.hero.action,phase,{...this.hero,sideView:this.room===0},target);if(!hit||!elementLineClear({...this.hero,elevation:this.hero.elevation+35},{...target,elevation:target.elevation+35},this.map.obstacles,(x,y)=>this.groundAt(x,y)))continue;
   const contactAt=m.start+phase*m.duration;m.hitIds!.push(target.id);target.hp=Math.max(0,target.hp-this.rules.attackDamage);
   this.effect('damage',hit.point.x,this.rules.attackDamage,{target:target.unityBoss?'boss':'mob'+target.id,damageKind:'attack',attackId:m.attackId,definitionId:m.definitionId,strike:0,contactAt,contactRevision:HERO_CONTACT.revision,point:hit.point,part:'blade'});
   if(target.hp<=0){this.kills++;target.state='death';if(target.unityBoss){this.defeatBoss();}else if(this.slimeCleared){this.phase='bridge';this.effect('slime-clear',this.hero.x);}}
  }}
 }
 private stepHero(dt:number,input:UnityInput){
  if(stepAttackCancel(this.hero,this.elapsed))return;const m=this.hero.motion;
  if(m){const age=this.elapsed-m.start,t=clamp(age/m.duration,0,1);
   if(m.kind==='jump'&&m.jump&&this.traversal){sampleJump(this.hero,m,this.traversal,age);if(m.jump.landedAt===null){const u=clamp(age/m.flightDuration!,0,1);this.moveHero(m.from.x+(m.to.x-m.from.x)*u,m.from.y+(m.to.y-m.from.y)*u);}const wasLanded=m.jump.landedAt!==null;const done=landJump(this.hero,m,age,this.groundAt(this.hero.x,this.hero.y));if(!wasLanded&&m.jump.landedAt!==null)settleLanding(this.hero,m.from,this.room===1?[this.boss]:this.slimes,this.map.obstacles,this.bounds(),(x,y)=>this.groundAt(x,y),this.room===1);if(done){this.hero.motion=null;this.hero.action='stay1';}return;}
   if(['jump','slide','dodge'].includes(m.kind)){this.hero.airHeight=m.kind==='jump'?(this.traversal?jumpHeight(this.traversal,age):400*t*(1-t)):0;this.moveHero(m.from.x+(m.to.x-m.from.x)*t,m.from.y+(m.to.y-m.from.y)*t);if(m.kind==='slide')this.hero.action=t<.7?'sliding1':'sliding2';}
   else if(m.kind==='knockback'){const flight=clamp(age/.45,0,1);this.moveHero(m.from.x+(m.to.x-m.from.x)*flight,m.from.y+(m.to.y-m.from.y)*flight);this.hero.airHeight=age<.45?4*210*flight*(1-flight):0;this.hero.action=age<.45?'knockback':age<1.2?'knockdown':'getup';}
   else if(m.kind==='attack')this.stepWeapon(dt);
   else if(age>=m.hitAt&&!m.done){m.done=1;this.heroHit(m.kind==='skill');}
   if(t>=1){if(m.kind==='dodge'||m.kind==='jump'){settleLanding(this.hero,m.from,this.room===1?[this.boss]:this.slimes,this.map.obstacles,this.bounds(),(x,y)=>this.groundAt(x,y),this.room===1);}this.hero.motion=null;this.hero.airHeight=0;this.hero.action='stay1';}return;
  }
  let direction=this.inputDirection(input);
  if(this.auto&&Math.hypot(direction.x,direction.y)<.1&&this.elapsed<this.rollRecoveryUntil){this.hero.action='stay1';return;}
  if(this.auto&&Math.hypot(direction.x,direction.y)<.1){const target=this.room===0?this.slimes.filter(m=>m.hp>0).sort((a,b)=>distance(a,this.hero)-distance(b,this.hero))[0]:this.boss.hp>0?this.boss:null;
   if(target){if(distance(target,this.hero)<(target.unityBoss?185:95)){this.command({...input,attack:true});return;}direction=normalized(target.x-this.hero.x,this.room===1?target.y-this.hero.y:0);}else if(this.room===0&&this.slimeCleared)direction={x:1,y:0};}
  if(Math.hypot(direction.x,direction.y)>.1){this.moveHero(this.hero.x+direction.x*(this.traversal?.run??210)*dt,this.hero.y+direction.y*(this.traversal?.run??210)*dt);this.faceHero(direction.x,direction.y);this.hero.action='run1';}else this.hero.action='stay1';

 }
 private stepIntro(dt:number){
  if(this.introStage==='approach'){this.phase='boss-approach';this.hero.x=Math.min(this.introStartX+300,this.hero.x+150*dt);this.hero.action='walk';this.hero.direction={x:1,y:0};this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);
   if(this.hero.x>=this.introStartX+300-.001){this.introStage='reveal';this.introAt=this.elapsed;this.phase='boss-reveal';this.hero.action='stay1';this.effect('boss-arrival',this.boss.x,undefined,{z:this.boss.y,elevation:this.boss.elevation,radius:200});}
  }else{this.phase='boss-reveal';this.hero.action='stay1';if(this.elapsed-this.introAt>=1.25){this.introStage='none';this.phase='boss';this.bossIdleUntil=this.elapsed+.25;this.bossChaseUntil=this.elapsed+2.4;this.bossAt=this.elapsed+2.65;}}
 }
 private elementWorld(){return {targets:this.room===0?this.slimes:[this.boss],obstacles:this.map.obstacles,ground:(x:number,y:number)=>this.groundAt(x,y),
  emit:(f:any)=>this.effect(f.kind,f.x,undefined,f),
  damage:(t:any,damage:number,attackId:number,at:number,element:string,p:any)=>{t.hp=Math.max(0,t.hp-damage);this.effect('damage',p.x,damage,{target:t.unityBoss?'boss':'mob'+t.id,damageKind:'skill',element,attackId,contactAt:at,point:{x:p.x,y:p.elevation,z:p.y}});if(!t.hp){this.kills++;t.state='death';if(t.unityBoss){this.defeatBoss();}else if(this.slimeCleared)this.phase='bridge';}},
  impulse:(t:any,dx:number,dy:number)=>{const b=this.bounds(),x=clamp(t.x+dx,b.minX+t.radius,b.maxX-t.radius),y=this.room===0?LANE_Y:clamp(t.y+dy,b.minY+t.radius,b.maxY-t.radius);if(!this.blocked(x,y,t.radius)){t.x=x;t.y=y;t.elevation=this.groundAt(x,y);}}};}
 private stepSlimes(dt:number){if(this.room!==0)return;for(const m of this.slimes){if(m.hp<=0)continue;const delta=this.hero.x-m.x;if(Math.abs(delta)>70){m.x=clamp(m.x+Math.sign(delta)*75*dt,1150,2120);m.state='walk';}else{m.state='attack';if(this.elapsed>=m.nextAttack){m.nextAttack=this.elapsed+1.5;this.damageHero(50,'attack');}}m.facing=Math.sign(delta)||-1;m.elevation=this.groundAt(m.x,m.y);}}
 private stepBoss(dt:number){
  if(this.room!==1||this.boss.hp<=0||this.hero.hp<=0)return;const m=this.boss.motion;
  if(m){const age=this.elapsed-m.start;if(m.kind==='boss-combo'){
    const start=Math.max(0,(age-dt)/m.duration),end=Math.min(1,age/m.duration);m.hitMask??=0;
    for(const w of BOSS_CONTACT.windows){if((m.hitMask&(1<<w.strike))!==0||end<w.from||start>w.to)continue;
     const lo=Math.max(start,w.from),hi=Math.min(end,w.to),samples=Math.max(1,Math.ceil((hi-lo)*BOSS_CONTACT.segments*2));
     for(let i=0;i<=samples;i++){const phase=lo+(hi-lo)*i/samples,t=dt>0?clamp((m.start+phase*m.duration-(this.elapsed-dt))/dt,0,1):1,from=this.previousHero;
      const hero={...this.hero,x:from.x+(this.hero.x-from.x)*t,y:from.y+(this.hero.y-from.y)*t,elevation:from.elevation+(this.hero.elevation-from.elevation)*t,airHeight:from.airHeight+(this.hero.airHeight-from.airHeight)*t};
      const hit=hookContact(phase,w.hand,this.boss,hero);if(!hit)continue;
      const contactAt=m.start+phase*m.duration,contact={attackId:m.attackId,strike:w.strike,contactAt,contactRevision:BOSS_CONTACT.revision,point:hit.point,part:hit.part};
      if(this.damageHero(1000,'hook',contact)){m.hitMask|=1<<w.strike;this.effect('boss-hook',hit.point.x,w.strike+1,{...contact,z:hit.point.z-LANE_Y,elevation:hit.point.y,damageKind:'attack'});}break;
     }
    }
   }
   if(age>=m.duration){this.boss.motion=null;this.boss.action='idle';this.bossIdleUntil=this.elapsed+(m.kind==='boss-combo'?1.25:1.6);this.bossChaseUntil=this.bossIdleUntil+1.35;this.bossAt=this.bossChaseUntil+.3;}return;
  }
  if(this.elapsed<this.bossIdleUntil){this.boss.action='idle';return;}
  this.boss.direction=normalized(this.hero.x-this.boss.x,this.hero.y-this.boss.y);this.boss.facing=this.hero.x<this.boss.x?-1:1;
  if(distance(this.hero,this.boss)>190&&(this.elapsed<this.bossChaseUntil||this.bossTurn%2===0&&distance(this.hero,this.boss)>360)){
   const b=this.bounds(),nx=clamp(this.boss.x+this.boss.direction.x*110*dt,b.minX+150,b.maxX-150),ny=clamp(this.boss.y+this.boss.direction.y*110*dt,b.minY+150,b.maxY-150);
   if(!this.blocked(nx,ny,100)){this.boss.x=nx;this.boss.y=ny;}else if(!this.blocked(nx,this.boss.y,100))this.boss.x=nx;else if(!this.blocked(this.boss.x,ny,100))this.boss.y=ny;
   this.bossAt=Math.max(this.bossAt,this.elapsed+.55);this.boss.action='walk';this.boss.elevation=this.groundAt(this.boss.x,this.boss.y);if(distance(this.hero,this.boss)>450)return;
  }else this.boss.action='idle';
  if(this.elapsed<this.bossAt)return;
  if(this.bossTurn++%2===0){this.boss.motion={kind:'boss-combo',definitionId:'boss-hook-pair',timeline:{active:BOSS_CONTACT.windows,cancelFrom:1,contactRevision:BOSS_CONTACT.revision},attackId:++this.attackSerial,hitMask:0,start:this.elapsed,duration:this.rules.comboDuration,hitAt:this.rules.comboHitTimes[0],hits:[...this.rules.comboHitTimes],done:0,from:point(this.boss.x,this.boss.y),to:point(this.boss.x,this.boss.y)};this.boss.action='combo';}
  else {this.boss.motion={kind:'boss-throw',definitionId:'boss-throw',timeline:{active:[{strike:0,from:1/1.65,to:1/1.65}],cancelFrom:1},attackId:++this.attackSerial,start:this.elapsed,duration:1.65,hitAt:1,from:point(this.boss.x,this.boss.y),to:point(this.boss.x,this.boss.y)};this.boss.action='throw';this.warning={id:++this.effectSerial,attackId:this.boss.motion.attackId!,x:this.hero.x,z:this.hero.y-LANE_Y,radius:this.rules.blastRadius,born:this.elapsed,explodeAt:this.elapsed+this.rules.warningSeconds};}
 }
 private detonate(){const w=this.warning;if(!w||this.elapsed+1e-8<w.explodeAt)return;this.warning=null;this.effect('explosion',w.x,this.rules.blastDamage,{radius:w.radius,z:w.z,damageKind:'skill',warningId:w.id,attackId:w.attackId,contactAt:w.explodeAt});
  if(Math.hypot(this.hero.x-w.x,this.hero.y-LANE_Y-w.z)>w.radius||this.hero.airHeight>120||this.hero.motion?.kind==='dodge')return;
  if(this.damageHero(this.rules.blastDamage,'skill',{attackId:w.attackId,contactAt:w.explodeAt,warningId:w.id})){const dir=normalized(this.hero.x-this.boss.x,this.hero.y-this.boss.y),b=this.bounds();this.hero.motion={kind:'knockback',start:this.elapsed,duration:this.rules.knockbackSeconds,hitAt:0,from:point(this.hero.x,this.hero.y),to:point(clamp(this.hero.x+dir.x*260,b.minX,b.maxX),clamp(this.hero.y+dir.y*260,b.minY,b.maxY))};this.hero.action='knockback';this.hero.serial++;}
 }
 step(dt:number,input:UnityInput){this.paused=!!input.paused;this.auto=input.auto;if(this.status!=='playing'||this.paused)return;dt=clamp(dt,0,.02);this.elapsed+=dt;
  for(let i=0;i<6;i++)this.cooldowns[i]=Math.max(0,this.cooldowns[i]-dt);for(const k of ['health','mana'] as const)this.resources.potionCooldowns[k]=Math.max(0,this.resources.potionCooldowns[k]-dt);
  if(this.introStage!=='none'){this.stepIntro(dt);return;}
  if(this.bossDefeated&&this.arena){this.stepVillageExit(dt,input);this.fx=this.fx.filter(f=>this.elapsed-f.born<2.5);return;}
  this.previousHero={x:this.hero.x,y:this.hero.y,elevation:this.hero.elevation,airHeight:this.hero.airHeight};this.stepHero(dt,input);this.separateBody();this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);this.stepSlimes(dt);this.stepBoss(dt);this.elemental.step(this.elapsed,dt,this.elementWorld());this.separateBody();this.detonate();this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);this.fx=this.fx.filter(f=>this.elapsed-f.born<2.5);
 }
 groundAt(x:number,y=LANE_Y){const t=this.map.terrain,z=(y-LANE_Y)/100,gx=clamp((x/100-t.originX)/t.step,0,t.width-1),gz=clamp((z-t.originZ)/t.step,0,t.height-1),ix=Math.min(t.width-2,Math.floor(gx)),iz=Math.min(t.height-2,Math.floor(gz)),a=t.heights;
  const low=a[iz*t.width+ix]+(a[iz*t.width+ix+1]-a[iz*t.width+ix])*(gx-ix),high=a[(iz+1)*t.width+ix]+(a[(iz+1)*t.width+ix+1]-a[(iz+1)*t.width+ix])*(gx-ix);let ground=(low+(high-low)*(gz-iz))*100;
  const b=this.map.bridge;if(b&&x>=b.from&&x<=b.to&&Math.abs(z)<=.65){const heights=b.heightCore as number[],i=(x-b.from)/(b.to-b.from)*(heights.length-1),n=Math.floor(i);ground=Math.max(ground,heights[n]+(heights[Math.min(n+1,heights.length-1)]-heights[n])*(i-n));}return ground;
 }
 private outsideArena(x:number,y:number,radius:number){
  if(!this.arena)return false;const a=this.arena;if(Math.hypot(x-a.center.x,y-a.center.y)<=a.radius-radius)return false;
  if(this.villageExitProgress<1)return true;
  const path=[a.center,...a.exitWaypoints];for(let i=1;i<path.length;i++){const p=path[i-1],q=path[i],dx=q.x-p.x,dy=q.y-p.y,t=clamp(((x-p.x)*dx+(y-p.y)*dy)/(dx*dx+dy*dy),0,1);if(Math.hypot(x-p.x-dx*t,y-p.y-dy*t)<=220-radius)return false;}return true;
 }
 private defeatBoss(){
  if(this.bossDefeated)return;this.bossDefeated=true;this.defeatedAt=this.elapsed;this.warning=null;this.boss.motion=null;this.boss.action='death';this.elemental.clear();this.effect('boss-defeated',this.boss.x);
  if(this.arena){this.phase='village-exit';this.exitWaypoint=0;}else{this.status='won';this.phase='complete';}
 }
 private get villageExitProgress(){return this.bossDefeated?clamp((this.elapsed-this.defeatedAt)/VILLAGE_EXIT_OPEN_SECONDS,0,1):0;}
 private stepVillageExit(dt:number,input:UnityInput){
  this.hero.motion=null;this.hero.airHeight=0;let direction=this.inputDirection(input);const waypoints=this.arena.exitWaypoints;
  const autoRun=input.auto&&Math.hypot(direction.x,direction.y)<.1;
  if(autoRun){if(this.villageExitProgress<1)direction={x:0,y:0};else{while(this.exitWaypoint<waypoints.length-1&&distance(this.hero,waypoints[this.exitWaypoint])<70)this.exitWaypoint++;const p=waypoints[this.exitWaypoint];direction=normalized(p.x-this.hero.x,p.y-this.hero.y);}}
  const speed=autoRun?(this.traversal?.run??210):180;
  if(Math.hypot(direction.x,direction.y)>.1){this.moveHero(this.hero.x+direction.x*speed*dt,this.hero.y+direction.y*speed*dt);this.faceHero(direction.x,direction.y);this.hero.action=autoRun?'run1':'walk';}else this.hero.action='stay1';
  this.hero.elevation=this.groundAt(this.hero.x,this.hero.y);
  if(distance(this.hero,waypoints[waypoints.length-1])<100){this.status='won';this.phase='complete';this.hero.action='stay1';this.effect('village-arrived',this.hero.x);}
 }

 view(){const b=this.bounds();return {...(this.arena?{zoneTenArena:true,bossDefeated:this.bossDefeated,bossDefeatedAt:this.defeatedAt,villageExitProgress:this.villageExitProgress,villageExitOpen:this.villageExitProgress>=1,villageEntered:this.status==='won',exitTarget:this.arena.exitWaypoints.at(-1)}:{}),...(this.traversal?{traversalProfile:this.traversal.id,movementSpeed:this.traversal.run}:{}),presentationRevision:'combat-view-v1',inputSpace:'world-xz',movementMode:this.room===1&&this.introStage!=='approach'?'plane':'lane',bossCadence:{idleUntil:this.bossIdleUntil,chaseUntil:this.bossChaseUntil,nextAttackAt:this.bossAt},contactRevision:BOSS_CONTACT.revision,bodyRadius:BOSS_CONTACT.bodyRadius,heroRadius:BOSS_CONTACT.heroRadius,heroHeight:BOSS_CONTACT.heroHeight,unityBossMode:true,protocol:UNITY_BOSS_PROTOCOL,totalRooms:2,training:true,room:this.room,status:this.status,phase:this.phase,elapsed:this.elapsed,paused:this.paused,auto:this.auto,kills:this.kills,gold:0,hero:{...this.hero,direction:{...this.hero.direction},motion:this.hero.motion?JSON.parse(JSON.stringify(this.hero.motion)):null},mobs:[...this.slimes.map(m=>({...m})),{...this.boss,motion:this.boss.motion?JSON.parse(JSON.stringify(this.boss.motion)):null}],warning:this.warning?{...this.warning}:null,fx:this.fx.map(f=>({...f})),walkBounds:b,cleared:this.slimeCleared?[0]:[],visited:this.room===1?[0,1]:[0],cameraMode:this.room===1&&this.boss.hp>0&&this.introStage!=='approach'?'QuarterView':'Side25D',bossVisible:this.room===1&&this.introStage!=='approach'&&(!this.arena||!this.bossDefeated||this.elapsed-this.defeatedAt<3.5),bossIntroActive:this.introStage!=='none',bossIntroStage:this.introStage,bossRevealAt:this.introAt,elementalProjectiles:this.elemental.view(this.elapsed),resources:JSON.parse(JSON.stringify(this.resources)),cooldowns:[...this.cooldowns],cooldownTotals:[...this.cooldownTotals],jumpReady:this.elapsed>=this.jumpAt&&(!this.hero.motion||this.hero.motion.kind==='attack'),dodgeReady:this.elapsed>=this.dodgeAt&&(!this.hero.motion||this.hero.motion.kind==='attack'),slideReady:this.elapsed>=this.dodgeAt&&(!this.hero.motion||this.hero.motion.kind==='attack')};}
}
