import {HUNT_RULES,motions,SKILL_COOLDOWNS,WORLD_WIDTH,type ComboStage} from './combat-rules';
import {bodySeparation,planDodge,sweepHero} from './hunt-collision';
import {awardHuntKill,DEFAULT_HUNT_BALANCE,heroStats,newHuntProgress,type HuntBalance,type HuntProgress} from './hunt-progression';
export {SKILL_COOLDOWNS,WORLD_WIDTH} from './combat-rules';
type Motion={kind:'attack'|'skill'|'rush'|'dodge';start:number;duration:number;target:number;
 segments:{animation:string;duration:number}[];phase:number;hits:{at:number;damage:number;range:number;done:boolean;heal?:boolean}[];
 destination?:number;speed?:number;origin?:number};
const clampX=(x:number)=>Math.max(65,Math.min(WORLD_WIDTH-65,x));
export type HuntEnemy={slot:number;x:number;hp:number;maxHP:number;serial:number;respawnAt:number;lastDamage:number;hitUntil:number;
 state:'idle'|'walk'|'windup'|'recover'|'dead';attackAt:number;nextAttack:number};
export type HuntOptions={hostile?:boolean;progress?:HuntProgress;balance?:HuntBalance;range?:number;crit?:number;seed?:number};
/** Browser-local restoration scaffold. Original formulas/config remain unresolved. */
export class HuntEngine {
 x=620;facing=1;hp=100;
 readonly enemies:HuntEnemy[];private targetSlot=0;
 private get target(){return this.enemies[this.targetSlot];}
 get enemyX(){return this.target.x;}set enemyX(v:number){this.target.x=v;}
 get enemyHP(){return this.target.hp;}set enemyHP(v:number){this.target.hp=v;}
 get enemySerial(){return this.target.serial;}set enemySerial(v:number){this.target.serial=v;}
 get respawnAt(){return this.target.respawnAt;}set respawnAt(v:number){this.target.respawnAt=v;}
 get lastDamage(){return this.target.lastDamage;}set lastDamage(v:number){this.target.lastDamage=v;}
 get hitUntil(){return this.target.hitUntil;}set hitUntil(v:number){this.target.hitUntil=v;}
 elapsed=0;kills=0;coins=0;xp=0;auto=false;paused=false;
 action='stay1';actionSerial=0;animationSpeed=1;actionUntil=0;
 cooldowns=[0,0,0,0,0,0];dodgeReady=0;attackReady=0;
 comboStage=0;attackHeld=false;
 deadAt=-1;lastHeroDamage=0;heroHitUntil=0;parryUntil=0;parryReady=0;critical=false;
 potionReady=0;
 readonly progress:HuntProgress;readonly balance:HuntBalance;readonly hostile:boolean;
 private rng:number;private range:number;private crit:number;
 get stats(){return heroStats(this.progress);}
 get maxHP(){return this.hostile?this.stats.maxHP:100;}
 private motion:Motion|null=null;
 private comboIndex=0;private comboExpires=0;private queuedUntil=0;private attackIntent=false;
 readonly combo:readonly ComboStage[];
 constructor(combo:readonly ComboStage[]=HUNT_RULES.combo,enemyCount=7,options:HuntOptions={}){
  this.progress=options.progress??newHuntProgress();this.balance=options.balance??DEFAULT_HUNT_BALANCE;
  this.hostile=options.hostile??false;this.rng=(options.seed??12345)>>>0;this.range=options.range??HUNT_RULES.attackRange;this.crit=options.crit??.1;
  this.hp=this.maxHP;this.coins=this.progress.gold;this.xp=this.progress.xp;this.kills=this.progress.kills;
  if(!Number.isInteger(enemyCount)||enemyCount<1||enemyCount>7)throw Error('Invalid monster count');
  const positions=[780,700,860,540,940,460,1020];
  this.enemies=positions.slice(0,enemyCount).map((x,slot)=>({slot,x,hp:100,maxHP:100,serial:slot+1,respawnAt:0,lastDamage:0,hitUntil:0,
   state:'idle',attackAt:0,nextAttack:1+slot*.15}));
  if(!combo.length||combo.some(s=>!motions.durations[s.animation]||!Number.isFinite(s.hitAt)
   ||s.hitAt<0||s.hitAt>(s.duration??motions.durations[s.animation])
   ||s.duration!==undefined&&(!Number.isFinite(s.duration)||s.duration<motions.durations[s.animation])
   ||!Number.isFinite(s.damage)||s.damage<=0))throw Error('Invalid combo profile');
  this.combo=combo.map(s=>({...s}));
 }
 private moveTo(destination:number){this.x=sweepHero(this.x,clampX(destination),this.enemies);}
 private selectTarget(){
  if(this.motion)return; // In-flight hits must retain their original target identity.
  const alive=this.enemies.filter(e=>e.hp>0);
  if(alive.length)this.targetSlot=alive.reduce((a,b)=>Math.abs(b.x-this.x)<Math.abs(a.x-this.x)?b:a).slot;
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
  if(this.hostile){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;this.critical=this.rng/4294967296<this.crit;
   damage=Math.max(1,Math.round(damage*this.stats.attack/20*(this.critical?this.stats.critMultiplier:1)));}
  this.lastDamage=Math.min(damage,this.enemyHP);this.hitUntil=this.elapsed+.75;
  this.enemyHP=Math.max(0,this.enemyHP-damage);
  if(this.enemyHP===0){this.target.state='dead';
   if(this.hostile){awardHuntKill(this.progress,this.balance);this.kills=this.progress.kills;this.coins=this.progress.gold;this.xp=this.progress.xp;}
   else {this.kills++;this.coins+=25;this.xp+=12;}
   this.respawnAt=this.elapsed+2;
   this.attackIntent=false;this.resetCombo();}
 }
 private advanceEnemies(dt:number){
  for(const enemy of this.enemies){
   if(enemy.hp<=0)continue;
   const distance=Math.abs(enemy.x-this.x);
   if(enemy.state==='windup'){
    if(this.elapsed>=enemy.attackAt){
     enemy.state='recover';enemy.nextAttack=this.elapsed+1.3;
     if(distance<=bodySeparation+20&&this.motion?.kind!=='dodge'){
      if(this.parryUntil>=this.elapsed){enemy.nextAttack=this.elapsed+2;continue;}
      if(this.heroHitUntil>this.elapsed)continue;
      const damage=Math.max(1,Math.round(12-this.stats.defense*.5));
      this.lastHeroDamage=Math.min(this.hp,damage);this.hp=Math.max(0,this.hp-damage);this.heroHitUntil=this.elapsed+.2;
      if(this.hp===0){this.deadAt=this.elapsed;this.motion=null;this.clearInput();this.resetCombo();this.auto=false;this.pose('die1',true);return;}
     }
    }
    continue;
   }
   if(this.elapsed<enemy.nextAttack){enemy.state='recover';continue;}
   if(distance<=bodySeparation+12){enemy.state='windup';enemy.attackAt=this.elapsed+.55;continue;}
   if(distance>360){enemy.state='idle';continue;}
   enemy.state='walk';
   // Freeze translation during a roll, so neither its origin nor landing is occupied underneath it.
   if(this.motion?.kind==='dodge')continue;
   const direction=Math.sign(this.x-enemy.x),travel=Math.min(45*dt,Math.max(0,distance-bodySeparation));
   let next=enemy.x+direction*travel;
   for(const other of this.enemies){if(other===enemy||other.hp<=0)continue;
    if(direction>0&&other.x>enemy.x&&next>other.x-24)next=Math.min(next,other.x-24);
    if(direction<0&&other.x<enemy.x&&next<other.x+24)next=Math.max(next,other.x+24);}
   if(direction*(next-enemy.x)>0)enemy.x=clampX(next);
  }
 }
 parry(){if(this.paused||this.hp<=0||this.elapsed<this.parryReady||this.motion)return false;
  this.parryUntil=this.elapsed+.3;this.parryReady=this.elapsed+1.5;return true;}
 usePotion(){if(this.hp<=0||this.hp>=this.maxHP||this.elapsed<this.potionReady||this.progress.potions<=0)throw Error('HP가 감소한 상태에서 물약을 사용할 수 있습니다. 재사용 대기시간은 2초입니다.');
  this.progress.potions--;this.hp=Math.min(this.maxHP,this.hp+Math.ceil(this.maxHP*.4));this.potionReady=this.elapsed+2;}
 revive(){if(this.hp>0||this.elapsed-this.deadAt<2)return false;
  const spot=Array.from({length:64},(_,i)=>65+i*36).find(x=>this.enemies.every(e=>e.hp<=0||Math.abs(e.x-x)>=bodySeparation));
  if(spot===undefined)return false;
  this.x=spot;this.hp=this.maxHP;this.heroHitUntil=this.elapsed+2;this.lastHeroDamage=0;this.motion=null;this.clearInput();this.resetCombo();
  for(const e of this.enemies){e.state=e.hp>0?'idle':'dead';e.nextAttack=this.elapsed+2;}
  this.pose('stay1',true);return true;}
 private advanceMotion(dt:number,direction:number){
  const m=this.motion;if(!m)return;
  if(m.kind==='rush'&&(direction!==0||this.enemyHP<=0||m.target!==this.enemySerial)){
   this.motion=null;this.actionUntil=this.elapsed;this.attackIntent=false;this.pose('stay1');return;
  }
  if(m.destination!==undefined&&m.speed!==undefined){
   const delta=m.destination-this.x;
   const next=clampX(this.x+Math.sign(delta)*Math.min(Math.abs(delta),m.speed*dt));
   if(m.kind==='dodge')this.x=next;else this.moveTo(next);
  }
  const age=this.elapsed-m.start;
  for(const hit of m.hits){
   if(hit.done||age+1e-8<hit.at)continue;hit.done=true;
   if(hit.heal){this.hp=Math.min(this.maxHP,this.hp+25);continue;}
   if(m.target===this.enemySerial&&this.enemyHP>0&&Math.abs(this.enemyX-this.x)<=hit.range
    &&(this.enemyX-this.x)*this.facing>=0
    &&!this.enemies.some(e=>e.hp>0&&e.serial!==m.target&&(e.x-this.x)*this.facing>0
     &&Math.abs(e.x-this.x)<Math.abs(this.enemyX-this.x)))this.hurt(hit.damage);
  }
  let end=0,phase=m.segments.length-1;
  for(let i=0;i<m.segments.length;i++){end+=m.segments[i].duration;if(age<end-1e-8){phase=i;break;}}
  if(m.phase!==phase){m.phase=phase;this.pose(m.segments[phase].animation,true);}
  if(age+1e-8>=m.duration){
   if(m.destination!==undefined){
    if(m.kind==='dodge'){
     // Recheck landing in case a target was repositioned while the roll played.
     this.x=planDodge(m.origin??this.x,clampX(m.destination),this.enemies).destination;
    }else this.moveTo(m.destination);
   }
   this.motion=null;this.actionUntil=this.elapsed;this.pose('stay1');
  }
 }
 step(dt:number,direction:number){
  if(this.paused)return;
  dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05));
  direction=Number.isFinite(direction)?Math.max(-1,Math.min(1,direction)):0;
  this.elapsed+=dt;this.cooldowns=this.cooldowns.map(t=>Math.max(0,t-dt));
  if(this.hp<=0)return;
  for(const enemy of this.enemies)if(enemy.hp<=0&&this.elapsed>=enemy.respawnAt){
   const spawnX=this.enemies.length===1?Math.min(WORLD_WIDTH-90,Math.max(90,this.x+this.facing*230)):enemy.x;
   const roll=this.motion?.kind==='dodge'?this.motion:null;
   if(roll&&spawnX>Math.min(roll.origin??this.x,roll.destination??this.x)-bodySeparation&&spawnX<Math.max(roll.origin??this.x,roll.destination??this.x)+bodySeparation){enemy.respawnAt=this.elapsed+.25;continue;}
   // Never respawn a solid enemy around the player (including during a roll).
   if(Math.abs(spawnX-this.x)<bodySeparation){enemy.respawnAt=this.elapsed+.25;continue;}
   enemy.hp=enemy.maxHP;enemy.serial+=this.enemies.length;enemy.hitUntil=0;enemy.state='idle';enemy.nextAttack=this.elapsed+1;
   if(this.enemies.length===1)enemy.x=Math.min(WORLD_WIDTH-90,Math.max(90,this.x+this.facing*230));
  }
  if(this.hostile)this.advanceEnemies(dt);
  if(this.hp<=0)return;
  this.advanceMotion(dt,direction);
  if(this.motion)return;
  this.selectTarget();
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(direction){
   this.attackIntent=false;this.queuedUntil=0;this.facing=Math.sign(direction);
   this.moveTo(this.x+direction*HUNT_RULES.moveSpeed*dt);this.pose('run1');return;
  }
  if(this.enemyHP>0&&(this.auto||this.attackHeld||this.attackIntent||this.queuedUntil>this.elapsed)){
   this.queuedUntil=0;this.attackIntent=true;
   const distance=Math.abs(this.enemyX-this.x);this.facing=Math.sign(this.enemyX-this.x)||this.facing;
   if(distance<=this.range){this.attack();return;}
   if(HUNT_RULES.useRush&&distance>=HUNT_RULES.rushMin&&distance<=HUNT_RULES.rushMax){
    const destination=sweepHero(this.x,clampX(this.enemyX-this.facing*HUNT_RULES.stopRange),this.enemies);
    const duration=Math.abs(destination-this.x)/HUNT_RULES.rushSpeed;
    if(duration>0)this.start({kind:'rush',start:this.elapsed,duration,target:this.enemySerial,
     segments:[{animation:'dash',duration}],phase:0,hits:[],destination,speed:HUNT_RULES.rushSpeed});
   }else{
    this.moveTo(this.x+this.facing*Math.min(HUNT_RULES.moveSpeed*dt,Math.max(0,distance-HUNT_RULES.stopRange)));
    this.pose('run1');
   }
   return;
  }
  this.pose('stay1');
 }
 attack(skill=-1){
  if(this.paused||this.hp<=0||!Number.isInteger(skill)||skill< -1||skill>=6)return false;
  if(this.motion){
   if(skill===-1&&this.motion.kind==='attack'&&this.actionUntil-this.elapsed<=HUNT_RULES.inputBuffer){
    this.queuedUntil=this.actionUntil+HUNT_RULES.inputBuffer;return true;
   }
   return false;
  }
  this.selectTarget();
  if(this.elapsed+1e-8<this.attackReady||skill>=0&&this.cooldowns[skill]>0)return false;
  if(skill===-1&&this.enemyHP<=0)return false;
  if(skill===-1&&Math.abs(this.enemyX-this.x)>this.range){this.attackIntent=true;return true;}
  this.facing=Math.sign(this.enemyX-this.x)||this.facing;this.attackIntent=false;
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(skill===-1){
   const stage=this.combo[this.comboIndex],duration=stage.duration??motions.durations[stage.animation];
   this.comboStage=this.comboIndex+1;this.comboIndex=(this.comboIndex+1)%this.combo.length;
   this.comboExpires=this.elapsed+duration+HUNT_RULES.comboReset;this.attackReady=this.elapsed+Math.max(duration,HUNT_RULES.minAttackDelay);
   this.start({kind:'attack',start:this.elapsed,duration,target:this.enemySerial,
    segments:[{animation:stage.animation,duration}],phase:0,
    hits:[{at:stage.hitAt,damage:stage.damage,range:this.range,done:false}]});
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
  if(this.paused||this.hp<=0||this.elapsed<this.dodgeReady||this.motion||!Number.isFinite(direction)||!direction)return false;
  this.clearInput();this.resetCombo();this.facing=direction<0?-1:1;
  const duration=motions.durations.avoid1;
  const destination=planDodge(this.x,clampX(this.x+this.facing*HUNT_RULES.dodgeDistance),this.enemies).destination;
  this.start({kind:'dodge',start:this.elapsed,duration,target:this.enemySerial,segments:[{animation:'avoid1',duration}],
   phase:0,hits:[],origin:this.x,destination,speed:Math.abs(destination-this.x)/duration});
  this.dodgeReady=this.elapsed+HUNT_RULES.dodgeCooldown;return true;
 }
}
