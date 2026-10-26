import {developmentView,buyArt,buyTrait,buyMastery,buyWill,buySkill,toggleSkill} from '../components/rpg/hunt-development';
import {weaponGrowth} from '../components/rpg/hunt-growth';
import type {LabyrinthView} from '../components/rpg/hunt-labyrinth';
import {HUNT_STAGE} from '../components/rpg/hunt-tables';
import {randomUUID} from 'node:crypto';
import {HuntEngine,type HuntEnemy} from '../components/rpg/hunt-engine';
import {weaponLoadout,WEAPON_TYPES,isWeaponType,type WeaponType} from '../components/rpg/hunt-weapons';
import {huntLoadout} from '../components/rpg/hunt-loadouts';
import {curveValue,heroStats,trainingCost,upgradeHunt,upgradeHuntWeapon,equipHuntWeapon,buyHuntPotion,claimHuntQuest,type HuntBalance,type HuntProgress} from '../components/rpg/hunt-progression';
import {RpgStore} from './rpg-store';
export type HuntInput={move:number;attack:boolean;auto:boolean;basic?:boolean;skill?:number;dodge?:number;parry?:boolean};
export function parseHuntInput(raw:unknown):HuntInput{
 if(!raw||typeof raw!=='object')throw Error('Invalid input');const x=raw as Record<string,unknown>;
 if(typeof x.move!=='number'||!Number.isFinite(x.move)||Math.abs(x.move)>1||typeof x.attack!=='boolean'||typeof x.auto!=='boolean')throw Error('Invalid input');
 if(x.skill!==undefined&&(!Number.isInteger(x.skill)||Number(x.skill)<0||Number(x.skill)>5))throw Error('Invalid skill');
 if(x.dodge!==undefined&&x.dodge!==-1&&x.dodge!==1||x.parry!==undefined&&typeof x.parry!=='boolean'||x.basic!==undefined&&typeof x.basic!=='boolean')throw Error('Invalid action');
 return {move:x.move,attack:x.attack,auto:x.auto,basic:x.basic as boolean|undefined,skill:x.skill as number|undefined,dodge:x.dodge as number|undefined,parry:x.parry as boolean|undefined};
}
export type HuntAction='tick'|'revive'|'weapon'|'armor'|'potion'|'buy-potion'|'quest'|'train-attack'|'train-health'|`art-${number}-${number}`|`trait-${number}`|'mastery'|'will'|`skill-train-${number}`|`skill-toggle-${number}`|`equip-${WeaponType}`|`upgrade-${WeaponType}`;
export type BattleView={stage:LabyrinthView;id:string;sequence:number;character:string;hp:number;maxHP:number;x:number;elapsed:number;action:string;actionSerial:number;animationSpeed:number;facing:number;
 development:ReturnType<typeof developmentView>;stats:ReturnType<typeof heroStats>;weaponDetails:Record<WeaponType,ReturnType<typeof weaponGrowth>>;trainingCosts:{attack:number;health:number};armorPreview:{naturalHP:number;nextHP:number|null};enemies:HuntEnemy[];cooldowns:number[];auto:boolean;progress:HuntProgress;xpRequired:number;weaponCost:number;weaponCosts:Record<WeaponType,number>;armorCost:number;loadout:string;dead:boolean;reviveReady:boolean;potionReady:boolean;heroHitUntil:number;lastHeroDamage:number;source:string;weapon:WeaponType;motion:{startedAt:number;duration:number;hitAt:number}};
type Battle={id:string;character:string;engine:HuntEngine;revision:number;last:number;input:HuntInput;sequence:number;cached:BattleView;seen:number};
export class RpgService{
 private sessions=new Map<string,Battle>();
 constructor(readonly store:RpgStore,readonly balance:HuntBalance,readonly now=()=>performance.now()){}
 start(account:string,character:string){
  huntLoadout(character);const saved=this.store.load(account);const loadout=weaponLoadout(character,saved.progress.weaponType);
  if(saved.progress.level>this.balance.maxLevel)throw Error('저장된 레벨보다 낮은 밸런스 설정입니다. 관리자 확인이 필요합니다.');
  for(const [key,b] of this.sessions)if(this.now()-b.seen>20*60*1000)this.sessions.delete(key);
  if(!this.sessions.has(account)&&this.sessions.size>=1000)throw Error('사냥터 접속자가 많습니다.');
  const engine=new HuntEngine(loadout.combo,HUNT_STAGE.maxAlive,{campaign:true,hostile:true,progress:saved.progress,balance:this.balance,range:loadout.range,crit:loadout.crit,tempo:loadout.tempo,seed:Date.now()});
  const b:Battle={id:randomUUID(),character,engine,revision:saved.revision,last:this.now(),input:{move:0,attack:false,auto:false},sequence:0,cached:null as unknown as BattleView,seen:this.now()};
  this.sessions.set(account,b);b.cached=this.view(b);return b.cached;
 }
 private view(b:Battle):BattleView{const g=b.engine;
  return {stage:g.stage,id:b.id,sequence:b.sequence,character:b.character,hp:g.hp,maxHP:g.maxHP,x:g.x,elapsed:g.elapsed,action:g.action,actionSerial:g.actionSerial,animationSpeed:g.animationSpeed,facing:g.facing,
   development:developmentView(g.progress),stats:g.stats,weaponDetails:Object.fromEntries(WEAPON_TYPES.map(type=>[type,weaponGrowth(g.progress,type)])) as Record<WeaponType,ReturnType<typeof weaponGrowth>>,trainingCosts:{attack:trainingCost(g.progress,'attack'),health:trainingCost(g.progress,'health')},armorPreview:{naturalHP:g.stats.naturalHP,nextHP:g.progress.armorLevel>=50?null:heroStats({...g.progress,armorLevel:g.progress.armorLevel+1}).naturalHP},
   enemies:g.enemies.map(e=>({...e})),cooldowns:[...g.cooldowns],auto:g.auto,progress:{...g.progress,weaponLevels:{...g.progress.weaponLevels},combatArts:{...g.progress.combatArts},traits:{...g.progress.traits},skillLevels:[...g.progress.skillLevels],skillCopies:[...g.progress.skillCopies],skillEnabled:[...g.progress.skillEnabled]},xpRequired:g.progress.level>=this.balance.maxLevel?0:curveValue(this.balance.team,g.progress.level),
   weaponCost:g.progress.weaponLevel>=50?0:curveValue(this.balance.weapon,g.progress.weaponLevel),weaponCosts:Object.fromEntries(WEAPON_TYPES.map(type=>[type,g.progress.weaponLevels[type]>=50?0:curveValue(this.balance.weapon,g.progress.weaponLevels[type])])) as Record<WeaponType,number>,armorCost:g.progress.armorLevel>=50?0:curveValue(this.balance.armor,g.progress.armorLevel),loadout:weaponLoadout(b.character,g.progress.weaponType).name,
   dead:g.hp<=0,reviveReady:g.hp<=0&&g.elapsed-g.deadAt>=2,potionReady:g.hp>0&&g.hp<g.maxHP&&g.elapsed>=g.potionReady&&g.progress.potions>0,heroHitUntil:g.heroHitUntil,lastHeroDamage:g.lastHeroDamage,source:this.balance.source,weapon:g.progress.weaponType,motion:g.visualTiming};}
 command(account:string,id:string,sequence:number,input:HuntInput,action:HuntAction='tick'){
  const b=this.sessions.get(account);if(!b||b.id!==id)throw Error('사냥 세션이 만료되거나 다른 창에서 입장했습니다. 다시 입장해 주세요.');
  if(sequence===b.sequence)return b.cached;
  if(!Number.isSafeInteger(sequence)||sequence!==b.sequence+1)throw Error('Invalid sequence');
  const g=b.engine,now=this.now();const before=JSON.stringify(g.progress);
  if(action.startsWith('art-')){const [,id,count]=action.split('-');buyArt(g.progress,Number(id),Number(count));}
  if(action.startsWith('trait-'))buyTrait(g.progress,Number(action.slice(6)));
  if(action==='mastery')buyMastery(g.progress);if(action==='will')buyWill(g.progress);
  if(action.startsWith('skill-train-'))buySkill(g.progress,Number(action.slice(12)));
  if(action.startsWith('skill-toggle-'))toggleSkill(g.progress,Number(action.slice(13)));
  if(action.startsWith('equip-')){const type=action.slice(6);if(!isWeaponType(type))throw Error('Invalid weapon');
   equipHuntWeapon(g.progress,type);const l=weaponLoadout(b.character,type);g.configureLoadout(l.combo,l.range,l.crit,l.tempo);}
  if(action.startsWith('upgrade-')){const type=action.slice(8);if(!isWeaponType(type))throw Error('Invalid weapon');upgradeHuntWeapon(g.progress,this.balance,type);}
  if(action==='weapon'||action==='armor')upgradeHunt(g.progress,this.balance,action);
  if(action==='train-attack')buyArt(g.progress,101,1);if(action==='train-health')buyArt(g.progress,102,1);
  if(action==='potion')g.usePotion();if(action==='buy-potion')buyHuntPotion(g.progress);if(action==='quest')claimHuntQuest(g.progress);
  // Requests do not manufacture time. Background gaps are capped; no offline farming.
  let remaining=Math.max(0,Math.min((now-b.last)/1000,.3));b.last=now;b.seen=now;
  while(remaining>1e-8){const dt=Math.min(.01,remaining);const auto=b.input.auto&&g.hp>0;if(g.auto!==auto)g.setAuto(auto);g.attackHeld=b.input.attack;g.step(dt,b.input.move);remaining-=dt;}
  if(action==='revive')g.revive();
  b.input=input;const auto=input.auto&&g.hp>0;if(g.auto!==auto)g.setAuto(auto);g.attackHeld=input.attack;
  if(input.skill!==undefined)g.attack(input.skill);if(input.dodge)g.dodge(input.dodge);if(input.parry)g.parry();
  if(input.attack||input.basic)g.attack();
  if(JSON.stringify(g.progress)!==before){try{b.revision=this.store.save(account,g.progress,b.revision);}catch(e){this.sessions.delete(account);throw e;}}
  b.sequence=sequence;b.cached=this.view(b);return b.cached;
 }
}
