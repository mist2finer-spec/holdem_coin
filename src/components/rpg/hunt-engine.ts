import {HUNT_RULES,motions,SKILL_COOLDOWNS,WORLD_WIDTH,type ComboStage} from './combat-rules';
export {SKILL_COOLDOWNS,WORLD_WIDTH} from './combat-rules';
type Motion={kind:'attack'|'skill'|'rush'|'dodge';start:number;duration:number;target:number;
 segments:{animation:string;duration:number}[];phase:number;hits:{at:number;damage:number;range:number;done:boolean;heal?:boolean}[];
 destination?:number;speed?:number};
const clampX=(x:number)=>Math.max(65,Math.min(WORLD_WIDTH-65,x));
/** Browser-local restoration scaffold. Original formulas/config remain unresolved. */
export class HuntEngine {
 x=620;enemyX=780;facing=1;enemyHP=100;hp=100;enemySerial=1;
 elapsed=0;kills=0;coins=0;xp=0;auto=false;paused=false;
 action='stay1';actionSerial=0;animationSpeed=1;actionUntil=0;
 cooldowns=[0,0,0,0,0,0];dodgeReady=0;attackReady=0;respawnAt=0;
 lastDamage=0;hitUntil=0;comboStage=0;attackHeld=false;
 private motion:Motion|null=null;
 private comboIndex=0;private comboExpires=0;private queuedUntil=0;private attackIntent=false;
 readonly combo:readonly ComboStage[];
 constructor(combo:readonly ComboStage[]=HUNT_RULES.combo){
  if(!combo.length||combo.some(s=>!motions.durations[s.animation]||!Number.isFinite(s.hitAt)
   ||s.hitAt<0||s.hitAt>(s.duration??motions.durations[s.animation])
   ||s.duration!==undefined&&(!Number.isFinite(s.duration)||s.duration<motions.durations[s.animation])
   ||!Number.isFinite(s.damage)||s.damage<=0))throw Error('Invalid combo profile');
  this.combo=combo.map(s=>({...s}));
 }
 private pose(animation:string,restart=false,speed=1){
  if(restart||animation!==this.action){this.action=animation;this.actionSerial++;}
  this.animationSpeed=speed;
 }
 private resetCombo(){this.comboIndex=0;this.comboStage=0;this.comboExpires=0;this.queuedUntil=0;}
 clearInput(){this.attackHeld=false;this.attackIntent=false;this.queuedUntil=0;}
 setAuto(value:boolean){
  this.auto=value;
  if(!value){this.clearInput();if(this.motion?.kind==='rush'){
   this.motion=null;this.actionUntil=this.elapsed;this.pose('stay1');}}
 }
 private start(m:Motion){
  this.motion=m;this.actionUntil=this.elapsed+m.duration;
  this.pose(m.segments[0].animation,true,m.kind==='rush'?motions.durations.dash/m.duration:1);
 }
 private hurt(damage:number){
  this.lastDamage=Math.min(damage,this.enemyHP);this.hitUntil=this.elapsed+.75;
  this.enemyHP=Math.max(0,this.enemyHP-damage);
  if(this.enemyHP===0){this.kills++;this.coins+=25;this.xp+=12;this.respawnAt=this.elapsed+2;
   this.attackIntent=false;this.resetCombo();}
 }
 private advanceMotion(dt:number,direction:number){
  const m=this.motion;if(!m)return;
  if(m.kind==='rush'&&(direction!==0||this.enemyHP<=0||m.target!==this.enemySerial)){
   this.motion=null;this.actionUntil=this.elapsed;this.attackIntent=false;this.pose('stay1');return;
  }
  if(m.destination!==undefined&&m.speed!==undefined){
   const delta=m.destination-this.x;
   this.x=clampX(this.x+Math.sign(delta)*Math.min(Math.abs(delta),m.speed*dt));
  }
  const age=this.elapsed-m.start;
  for(const hit of m.hits){
   if(hit.done||age+1e-8<hit.at)continue;hit.done=true;
   if(hit.heal){this.hp=Math.min(100,this.hp+25);continue;}
   if(m.target===this.enemySerial&&this.enemyHP>0&&Math.abs(this.enemyX-this.x)<=hit.range
    &&(this.enemyX-this.x)*this.facing>=0)this.hurt(hit.damage);
  }
  let end=0,phase=m.segments.length-1;
  for(let i=0;i<m.segments.length;i++){end+=m.segments[i].duration;if(age<end-1e-8){phase=i;break;}}
  if(m.phase!==phase){m.phase=phase;this.pose(m.segments[phase].animation,true);}
  if(age+1e-8>=m.duration){
   if(m.destination!==undefined)this.x=clampX(m.destination);
   this.motion=null;this.actionUntil=this.elapsed;this.pose('stay1');
  }
 }
 step(dt:number,direction:number){
  if(this.paused)return;
  dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05));
  direction=Number.isFinite(direction)?Math.max(-1,Math.min(1,direction)):0;
  this.elapsed+=dt;this.cooldowns=this.cooldowns.map(t=>Math.max(0,t-dt));
  if(this.enemyHP<=0&&this.elapsed>=this.respawnAt){
   this.enemyHP=100;this.enemySerial++;this.hitUntil=0;
   this.enemyX=Math.min(WORLD_WIDTH-90,Math.max(90,this.x+this.facing*230));
  }
  this.advanceMotion(dt,direction);
  if(this.motion)return;
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(direction){
   this.attackIntent=false;this.queuedUntil=0;this.facing=Math.sign(direction);
   this.x=clampX(this.x+direction*HUNT_RULES.moveSpeed*dt);this.pose('run1');return;
  }
  if(this.enemyHP>0&&(this.auto||this.attackHeld||this.attackIntent||this.queuedUntil>this.elapsed)){
   this.queuedUntil=0;this.attackIntent=true;
   const distance=Math.abs(this.enemyX-this.x);this.facing=Math.sign(this.enemyX-this.x)||this.facing;
   if(distance<=HUNT_RULES.attackRange){this.attack();return;}
   if(HUNT_RULES.useRush&&distance>=HUNT_RULES.rushMin&&distance<=HUNT_RULES.rushMax){
    const destination=clampX(this.enemyX-this.facing*HUNT_RULES.stopRange);
    const duration=Math.abs(destination-this.x)/HUNT_RULES.rushSpeed;
    if(duration>0)this.start({kind:'rush',start:this.elapsed,duration,target:this.enemySerial,
     segments:[{animation:'dash',duration}],phase:0,hits:[],destination,speed:HUNT_RULES.rushSpeed});
   }else{
    this.x=clampX(this.x+this.facing*Math.min(HUNT_RULES.moveSpeed*dt,Math.max(0,distance-HUNT_RULES.stopRange)));
    this.pose('run1');
   }
   return;
  }
  this.pose('stay1');
 }
 attack(skill=-1){
  if(this.paused||!Number.isInteger(skill)||skill< -1||skill>=6)return false;
  if(this.motion){
   if(skill===-1&&this.motion.kind==='attack'&&this.actionUntil-this.elapsed<=HUNT_RULES.inputBuffer){
    this.queuedUntil=this.actionUntil+HUNT_RULES.inputBuffer;return true;
   }
   return false;
  }
  if(this.elapsed+1e-8<this.attackReady||skill>=0&&this.cooldowns[skill]>0)return false;
  if(skill===-1&&this.enemyHP<=0)return false;
  if(skill===-1&&Math.abs(this.enemyX-this.x)>HUNT_RULES.attackRange){this.attackIntent=true;return true;}
  this.facing=Math.sign(this.enemyX-this.x)||this.facing;this.attackIntent=false;
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(skill===-1){
   const stage=this.combo[this.comboIndex],duration=stage.duration??motions.durations[stage.animation];
   this.comboStage=this.comboIndex+1;this.comboIndex=(this.comboIndex+1)%this.combo.length;
   this.comboExpires=this.elapsed+duration+HUNT_RULES.comboReset;this.attackReady=this.elapsed+Math.max(duration,HUNT_RULES.minAttackDelay);
   this.start({kind:'attack',start:this.elapsed,duration,target:this.enemySerial,
    segments:[{animation:stage.animation,duration}],phase:0,
    hits:[{at:stage.hitAt,damage:stage.damage,range:HUNT_RULES.attackRange,done:false}]});
  }else{
   this.resetCombo();this.cooldowns[skill]=SKILL_COOLDOWNS[skill];
   const names=skill===4?['skill5','skill5_loop','skill5_end']:['skill1','skill2','skill3','skill4','skill5','rest1'].slice(skill,skill+1);
   const segments=names.map(animation=>({animation,duration:motions.durations[animation as keyof typeof motions.durations]}));
   const duration=segments.reduce((n,s)=>n+s.duration,0);this.attackReady=this.elapsed+duration;
   this.start({kind:'skill',start:this.elapsed,duration,target:this.enemySerial,segments,phase:0,
    hits:[{at:duration*.55,damage:40,range:330,done:false,heal:skill===5}]});
  }
  return true;
 }
 dodge(direction:number){
  if(this.paused||this.elapsed<this.dodgeReady||this.motion||!Number.isFinite(direction)||!direction)return false;
  this.clearInput();this.resetCombo();this.facing=direction<0?-1:1;
  const duration=motions.durations.avoid1,destination=clampX(this.x+this.facing*HUNT_RULES.dodgeDistance);
  this.start({kind:'dodge',start:this.elapsed,duration,target:this.enemySerial,segments:[{animation:'avoid1',duration}],
   phase:0,hits:[],destination,speed:HUNT_RULES.dodgeDistance/duration});
  this.dodgeReady=this.elapsed+HUNT_RULES.dodgeCooldown;return true;
 }
}
