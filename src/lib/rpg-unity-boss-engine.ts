// Unity-only training encounter. The web RogueEngine, economy and its stage kernel stay unchanged.
import bridgeProfile from './generated/unity-boss-bridge.json';
export const UNITY_BOSS_PROTOCOL='island-unity-boss-v1';
export type UnityInput={x:number;y:number;auto:boolean;paused?:boolean;attack?:boolean;jump?:boolean;slide?:boolean;dodge?:boolean;skill?:number;potion?:'health'|'mana'};
type Motion={kind:string;start:number;duration:number;hitAt:number;from:{x:number;y:number};to:{x:number;y:number};hits?:number[];done?:number;slot?:number};
export type UnityRules={playerHP:number;bossHP:number;slimeCount:number;slimeHP:number;attackDamage:number;comboDuration:number;comboHitTimes:number[];warningSeconds:number;blastDamage:number;blastRadius:number;knockbackSeconds:number};
export const UNITY_BOSS_RULES:Readonly<UnityRules>=Object.freeze({playerHP:1_000_000,bossHP:1_000_000_000,slimeCount:8,slimeHP:120,attackDamage:60,comboDuration:2.2,comboHitTimes:[.85,1.55],warningSeconds:2,blastDamage:10000,blastRadius:240,knockbackSeconds:1.8});
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const point=(x:number)=>({x,y:192});
export class UnityBossEngine {
 readonly rules:UnityRules;readonly map:any;elapsed=0;room=0;kills=0;status='playing';phase='combat';paused=false;auto=true;
 hero={x:280,y:192,elevation:0,airHeight:0,facing:1,direction:{x:1,y:0},hp:0,maxHP:0,action:'stay1',serial:0,motion:null as Motion|null};
 boss={id:9001,species:9001,unityBoss:true,room:1,x:4500,y:192,elevation:0,hp:0,maxHP:0,radius:280,state:'idle',action:'idle',facing:-1,motion:null as Motion|null};
 slimes:Array<any>=[];fx:Array<any>=[];warning:null|{id:number;x:number;z:number;radius:number;born:number;explodeAt:number}=null;
 cooldowns=[0,0,0,0,0,0];cooldownTotals=[4,4,4,4,4,4];skillEnabled=[false,false,false,false,false,false];
 resources={mana:1000,maxMana:1000,potions:{health:3,mana:3},potionCooldowns:{health:0,mana:0}};
 private dodgeAt=0;private jumpAt=0;private attackAt=0;private bossAt=0;private bossTurn=0;private effectSerial=0;private rollRecoveryUntil=0;
 constructor(seed=111,rules:Partial<UnityRules>={}){
  this.rules={...UNITY_BOSS_RULES,...rules,comboHitTimes:[...(rules.comboHitTimes??UNITY_BOSS_RULES.comboHitTimes)]};this.hero.hp=this.hero.maxHP=this.rules.playerHP;this.boss.hp=this.boss.maxHP=this.rules.bossHP;
  const width=140,height=8;this.map={seed,width,height,unityBossMode:true,rooms:[{id:0,x1:0,x2:39,y1:0,y2:7,elevation:0,kind:'slime',branch:'main'},{id:1,x1:60,x2:139,y1:0,y2:7,elevation:0,kind:'boss',branch:'main',decorate:false}],tiles:Array(width*height).fill(0),gates:[],bridge:{from:1920,to:2880,heightCore:bridgeProfile.heightCore},ground:{frontDepth:4,backDepth:24,skirtDepth:12}};
  for(let i=0;i<this.rules.slimeCount;i++)this.slimes.push({id:i+1,species:1003,room:0,x:650+i*130,y:192,elevation:0,hp:this.rules.slimeHP,maxHP:this.rules.slimeHP,radius:16,state:'walk',facing:-1,nextAttack:0});
 }
 private effect(kind:string,x:number,value?:number,extra:any={}){this.fx.push({id:++this.effectSerial,kind,x,room:this.room,born:this.elapsed,value,...extra});if(this.fx.length>48)this.fx.splice(0,this.fx.length-48);}
 get slimeCleared(){return this.slimes.every(m=>m.hp<=0);}
 private bounds(){return this.room===1?{minX:2892,maxX:6708}:this.slimeCleared?{minX:12,maxX:6708}:{minX:12,maxX:1908};}
 private moveHero(x:number){const b=this.bounds();this.hero.x=clamp(x,b.minX,b.maxX);if(this.hero.x>=2880&&this.slimeCleared){this.room=1;this.phase='boss';}else if(this.slimeCleared)this.phase='bridge';}
 command(input:UnityInput){
  if(this.status!=='playing'||this.paused||input.paused)return false;
  if(input.potion){const k=input.potion;if(this.resources.potions[k]<=0||this.resources.potionCooldowns[k]>0)return false;this.resources.potions[k]--;this.resources.potionCooldowns[k]=5;if(k==='health')this.hero.hp=Math.min(this.hero.maxHP,this.hero.hp+this.hero.maxHP*.3);else this.resources.mana=this.resources.maxMana;return true;}
  if(this.hero.motion)return false;
  if(input.jump||input.slide||input.dodge){
   if(input.jump?this.elapsed<this.jumpAt:this.elapsed<this.dodgeAt)return false;
   const dir=Math.abs(input.x)>.1?Math.sign(input.x):this.hero.facing;const kind=input.jump?'jump':input.slide?'slide':'dodge',duration=input.jump ? .86 : .65;
   const b=this.bounds(),distance=input.jump?150:input.slide?200:120;
   this.hero.motion={kind,start:this.elapsed,duration,hitAt:0,from:point(this.hero.x),to:point(clamp(this.hero.x+dir*distance,b.minX,b.maxX))};this.hero.facing=dir;this.hero.action=input.jump?'jump1':input.slide?'sliding1':'avoid1';this.hero.serial++;
   if(input.jump)this.jumpAt=this.elapsed+1.05;else this.dodgeAt=this.elapsed+1.2;if(input.dodge)this.rollRecoveryUntil=this.elapsed+.72;return true;
  }
  if(input.skill!==undefined){const slot=input.skill;if(!Number.isInteger(slot)||slot<0||slot>=6||!this.skillEnabled[slot]||this.cooldowns[slot]>0||this.resources.mana<50)return false;
   this.resources.mana-=50;this.cooldowns[slot]=4;this.hero.motion={kind:'skill',slot,start:this.elapsed,duration:.7,hitAt:.3,from:point(this.hero.x),to:point(this.hero.x),done:0};this.hero.action='skill1';this.hero.serial++;return true;}
  if(input.attack&&this.elapsed>=this.attackAt){this.attackAt=this.elapsed+.55;this.hero.motion={kind:'attack',start:this.elapsed,duration:.55,hitAt:.22,from:point(this.hero.x),to:point(this.hero.x),done:0};this.hero.action='attack'+(this.hero.serial%3+1);this.hero.serial++;return true;}return false;
 }
 private damageHero(amount:number,kind:string){if(this.hero.motion?.kind==='dodge'||this.hero.motion?.kind==='knockback')return false;this.hero.hp=Math.max(1,this.hero.hp-amount);this.effect('damage',this.hero.x,amount,{target:'hero',damageKind:kind});return true;}
 private heroHit(skill:boolean){const range=skill?600:300,damage=this.rules.attackDamage*(skill?4:1);let target:any=null;
  const candidates=this.room===0?this.slimes.filter(m=>m.hp>0):this.boss.hp>0?[this.boss]:[];
  for(const m of candidates)if(Math.abs(m.x-this.hero.x)<range&&(!target||Math.abs(m.x-this.hero.x)<Math.abs(target.x-this.hero.x)))target=m;
  if(!target)return;this.hero.facing=target.x>=this.hero.x?1:-1;target.hp=Math.max(0,target.hp-damage);this.effect('damage',target.x,damage,{target:target.unityBoss?'boss':'mob'+target.id,damageKind:skill?'skill':'attack'});
  if(target.hp<=0){this.kills++;target.state='death';if(target.unityBoss){this.status='won';this.phase='complete';this.warning=null;this.effect('boss-defeated',target.x);}else if(this.slimeCleared){this.phase='bridge';this.effect('slime-clear',this.hero.x);}}
 }
 private stepHero(dt:number,input:UnityInput){
  const m=this.hero.motion;
  if(m){const age=this.elapsed-m.start,t=clamp(age/m.duration,0,1);
   if(['jump','slide','dodge'].includes(m.kind)){this.moveHero(m.from.x+(m.to.x-m.from.x)*t);this.hero.airHeight=m.kind==='jump'?400*t*(1-t):0;if(m.kind==='slide')this.hero.action=t<.7?'sliding1':'sliding2';}
   else if(m.kind==='knockback'){const flight=clamp(age/.45,0,1);this.moveHero(m.from.x+(m.to.x-m.from.x)*flight);this.hero.airHeight=age<.45?4*210*flight*(1-flight):0;this.hero.action=age<.45?'knockback':age<1.2?'knockdown':'getup';}
   else if(age>=m.hitAt&&!m.done){m.done=1;this.heroHit(m.kind==='skill');}
   if(t>=1){this.hero.motion=null;this.hero.airHeight=0;this.hero.action='stay1';}return;
  }
  let direction=clamp(input.x,-1,1);
  if(this.auto&&Math.abs(direction)<.1&&this.elapsed<this.rollRecoveryUntil){this.hero.action='stay1';return;}
  if(this.auto&&Math.abs(direction)<.1){const target=this.room===0?this.slimes.filter(m=>m.hp>0).sort((a,b)=>Math.abs(a.x-this.hero.x)-Math.abs(b.x-this.hero.x))[0]:this.boss.hp>0?this.boss:null;
   if(target){if(Math.abs(target.x-this.hero.x)<230){this.command({...input,attack:true});return;}direction=Math.sign(target.x-this.hero.x);}else if(this.room===0&&this.slimeCleared)direction=1;}
  if(Math.abs(direction)>.1){this.moveHero(this.hero.x+direction*210*dt);this.hero.facing=Math.sign(direction);this.hero.direction={x:this.hero.facing,y:0};this.hero.action='run1';}else this.hero.action='stay1';
 }
 private stepSlimes(dt:number){if(this.room!==0)return;for(const m of this.slimes){if(m.hp<=0)continue;const delta=this.hero.x-m.x;if(Math.abs(delta)>70){m.x=clamp(m.x+Math.sign(delta)*75*dt,40,1880);m.state='walk';}else{m.state='attack';if(this.elapsed>=m.nextAttack){m.nextAttack=this.elapsed+1.5;this.damageHero(50,'attack');}}m.facing=Math.sign(delta)||-1;}}
 private stepBoss(){
  if(this.room!==1||this.boss.hp<=0)return;this.boss.facing=this.hero.x<this.boss.x?-1:1;const m=this.boss.motion;
  if(m){const age=this.elapsed-m.start;if(m.kind==='boss-combo'){const hits=m.hits??[];let done=m.done??0;while(done<hits.length&&age>=hits[done]){if(Math.abs(this.hero.x-this.boss.x)<900)this.damageHero(1000,'attack');this.effect('boss-hook',this.hero.x,done+1,{damageKind:'attack'});done++;}m.done=done;}
   if(age>=m.duration){this.boss.motion=null;this.boss.action='idle';this.bossAt=this.elapsed+1.1;}return;
  }
  if(this.elapsed<this.bossAt)return;
  if(this.bossTurn++%2===0){this.boss.motion={kind:'boss-combo',start:this.elapsed,duration:this.rules.comboDuration,hitAt:this.rules.comboHitTimes[0],hits:[...this.rules.comboHitTimes],done:0,from:point(this.boss.x),to:point(this.boss.x)};this.boss.action='combo';}
  else {this.boss.motion={kind:'boss-throw',start:this.elapsed,duration:1.65,hitAt:1,from:point(this.boss.x),to:point(this.boss.x)};this.boss.action='throw';this.warning={id:++this.effectSerial,x:this.hero.x,z:0,radius:this.rules.blastRadius,born:this.elapsed,explodeAt:this.elapsed+this.rules.warningSeconds};}
 }
 private detonate(){const w=this.warning;if(!w||this.elapsed+1e-8<w.explodeAt)return;this.warning=null;this.effect('explosion',w.x,this.rules.blastDamage,{radius:w.radius,damageKind:'skill',warningId:w.id});
  if(Math.abs(this.hero.x-w.x)>w.radius||this.hero.airHeight>120||this.hero.motion?.kind==='dodge')return;
  if(this.damageHero(this.rules.blastDamage,'skill')){const dir=this.hero.x<this.boss.x?-1:1,b=this.bounds();this.hero.motion={kind:'knockback',start:this.elapsed,duration:this.rules.knockbackSeconds,hitAt:0,from:point(this.hero.x),to:point(clamp(this.hero.x+dir*260,b.minX,b.maxX))};this.hero.action='knockback';this.hero.serial++;}
 }
 step(dt:number,input:UnityInput){this.paused=!!input.paused;this.auto=input.auto;if(this.status!=='playing'||this.paused)return;dt=clamp(dt,0,.02);this.elapsed+=dt;
  for(let i=0;i<6;i++)this.cooldowns[i]=Math.max(0,this.cooldowns[i]-dt);for(const k of ['health','mana'] as const)this.resources.potionCooldowns[k]=Math.max(0,this.resources.potionCooldowns[k]-dt);
  this.stepHero(dt,input);this.stepSlimes(dt);this.stepBoss();this.detonate();this.hero.elevation=this.groundAt(this.hero.x);this.fx=this.fx.filter(f=>this.elapsed-f.born<2.5);
 }
 groundAt(x:number){const bridge=this.map.bridge;if(x<bridge.from||x>bridge.to)return 0;const a=bridge.heightCore as number[],i=clamp((x-bridge.from)/(bridge.to-bridge.from),0,1)*(a.length-1),n=Math.floor(i);return a[n]+(a[Math.min(n+1,a.length-1)]-a[n])*(i-n);}
 view(){const b=this.bounds();return {unityBossMode:true,protocol:UNITY_BOSS_PROTOCOL,totalRooms:2,training:true,room:this.room,status:this.status,phase:this.phase,elapsed:this.elapsed,paused:this.paused,auto:this.auto,kills:this.kills,gold:0,hero:{...this.hero,direction:{...this.hero.direction},motion:this.hero.motion?JSON.parse(JSON.stringify(this.hero.motion)):null},mobs:[...this.slimes.map(m=>({...m})),{...this.boss,motion:this.boss.motion?JSON.parse(JSON.stringify(this.boss.motion)):null}],warning:this.warning?{...this.warning}:null,fx:this.fx.map(f=>({...f})),walkBounds:b,cleared:this.slimeCleared?[0]:[],visited:this.room===1?[0,1]:[0],cameraMode:this.hero.x>=2350&&this.boss.hp>0?'QuarterView':'Side25D',bossVisible:this.hero.x>=2250,resources:JSON.parse(JSON.stringify(this.resources)),cooldowns:[...this.cooldowns],cooldownTotals:[...this.cooldownTotals],jumpReady:this.elapsed>=this.jumpAt&&!this.hero.motion,dodgeReady:this.elapsed>=this.dodgeAt&&!this.hero.motion,slideReady:this.elapsed>=this.dodgeAt&&!this.hero.motion};}
}
