import {recoveredStats,RECOVERED_GROWTH} from './hunt-growth';
import {HUNT_MONSTER} from './hunt-tables';
import {isWeaponType,type WeaponType} from './hunt-weapons';
/** Web adaptation. Native curve arithmetic recovered; reward/stat balance is provisional. */
export type Curve={min:number;max:number;base:number;inc:number;rate:number;scaler:number};
export type HuntBalance={version:1;source:string;maxLevel:number;team:Curve[];weapon:Curve[];armor:Curve[];reward:{gold:number;xp:number;soulGem:number}};
export const DEFAULT_HUNT_BALANCE:HuntBalance={version:1,source:RECOVERED_GROWTH.source,maxLevel:RECOVERED_GROWTH.teamMaxLevel,
 team:RECOVERED_GROWTH.teamCurves,weapon:[RECOVERED_GROWTH.weaponCurve],armor:[RECOVERED_GROWTH.armorCurve],reward:{...HUNT_MONSTER.reward}};
export type HuntProgress={labyrinthStage:number;labyrinthCompleted:number;combatArts:Record<number,number>;traits:Record<number,number>;masteryLevel:number;masteryEssence:number;willLevel:number;soulOrb:number;skillLevels:number[];skillCopies:number[];skillEnabled:number[];level:number;attackTraining:number;healthTraining:number;xp:number;gold:number;soulGem:number;kills:number;weaponLevel:number;armorLevel:number;potions:number;questTier:number;weaponType:WeaponType;weaponLevels:Record<WeaponType,number>};
export const newHuntProgress=():HuntProgress=>({labyrinthStage:0,labyrinthCompleted:0,combatArts:{},traits:{},masteryLevel:1,masteryEssence:0,willLevel:0,soulOrb:0,skillLevels:[1,1,1,1,1,1],skillCopies:[0,0,0,0,0,0],skillEnabled:[1,1,1,1,1,1],level:1,attackTraining:0,healthTraining:0,xp:0,gold:0,soulGem:0,kills:0,weaponLevel:1,armorLevel:1,potions:3,questTier:0,weaponType:'axe',weaponLevels:{unarmed:1,sword:1,axe:1,dual:1,spear:1}});
export const HUNT_QUESTS=[{name:'숲의 첫걸음',kills:5,gold:50,soulGem:10},{name:'슬라임 정리',kills:20,gold:150,soulGem:20},{name:'숲의 수호자',kills:50,gold:400,soulGem:40}] as const;
export const POTION_PRICE=50;
/** Prototype item economy: distinct from the recovered native cost curve. */
export function buyHuntPotion(p:HuntProgress){if(p.potions>=99)throw Error('물약은 최대 99개까지 보관할 수 있습니다.');if(p.gold<POTION_PRICE)throw Error('골드가 부족합니다.');p.gold-=POTION_PRICE;p.potions++;}
export function claimHuntQuest(p:HuntProgress){const q=HUNT_QUESTS[p.questTier];if(!q)throw Error('모든 사냥 의뢰를 완료했습니다.');if(p.kills<q.kills)throw Error('사냥 의뢰 목표를 먼저 달성해 주세요.');
 p.gold=Math.min(1e12,p.gold+q.gold);p.soulGem=Math.min(1e12,p.soulGem+q.soulGem);p.questTier++;}
export function curveValue(curves:readonly Curve[],level:number){
 if(!Number.isInteger(level))throw Error('Invalid level');
 const c=curves.find(c=>level>=c.min&&level<c.max);if(!c||!c.scaler)return 0;
 const floor=Math.floor,n=Math.fround(level-c.min);
 const q=floor(floor(floor(floor(c.rate*n)*n)+floor(c.scaler*.5))/c.scaler);
 const value=floor(floor(c.inc*n)+floor(c.base+q));
 if(!Number.isSafeInteger(value)||value<0)throw Error('Unsafe curve value');return value;
}
export function awardHuntKill(p:HuntProgress,balance:HuntBalance){
 const {gold,xp,soulGem}=balance.reward;
 // Web reward adapter: original acquisition modes are not present in this prototype.
 p.masteryEssence=Math.min(1e12,(p.masteryEssence??0)+100);p.soulOrb=Math.min(1e12,(p.soulOrb??0)+50);
 if((p.kills+1)%5===0){const i=Math.floor((p.kills+1)/5-1)%6;p.skillCopies[i]=Math.min(1e12,p.skillCopies[i]+1);}
 p.gold=Math.min(1e12,p.gold+gold);p.soulGem=Math.min(1e12,p.soulGem+soulGem);p.kills=Math.min(1e12,p.kills+1);
 p.xp=Math.min(1e12,p.xp+xp);
 advanceHuntLevel(p,balance);
}
export function awardStageClear(p:HuntProgress,balance:HuntBalance,reward:number[]){
 const [gold,xp,soulGem]=reward;p.gold=Math.min(1e12,p.gold+gold);p.xp=Math.min(1e12,p.xp+xp);p.soulGem=Math.min(1e12,p.soulGem+soulGem);advanceHuntLevel(p,balance);
}
function advanceHuntLevel(p:HuntProgress,balance:HuntBalance){
 while(p.level<balance.maxLevel){const required=curveValue(balance.team,p.level);if(required<=0||p.xp<required)break;p.xp-=required;p.level++;}
 if(p.level>=balance.maxLevel)p.xp=0;
}
export function upgradeHuntWeapon(p:HuntProgress,balance:HuntBalance,type:WeaponType){
 if(!isWeaponType(type))throw Error('Invalid weapon');if(p.weaponLevels[type]>=50)throw Error('최대 강화 단계입니다.');const cost=curveValue(balance.weapon,p.weaponLevels[type]);
 if(cost<=0)throw Error('최대 강화 단계이거나 비용 설정이 없습니다.');if(p.soulGem<cost)throw Error('영혼석이 부족합니다.');
 p.soulGem-=cost;p.weaponLevels[type]++;if(p.weaponType===type)p.weaponLevel=p.weaponLevels[type];return cost;
}
export function upgradeHunt(p:HuntProgress,balance:HuntBalance,slot:'weapon'|'armor'){
 if(slot==='weapon')return upgradeHuntWeapon(p,balance,p.weaponType);
 if(p.armorLevel>=50)throw Error('최대 강화 단계입니다.');const cost=curveValue(balance.armor,p.armorLevel);
 if(cost<=0)throw Error('최대 강화 단계이거나 비용 설정이 없습니다.');if(p.soulGem<cost)throw Error('영혼석이 부족합니다.');
 p.soulGem-=cost;p.armorLevel++;return cost;
}
export const heroStats=recoveredStats;
export function trainingCost(p:HuntProgress,kind:'attack'|'health'){const level=kind==='attack'?p.attackTraining:p.healthTraining;return level>=500?0:curveValue([RECOVERED_GROWTH.training.cost],level+1);}
export function trainHunt(p:HuntProgress,kind:'attack'|'health'){const cost=trainingCost(p,kind);if(!cost)throw Error('최대 수련 단계입니다.');if(p.gold<cost)throw Error('골드가 부족합니다.');p.gold-=cost;if(kind==='attack')p.attackTraining++;else p.healthTraining++;return cost;}

export function equipHuntWeapon(p:HuntProgress,type:WeaponType){if(!isWeaponType(type))throw Error('Invalid weapon');p.weaponType=type;p.weaponLevel=p.weaponLevels[type];}
