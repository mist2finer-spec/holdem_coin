import {relativeStat,accuracy,effectDuration} from './hunt-formulas';
import {canUseAttack,castCommands,sweptHit,markHit,type Cast,type Impactor,type MonsterAttack} from './hunt-actions';
import {roundEven} from './hunt-math';
import {LABYRINTH,stageDefinition,classDamage,type LabyrinthView} from './hunt-labyrinth';
import {HUNT_STAGE,HUNT_MONSTER,HUNT_MONSTER_ATTACK} from './hunt-tables';
import {HUNT_RULES,motions,SKILL_COOLDOWNS,WORLD_WIDTH,type ComboStage} from './combat-rules';
import {bodySeparation,separation,planDodge,sweepHero} from './hunt-collision';
import {awardHuntKill,awardStageClear,DEFAULT_HUNT_BALANCE,heroStats,newHuntProgress,type HuntBalance,type HuntProgress} from './hunt-progression';
export {SKILL_COOLDOWNS,WORLD_WIDTH} from './combat-rules';
type Motion={kind:'attack'|'skill'|'rush'|'dodge';start:number;duration:number;target:number;
 segments:{animation:string;duration:number}[];phase:number;animationRate?:number;hits:{at:number;damage:number;range:number;done:boolean;heal?:boolean}[];
 destination?:number;speed?:number;origin?:number};
const clampX=(x:number)=>Math.max(65,Math.min(WORLD_WIDTH-65,x));
export type HuntEnemy={slot:number;x:number;hp:number;maxHP:number;serial:number;respawnAt:number;lastDamage:number;hitUntil:number;
 actorType?:number;boss?:boolean;asset?:string;damage?:number;windup?:number;recovery?:number;moveSpeed?:number;radius?:number;valor?:number;mental?:number;tenacity?:number;focus?:number;skills?:number[];aiType?:number;clip?:string;castSerial?:number;motionEvent?:number;shield?:number;
 state:'idle'|'walk'|'windup'|'recover'|'dead';attackAt:number;nextAttack:number};
export type HuntOptions={campaign?:boolean;hostile?:boolean;progress?:HuntProgress;balance?:HuntBalance;range?:number;crit?:number;seed?:number;tempo?:number};
/** Authoritative finite-stage combat; unverified native branches remain explicit adapters. */
export class HuntEngine {
 x=620;facing=1;hp=100;
 readonly enemies:HuntEnemy[];private targetSlot=0;
 readonly campaign:boolean;private stageIndex=0;private stagePhase:LabyrinthView["phase"]="normal";private nextStageAt=0;
 private stageStarted=0;private stageKills=0;private spawnCounter=0;private objectiveObjects:{id:number;x:number;done:boolean}[]=[];
 private escort:{x:number;hp:number;maxHP:number}|null=null;private failure='';
 private casts=new Map<number,Cast>();private ready=new Map<number,Record<number,number>>();private uses=new Map<number,Record<number,number>>();
 impactors:Impactor[]=[];private impactorId=0;heroShield=0;heroStunUntil=0;heroInvincibleUntil=0;
 get stage():LabyrinthView{const id=stageDefinition(this.stageIndex).id;const d=stageDefinition(this.stageIndex);return {id,chapter:Math.floor(id/100),section:id%100,phase:this.stagePhase,remaining:this.enemies.filter(e=>e.hp>0).length,total:this.stagePhase==='normal'?6:1,nextIn:Math.max(0,this.nextStageAt-this.elapsed),
 objective:({1:'모든 적 처치',2:'목표 수 처치',3:'보스 처치',4:'출구 도달',5:'오브젝트 완료',6:'장치 작동',7:'동료 보호 및 처치'} as Record<number,string>)[d.victory]??'전투',goal:d.goal||this.objectiveObjects.length||7,done:[5,6].includes(d.victory)?this.objectiveObjects.filter(o=>o.done).length:this.stageKills,remainingTime:d.timeLimit>0?Math.max(0,d.timeLimit-(this.elapsed-this.stageStarted)):null,failure:this.failure,objects:this.objectiveObjects.map(o=>({...o})),exitX:d.victory===4?WORLD_WIDTH-160:null,escort:this.escort?{...this.escort}:null};}
 private get targetRange(){return this.range+Math.max(0,(this.target.radius??12)-12);}
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
 private get attackTempo(){return this.tempo*(this.hostile?this.stats.attackSpeed:1);}
 private rng:number;private range:number;private crit:number;private tempo:number;
 get stats(){return heroStats(this.progress);}
 get maxHP(){return this.hostile?this.stats.maxHP:100;}
 private motion:Motion|null=null;
 private comboIndex=0;private comboExpires=0;private queuedUntil=0;private attackIntent=false;
 combo:readonly ComboStage[];
 get visualTiming(){const m=this.motion;return m?{startedAt:m.start,duration:m.duration,hitAt:m.hits[0]?.at??.2}:{startedAt:this.elapsed,duration:0,hitAt:.2};}
 configureLoadout(combo:readonly ComboStage[],range:number,crit:number,tempo:number){
  if(!combo.length||!Number.isFinite(range)||range<=0||!Number.isFinite(crit)||crit<0||crit>1||!Number.isFinite(tempo)||tempo<.5||tempo>2)throw Error('Invalid loadout');
  this.combo=combo.map(s=>({...s}));this.range=range;this.crit=crit;this.tempo=tempo;this.motion=null;this.clearInput();this.resetCombo();
  this.attackReady=Math.max(this.attackReady,this.elapsed+.12);this.pose('stay1',true);
 }
 constructor(combo:readonly ComboStage[]=HUNT_RULES.combo,enemyCount=HUNT_STAGE.maxAlive,options:HuntOptions={}){
  this.campaign=options.campaign??false;
  this.progress=options.progress??newHuntProgress();this.balance=options.balance??DEFAULT_HUNT_BALANCE;
  this.tempo=options.tempo??1;if(!Number.isFinite(this.tempo)||this.tempo<.5||this.tempo>2)throw Error('Invalid tempo');
  this.hostile=options.hostile??false;this.rng=(options.seed??12345)>>>0;this.range=options.range??HUNT_RULES.attackRange;this.crit=options.crit??.1;
  this.hp=this.maxHP;this.coins=this.progress.gold;this.xp=this.progress.xp;this.kills=this.progress.kills;
  if(!Number.isInteger(enemyCount)||enemyCount<1||enemyCount>7)throw Error('Invalid monster count');
  const positions=this.hostile&&enemyCount===HUNT_STAGE.maxAlive?HUNT_STAGE.spawns:[780,700,860,540,940,460,1020];
  this.enemies=positions.slice(0,enemyCount).map((x,slot)=>({slot,x,hp:HUNT_MONSTER.maxHP,maxHP:HUNT_MONSTER.maxHP,serial:slot+1,respawnAt:0,lastDamage:0,hitUntil:0,
   state:'idle',attackAt:0,nextAttack:1+slot*.15}));
  if(!combo.length||combo.some(s=>!motions.durations[s.animation]||!Number.isFinite(s.hitAt)
   ||s.hitAt<0||s.hitAt>(s.duration??motions.durations[s.animation])
   ||s.duration!==undefined&&(!Number.isFinite(s.duration)||s.duration<motions.durations[s.animation])
   ||!Number.isFinite(s.damage)||s.damage<=0))throw Error('Invalid combo profile');
  this.combo=combo.map(s=>({...s}));
  if(this.campaign){if(enemyCount!==7)throw Error("Campaign requires seven slots");this.stageIndex=this.progress.labyrinthStage;if(this.progress.labyrinthCompleted)this.stagePhase="complete";this.loadStage();}
 }
 private loadStage(){
  this.stageStarted=this.elapsed;this.stageKills=0;this.spawnCounter=0;this.failure='';this.casts.clear();this.ready.clear();this.uses.clear();this.impactors=[];this.heroShield=0;this.heroStunUntil=0;this.heroInvincibleUntil=0;
  const stage=stageDefinition(this.stageIndex);this.objectiveObjects=(stage.objectIds??[]).map((id,i,a)=>({id,x:1400+i*3000/Math.max(1,a.length-1),done:false}));this.escort=stage.victory===7?{x:500,hp:this.maxHP,maxHP:this.maxHP}:null;this.x=620;this.targetSlot=0;this.motion=null;this.clearInput();this.resetCombo();this.pose('stay1',true);
  const boss=stage.boss;const positions=[850,1250,1750,2300,2950,3650,4550];
  for(let i=0;i<7;i++){
   const [actorType,attack,hp]=i===6?boss:stage.normal[i%stage.normal.length];const profile=LABYRINTH.monsters[actorType];
   const rate=this.stats.abilities[i===6?45:44]??0;const maxHP=Math.max(1,roundEven(hp*(1-Math.max(0,rate)/100)));
   Object.assign(this.enemies[i],{actorType,boss:i===6,asset:profile.asset,damage:attack,radius:profile.radius,valor:((i===6?boss:stage.normal[i%stage.normal.length])[5]??[])[0]??0,mental:((i===6?boss:stage.normal[i%stage.normal.length])[5]??[])[1]??0,tenacity:((i===6?boss:stage.normal[i%stage.normal.length])[5]??[])[2]??0,focus:((i===6?boss:stage.normal[i%stage.normal.length])[5]??[])[3]??0,skills:(i===6?boss:stage.normal[i%stage.normal.length])[4]||profile.skills,aiType:((i===6?boss:stage.normal[i%stage.normal.length])[3] as number)||profile.aiType,shield:0,clip:undefined,castSerial:0,windup:profile.windup,recovery:profile.recovery,moveSpeed:profile.move,
    x:positions[i],hp:i===6||this.stagePhase==='complete'?0:maxHP,maxHP,serial:(this.stageIndex+1)*100+i,respawnAt:0,lastDamage:0,hitUntil:0,state:i===6?'dead':'idle',nextAttack:this.elapsed+1});
  }
  for(const e of this.enemies)if(!e.skills?.length)e.skills=LABYRINTH.monsters[e.actorType!].skills;
  if([2,7].includes(stage.victory))this.spawnWave();
 }
 private spawnWave(){
  const d=stageDefinition(this.stageIndex),count=Math.min(6,Math.max(0,d.goal-this.stageKills)),dir=this.x<WORLD_WIDTH/2?1:-1;this.casts.clear();this.impactors=[];
  for(const e of this.enemies){e.hp=0;e.state='dead';if(e.slot>=count)continue;e.boss=false;e.serial=1000000+(this.stageIndex*10000)+(++this.spawnCounter);e.hp=e.maxHP;e.state='idle';e.x=clampX(this.x+dir*(180+e.slot*100));e.nextAttack=this.elapsed+1;}
 }
 private failStage(reason:string){this.failure=reason;this.stagePhase='failed';this.hp=0;this.deadAt=this.elapsed;this.motion=null;this.casts.clear();this.impactors=[];this.clearInput();this.auto=false;this.pose('die1',true);}
 private completeStage(){
  awardStageClear(this.progress,this.balance,stageDefinition(this.stageIndex).reward);this.coins=this.progress.gold;this.xp=this.progress.xp;
  if(this.stageIndex===LABYRINTH.stages.length-1){this.progress.labyrinthCompleted=1;this.stagePhase='complete';}
  else {this.progress.labyrinthStage=this.stageIndex+1;this.stagePhase='cleared';this.nextStageAt=this.elapsed+2;}
  this.casts.clear();this.impactors=[];this.motion=null;this.resetCombo();this.clearInput();this.pose('stay1',true);
 }
 interact(){if(!this.campaign||this.hp<=0||this.stagePhase==='cleared'||this.stagePhase==='complete')return false;const o=this.objectiveObjects.find(o=>!o.done&&Math.abs(o.x-this.x)<=80);if(!o)return false;o.done=true;const definition=stageDefinition(this.stageIndex).entityObjects.find(e=>e.id===o.id);if(definition){for(const [type,value] of [[definition.globalType,definition.globalValue],[definition.globalType2,definition.globalValue2]])for(const e of this.enemies){if((type===111||type===112)&&!e.boss)continue;if(type===101||type===111)e.damage=Math.max(0,(e.damage??1)*(1+value/100));if(type===102||type===112){e.maxHP=Math.max(1,roundEven(e.maxHP*(1+value/100)));if(e.hp>0)e.hp=Math.max(1,roundEven(e.hp*(1+value/100)));}}}return true;}
 private advanceStage(){
  if(this.stagePhase==='complete'||this.stagePhase==='failed')return;
  if(this.stagePhase==='cleared'){
   if(this.elapsed>=this.nextStageAt){this.stageIndex=this.progress.labyrinthStage;this.stagePhase='normal';this.loadStage();}return;
  }
  const d=stageDefinition(this.stageIndex);
  if(d.victory===7&&(!this.escort||this.escort.hp<=0)){this.failStage('동료 전투 불능');return;}
  if(d.timeLimit>0&&this.elapsed-this.stageStarted>=d.timeLimit){this.failStage('제한 시간 초과');return;}
  if(d.victory===4&&this.x>=WORLD_WIDTH-200||[5,6].includes(d.victory)&&this.objectiveObjects.length>0&&this.objectiveObjects.every(o=>o.done)||[2,7].includes(d.victory)&&this.stageKills>=d.goal){this.completeStage();return;}
  if(this.enemies.some(e=>e.hp>0))return;
  if([2,7].includes(d.victory)){this.spawnWave();return;}
  if([4,5,6].includes(d.victory))return;
  if(this.stagePhase==='normal'){
   this.stagePhase='boss';const boss=this.enemies[6];boss.hp=boss.maxHP;boss.state='idle';boss.nextAttack=this.elapsed+1;this.targetSlot=6;return;
  }
  this.completeStage();
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
  m.animationRate=m.kind==='attack'||m.kind==='skill'?this.attackTempo:this.tempo;
  this.motion=m;this.actionUntil=this.elapsed+m.duration;
  this.pose(m.segments[0].animation,true,m.kind==='rush'?motions.durations.dash/m.duration:m.animationRate??this.tempo);
 }
 private hurt(damage:number,skill=false,target=this.target){
  if(this.campaign&&accuracy(this.stats.focus,target.focus??0)<1){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;if(this.rng/4294967296>=accuracy(this.stats.focus,target.focus??0)){target.lastDamage=0;target.hitUntil=this.elapsed+.3;return;}}
  if(this.hostile){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;this.critical=this.rng/4294967296<Math.max(0,Math.min(.9,this.stats.crit+this.crit-.1));
   damage=Math.max(1,Math.round(damage*this.stats.attack/6*(1+relativeStat(skill?this.stats.mental:this.stats.valor,skill?(target.mental??0):(target.valor??0),skill?'Mental':'Valor'))*(skill?this.stats.skillDamageMultiplier:this.stats.basicDamageMultiplier)*(this.critical?this.stats.critMultiplier:1)));}
  if(this.campaign)damage=Math.max(1,Math.round(classDamage(damage,this.stats.abilities,!!target.boss)));
  const absorbed=Math.min(target.shield??0,damage);target.shield=(target.shield??0)-absorbed;damage-=absorbed;
  target.lastDamage=Math.min(damage,target.hp);target.hitUntil=this.elapsed+.75;
  target.hp=Math.max(0,target.hp-damage);
  if(target.hp===0){target.state='dead';this.stageKills++;this.casts.delete(target.serial);
   if(this.hostile){awardHuntKill(this.progress,this.balance);this.kills=this.progress.kills;this.coins=this.progress.gold;this.xp=this.progress.xp;}
   else {this.kills++;this.coins+=25;this.xp+=12;}
   target.respawnAt=this.elapsed+HUNT_MONSTER.respawnSeconds;
   this.attackIntent=false;this.resetCombo();}
 }
 private advanceRecoveredEnemies(dt:number){
  if(this.escort){this.escort.x=Math.max(65,this.x-110);if(this.escort.hp<=0){this.failStage('동료 전투 불능');return;}}
  for(const enemy of this.enemies){
   if(enemy.hp<=0){this.casts.delete(enemy.serial);continue;}
   const cast=this.casts.get(enemy.serial);
   if(cast){
    const index=cast.skill.animations.findLastIndex(a=>a.at<=this.elapsed-cast.start);if(index>=0&&enemy.motionEvent!==index){enemy.motionEvent=index;enemy.clip=cast.skill.animations[index].clip;enemy.castSerial=(enemy.castSerial??0)+1;}
    for(const command of castCommands(cast,this.elapsed)){
     if(this.impactors.length>=256)break;
     const direction=Math.sign(cast.targetX-enemy.x)||1;
     const x=command.startOrigin===2||command.startOrigin===5?cast.targetX:enemy.x+direction*command.width*.45;
     const targetX=command.targetOrigin===11?x:cast.targetX;
     const life=command.duration>0?Math.min(60,command.duration):command.speed>0?Math.abs(targetX-x)/command.speed+.12:.15;
     this.impactors.push({id:++this.impactorId,source:enemy.serial,x,targetX,direction,command,born:this.elapsed,expires:this.elapsed+life,hits:{}});
    }
    if(this.elapsed-cast.start>=cast.skill.duration){this.casts.delete(enemy.serial);enemy.state='recover';const cfg=LABYRINTH.ai[enemy.aiType??0];this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;enemy.nextAttack=this.elapsed+(cfg?cfg.waitMin+(cfg.waitMax-cfg.waitMin)*this.rng/4294967296:.1);}
    continue;
   }
   if(this.elapsed<enemy.nextAttack){enemy.state='recover';continue;}
   const ready=this.ready.get(enemy.serial)??{},uses=this.uses.get(enemy.serial)??{};
   const candidates=(enemy.skills??[]).map(id=>LABYRINTH.actions[id]).filter((a):a is MonsterAttack=>!!a&&(!(a.tag&1)||enemy.hp/enemy.maxHP<.7)&&a.commands.some(c=>c.effects.some(e=>[1,2,3,104,105,106,107,111].includes(e.type)))&&(a.mp===0)&&this.elapsed>=(ready[a.id]??0)&&canUseAttack(a,enemy.hp/enemy.maxHP*100,this.elapsed-this.stageStarted,uses));
   candidates.sort((a,b)=>(a.tag&64?0:a.tag&128?2:1)-(b.tag&64?0:b.tag&128?2:1));
   const attack=candidates[0];if(!attack){enemy.state='idle';continue;}
   const target=this.escort&&Math.abs(this.escort.x-enemy.x)<Math.abs(this.x-enemy.x)?this.escort.x:this.x;
   const distance=Math.abs(target-enemy.x);
   if(distance<=Math.max(separation(enemy)+20,attack.range)){
    enemy.state='windup';enemy.motionEvent=-1;enemy.clip=attack.clip;enemy.castSerial=(enemy.castSerial??0)+1;enemy.attackAt=this.elapsed+(attack.commands[0]?.at??0);
    this.casts.set(enemy.serial,{skill:attack,start:this.elapsed,source:enemy.serial,targetX:target,emitted:new Set()});ready[attack.id]=this.elapsed+attack.cooldown;uses[attack.id]=(uses[attack.id]??0)+1;this.ready.set(enemy.serial,ready);this.uses.set(enemy.serial,uses);continue;
   }
   enemy.state='walk';if(this.motion?.kind==='dodge')continue;
   const direction=Math.sign(target-enemy.x),travel=Math.min((enemy.moveSpeed??45)*this.tempo*dt,Math.max(0,distance-separation(enemy)));
   let next=enemy.x+direction*travel;
   for(const other of this.enemies){if(other===enemy||other.hp<=0)continue;const gap=(enemy.radius??12)+(other.radius??12);if(direction>0&&other.x>enemy.x)next=Math.min(next,other.x-gap);if(direction<0&&other.x<enemy.x)next=Math.max(next,other.x+gap);}
   if(direction*(next-enemy.x)>0)enemy.x=clampX(next);
  }
  this.advanceImpactors(dt);
 }
 private advanceImpactors(dt:number){
  for(const p of this.impactors){
   if(this.elapsed>=p.expires)continue;
   const source=this.enemies.find(e=>e.serial===p.source&&e.hp>0);if(!source){p.expires=0;continue;}
   if(p.command.tracking)p.targetX=this.x;
   const before=p.x,delta=p.targetX-p.x,travel=p.command.speed*dt;
   if(p.command.speed>0)p.x+=Math.sign(delta)*Math.min(Math.abs(delta),travel);
   const arrived=p.command.speed===0||Math.abs(p.targetX-p.x)<1e-5;
   const apply=(phase:string)=>{
    for(const effect of p.command.effects.filter(e=>e.phase===phase)){
     if(effect.target===1){if(!markHit(p,'self:'+effect.type,phase,this.elapsed))continue;if(effect.type===2)source.hp=Math.min(source.maxHP,source.hp+source.maxHP*effect.value/100);if(effect.type===3)source.shield=Math.max(source.shield??0,source.maxHP*effect.value/100);continue;}
     if(effect.target!==2)continue;
     for(const target of [{id:'hero',x:this.x},...(this.escort?[{id:'escort',x:this.escort.x}]:[])]){
      if(!sweptHit(before,p.x,target.x,p.command.width)||!markHit(p,target.id+':'+effect.type,phase,this.elapsed))continue;
      if(target.id==='escort'){if(effect.type===1&&effect.value>0&&this.escort)this.escort.hp=Math.max(0,this.escort.hp-(source.damage??1)*effect.value/100);continue;}
      if(this.motion?.kind==='dodge'||this.heroInvincibleUntil>this.elapsed||this.parryUntil>=this.elapsed)continue;
      if(effect.type===1&&effect.value>0){
       if(this.heroHitUntil>this.elapsed)continue;
       this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;if(this.rng/4294967296>=accuracy(source.focus??0,this.stats.focus))continue;
       let damage=Math.max(1,Math.round(classDamage((source.damage??1)*effect.value/100*(1+relativeStat(source.valor??0,this.stats.valor,'Valor')),this.stats.abilities,!!source.boss,true)*this.stats.incomingDamageScale));
       const absorbed=Math.min(this.heroShield,damage);this.heroShield-=absorbed;damage-=absorbed;
       this.lastHeroDamage=Math.min(this.hp,damage);this.hp=Math.max(0,this.hp-damage);this.heroHitUntil=this.elapsed+.2;
       if(this.hp===0){this.failStage('전투 불능');return;}
      }else if([104,105,107,111].includes(effect.type)&&effect.value>0){this.heroStunUntil=Math.max(this.heroStunUntil,this.elapsed+effectDuration(effect.value,source.tenacity??0,this.stats.tenacity));this.motion=null;this.clearInput();this.pose('stay1');}
      else if(effect.type===106&&effect.value>0){this.moveTo(this.x+p.direction*Math.min(250,effect.value*50));}
     }
    }
   };
   if(p.command.moving)apply('Moving');if(arrived){if(p.command.arrive)apply('Arrive');if(p.command.release)apply('Release');if(p.command.speed>0||p.command.duration<=0)p.expires=Math.min(p.expires,this.elapsed+.05);}
   if(this.hp<=0)break;
  }
  this.impactors=this.impactors.filter(p=>p.expires>this.elapsed&&this.enemies.some(e=>e.serial===p.source&&e.hp>0));
 }

 private advanceEnemies(dt:number){
  if(this.campaign){this.advanceRecoveredEnemies(dt);return;}
  for(const enemy of this.enemies){
   if(enemy.hp<=0)continue;
   const distance=Math.abs(enemy.x-this.x);
   if(enemy.state==='windup'){
    if(this.elapsed>=enemy.attackAt){
     enemy.state='recover';enemy.nextAttack=this.elapsed+(enemy.recovery??HUNT_MONSTER_ATTACK.recovery);
     if(distance<=bodySeparation+HUNT_MONSTER_ATTACK.impactReachBonus&&this.motion?.kind!=='dodge'){
      if(this.parryUntil>=this.elapsed){enemy.nextAttack=this.elapsed+HUNT_MONSTER_ATTACK.parriedRecovery;continue;}
      if(this.heroHitUntil>this.elapsed)continue;
      const damage=Math.max(1,Math.round(classDamage(enemy.damage??HUNT_MONSTER_ATTACK.damage,this.stats.abilities,!!enemy.boss,true)*this.stats.incomingDamageScale));
      this.lastHeroDamage=Math.min(this.hp,damage);this.hp=Math.max(0,this.hp-damage);this.heroHitUntil=this.elapsed+.2;
      if(this.hp===0){this.deadAt=this.elapsed;this.motion=null;this.clearInput();this.resetCombo();this.auto=false;this.pose('die1',true);return;}
     }
    }
    continue;
   }
   if(this.elapsed<enemy.nextAttack){enemy.state='recover';continue;}
   if(distance<=bodySeparation+HUNT_MONSTER_ATTACK.reachBonus){enemy.state='windup';enemy.attackAt=this.elapsed+(enemy.windup??HUNT_MONSTER_ATTACK.windup);continue;}
   if(distance>HUNT_MONSTER.aggroRange){enemy.state='idle';continue;}
   enemy.state='walk';
   // Freeze translation during a roll, so neither its origin nor landing is occupied underneath it.
   if(this.motion?.kind==='dodge')continue;
   const direction=Math.sign(this.x-enemy.x),travel=Math.min((enemy.moveSpeed??HUNT_MONSTER.moveSpeed)*this.tempo*dt,Math.max(0,distance-bodySeparation));
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
 revive(){if(this.campaign&&this.stagePhase==='failed'){if(this.elapsed-this.deadAt<2)return false;this.hp=this.maxHP;this.stagePhase='normal';this.loadStage();this.heroHitUntil=this.elapsed+2;return true;}if(this.hp>0||this.elapsed-this.deadAt<2)return false;
  const spot=Array.from({length:64},(_,i)=>65+i*36).find(x=>this.enemies.every(e=>e.hp<=0||Math.abs(e.x-x)>=separation(e)));
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
   if(hit.heal){this.hp=Math.min(this.maxHP,this.hp+25*(1+((this.progress.skillLevels[5]??1)-1)*.05));continue;}
   if(m.kind==='skill'){for(const enemy of this.enemies)if(enemy.hp>0&&Math.abs(enemy.x-this.x)<=hit.range)this.hurt(hit.damage,true,enemy);continue;}
   if(m.target===this.enemySerial&&this.enemyHP>0&&Math.abs(this.enemyX-this.x)<=hit.range
    &&(this.enemyX-this.x)*this.facing>=0
    &&!this.enemies.some(e=>e.hp>0&&e.serial!==m.target&&(e.x-this.x)*this.facing>0
     &&Math.abs(e.x-this.x)<Math.abs(this.enemyX-this.x)))this.hurt(hit.damage,false);
  }
  let end=0,phase=m.segments.length-1;
  for(let i=0;i<m.segments.length;i++){end+=m.segments[i].duration;if(age<end-1e-8){phase=i;break;}}
  if(m.phase!==phase){m.phase=phase;this.pose(m.segments[phase].animation,true,m.animationRate??this.tempo);}
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
  if(this.campaign){this.advanceStage();if(this.stagePhase==="cleared"||this.stagePhase==="complete"||this.hp<=0)return;}
  if(!this.campaign)for(const enemy of this.enemies)if(enemy.hp<=0&&this.elapsed>=enemy.respawnAt){
   // Recycle defeated packs ahead of the hero, without spawning inside a body.
   const spawnX=this.hostile&&this.enemies.length===HUNT_STAGE.maxAlive
    ?Math.max(90,Math.min(WORLD_WIDTH-90,this.x+this.facing*(HUNT_STAGE.recycleAhead+enemy.slot*HUNT_STAGE.recycleSpacing)))
    :this.enemies.length===1?Math.min(WORLD_WIDTH-90,Math.max(90,this.x+this.facing*230)):enemy.x;
   if(this.hostile&&this.enemies.some(e=>e!==enemy&&e.hp>0&&Math.abs(e.x-spawnX)<48)){enemy.respawnAt=this.elapsed+.5;continue;}
   const roll=this.motion?.kind==='dodge'?this.motion:null;
   if(roll&&spawnX>Math.min(roll.origin??this.x,roll.destination??this.x)-bodySeparation&&spawnX<Math.max(roll.origin??this.x,roll.destination??this.x)+bodySeparation){enemy.respawnAt=this.elapsed+.25;continue;}
   // Never respawn a solid enemy around the player (including during a roll).
   if(Math.abs(spawnX-this.x)<bodySeparation){enemy.respawnAt=this.elapsed+.25;continue;}
   enemy.hp=enemy.maxHP;enemy.serial+=this.enemies.length;enemy.hitUntil=0;enemy.state='idle';enemy.nextAttack=this.elapsed+1;
   enemy.x=spawnX;
  }
  if(this.hostile)this.advanceEnemies(dt);
  if(this.hp<=0)return;
  this.advanceMotion(dt,direction);
  if(this.motion)return;
  if(this.heroStunUntil>this.elapsed){this.pose('stay1');return;}
  if(this.campaign&&this.auto&&!direction&&!this.enemies.some(e=>e.hp>0)){const d=stageDefinition(this.stageIndex),goal=d.victory===4?WORLD_WIDTH-160:this.objectiveObjects.find(o=>!o.done)?.x;if(goal!==undefined){if(Math.abs(goal-this.x)<=65)this.interact();else {this.facing=Math.sign(goal-this.x);this.moveTo(this.x+this.facing*HUNT_RULES.moveSpeed*this.tempo*dt);this.pose('run1');}return;}}
  this.selectTarget();
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(direction){
   this.attackIntent=false;this.queuedUntil=0;this.facing=Math.sign(direction);
   this.moveTo(this.x+direction*HUNT_RULES.moveSpeed*this.tempo*dt);this.pose('run1',false,this.tempo);return;
  }
  if(this.enemyHP>0&&(this.auto||this.attackHeld||this.attackIntent||this.queuedUntil>this.elapsed)){
   this.queuedUntil=0;this.attackIntent=true;
   const distance=Math.abs(this.enemyX-this.x);this.facing=Math.sign(this.enemyX-this.x)||this.facing;
   if(distance<=this.targetRange){this.attack();return;}
   if(HUNT_RULES.useRush&&distance>=HUNT_RULES.rushMin&&distance<=HUNT_RULES.rushMax){
    const destination=sweepHero(this.x,clampX(this.enemyX-this.facing*HUNT_RULES.stopRange),this.enemies);
    const duration=Math.abs(destination-this.x)/(HUNT_RULES.rushSpeed*this.tempo);
    if(duration>0)this.start({kind:'rush',start:this.elapsed,duration,target:this.enemySerial,
     segments:[{animation:'dash',duration}],phase:0,hits:[],destination,speed:HUNT_RULES.rushSpeed*this.tempo});
   }else{
    this.moveTo(this.x+this.facing*Math.min(HUNT_RULES.moveSpeed*this.tempo*dt,Math.max(0,distance-HUNT_RULES.stopRange)));
    this.pose('run1',false,this.tempo);
   }
   return;
  }
  this.pose('stay1');
 }
 attack(skill=-1){
  if(this.campaign&&(this.stagePhase==="cleared"||this.stagePhase==="complete"))return false;
  if(this.paused||this.hp<=0||this.heroStunUntil>this.elapsed||!Number.isInteger(skill)||skill< -1||skill>=6)return false;
  if(skill>=0&&this.hostile&&!this.progress.skillEnabled[skill])return false;
  if(this.motion){
   if(skill===-1&&this.motion.kind==='attack'&&this.actionUntil-this.elapsed<=HUNT_RULES.inputBuffer){
    this.queuedUntil=this.actionUntil+HUNT_RULES.inputBuffer;return true;
   }
   return false;
  }
  this.selectTarget();
  if(this.elapsed+1e-8<this.attackReady||skill>=0&&this.cooldowns[skill]>0)return false;
  if(skill===-1&&this.enemyHP<=0)return false;
  if(skill===-1&&Math.abs(this.enemyX-this.x)>this.targetRange){this.attackIntent=true;return true;}
  this.facing=Math.sign(this.enemyX-this.x)||this.facing;this.attackIntent=false;
  if(this.elapsed>this.comboExpires)this.resetCombo();
  if(skill===-1){
   const stage=this.combo[this.comboIndex],duration=(stage.duration??motions.durations[stage.animation])/this.attackTempo;
   this.comboStage=this.comboIndex+1;this.comboIndex=(this.comboIndex+1)%this.combo.length;
   this.comboExpires=this.elapsed+duration+HUNT_RULES.comboReset;this.attackReady=this.elapsed+Math.max(duration,HUNT_RULES.minAttackDelay/this.attackTempo);
   this.start({kind:'attack',start:this.elapsed,duration,target:this.enemySerial,
    segments:[{animation:stage.animation,duration}],phase:0,
    hits:[{at:stage.hitAt/this.attackTempo,damage:stage.damage,range:this.targetRange,done:false}]});
  }else{
   this.resetCombo();this.cooldowns[skill]=SKILL_COOLDOWNS[skill];
   const names=skill===4?['skill5','skill5_loop','skill5_end']:['skill1','skill2','skill3','skill4','skill5','rest1'].slice(skill,skill+1);
   const segments=names.map(animation=>({animation,duration:motions.durations[animation as keyof typeof motions.durations]/this.attackTempo}));
   const duration=segments.reduce((n,s)=>n+s.duration,0);this.attackReady=this.elapsed+duration;
   this.start({kind:'skill',start:this.elapsed,duration,target:this.enemySerial,segments,phase:0,
    hits:[{at:duration*.55,damage:40*(1+((this.progress.skillLevels[skill]??1)-1)*.05),range:330,done:false,heal:skill===5}]});
  }
  return true;
 }
 dodge(direction:number){
  if(this.paused||this.hp<=0||this.heroStunUntil>this.elapsed||this.elapsed<this.dodgeReady||this.motion||!Number.isFinite(direction)||!direction)return false;
  this.clearInput();this.resetCombo();this.facing=direction<0?-1:1;
  const duration=motions.durations.avoid1/this.tempo;
  const destination=planDodge(this.x,clampX(this.x+this.facing*HUNT_RULES.dodgeDistance),this.enemies).destination;
  this.start({kind:'dodge',start:this.elapsed,duration,target:this.enemySerial,segments:[{animation:'avoid1',duration}],
   phase:0,hits:[],origin:this.x,destination,speed:Math.abs(destination-this.x)/duration});
  this.dodgeReady=this.elapsed+HUNT_RULES.dodgeCooldown;return true;
 }
}
