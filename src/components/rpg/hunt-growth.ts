import {roundEven} from './hunt-math';
import {extraAbilities} from './hunt-development';
import data from './data/recovered-growth.json';
import type {HuntProgress} from './hunt-progression';
import type {WeaponType} from './hunt-weapons';
export const RECOVERED_GROWTH=data;
/** Original midpoint-to-even, including negative half ties. */
export {roundEven} from './hunt-math';
const normalize=(id:number,value:number)=>id>=7&&id<=12?roundEven(value):roundEven(value*100)/100;
function add(target:Record<number,number>,rows:number[][],level:number){for(const [id,base,inc] of rows)target[id]=(target[id]??0)+normalize(id,base+inc*(level-1));}
/** Curated grade-1 loadout. Each owned type contributes Hold once, not count times. */
export function recoveredStats(p:HuntProgress){
 const r:Record<number,number>={7:(p.attackTraining??0)*data.training.attackPerLevel,8:100+(p.healthTraining??0)*data.training.healthPerLevel,26:5,27:20};
 for(const type of ['sword','axe','spear','dual'] as const)add(r,data.weapons[type].hold,Math.min(50,p.weaponLevels[type]));
 if(p.weaponType==='unarmed')r[7]+=normalize(7,data.webAdaptation.unarmedBaseAttack+data.webAdaptation.unarmedAttackPerLevel*(Math.min(50,p.weaponLevels.unarmed)-1));
 else add(r,data.weapons[p.weaponType].equip,Math.min(50,p.weaponLevels[p.weaponType]));
 add(r,data.armor.equip,Math.min(50,p.armorLevel));add(r,data.armor.hold,Math.min(50,p.armorLevel));
 for(const [id,n] of Object.entries(extraAbilities(p)))r[Number(id)]=(r[Number(id)]??0)+n;
 const attack=roundEven((r[7]??0)*(1+(r[59]??0)/100)*(1+(r[63]??0)/100)*(1+(r[73]??0)/100)*(1+(r[75]??0)/100));
 const naturalHP=roundEven((r[8]??0)*(1+(r[60]??0)/100)*(1+(r[64]??0)/100)*(1+(r[76]??0)/100));
 return {maxHP:data.webAdaptation.testHP,attack,naturalHP,crit:Math.min(90,r[26]??0)/100,critMultiplier:1+(r[27]??0)/100,
  basicDamageMultiplier:(1+(r[17]??0)/100)*(1+(r[19]??0)/100),skillDamageMultiplier:(1+(r[18]??0)/100)*(1+(r[20]??0)/100),
  attackSpeed:1+Math.min(100,r[25]??0)/100,valor:r[9]??0,mental:r[10]??0,focus:r[11]??0,tenacity:r[12]??0,defense:0,incomingDamageScale:data.webAdaptation.referenceNaturalHP/Math.max(1,naturalHP),abilities:r};
}
export function weaponGrowth(p:HuntProgress,type:WeaponType){
 const level=p.weaponLevels[type],copy={...p,weaponType:type,weaponLevel:level};const stats=recoveredStats(copy);
 const next=recoveredStats({...copy,weaponLevel:level+1,weaponLevels:{...p.weaponLevels,[type]:level+1}});
 return {level,maxLevel:50,grade:type==='unarmed'?0:data.weapons[type].grade,attack:stats.attack,nextAttack:level>=50?null:next.attack,
  equippedRate:type==='unarmed'?0:normalize(73,data.weapons[type].equip[0][1]+data.weapons[type].equip[0][2]*(Math.min(50,level)-1))};
}
