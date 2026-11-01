/** Reproducible model, NOT measured player retention or original-game server balance. */
import {createStarterEquipment,equipmentLinkCap} from '../../src/components/rpg/idle-equipment';
import {createGachaState,createGemCollection,rollEquipmentBatch,rollGemBatch,type EquipmentGachaPool} from '../../src/components/rpg/idle-gacha';
import {accrueIdleProgress,createIdleProgress,idleBuildBudget,idleLevelCost} from '../../src/components/rpg/idle-progression';
function random(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const samples=128,checkpoints=[30,45,60],aggregates=new Map(checkpoints.map(day=>[day,{sixLink:0,unique:0,active:[] as number[],support:[] as number[],equipmentPulls:0,gemPulls:0}]));
for(let seed=1;seed<=samples;seed++){
 const rng=random(seed),p={level:1,xp:0,gold:0,soulGem:0,idle:createIdleProgress(0)};let equipment=createStarterEquipment(),gacha=createGachaState(),gemCollection=createGemCollection(),nextId=0;
 for(let day=1;day<=60;day++){
  accrueIdleProgress(p,day*86400000);
  // 1,440/day: 8 equipment(800) + 8 gems(600), save40. No kills, paid currency, or upgrades.
  for(let i=0;i<8;i++){const pool:EquipmentGachaPool=(['armor','weapon','armor','weapon','gloves','boots','ring','armor'] as const)[i],roll=rollEquipmentBatch(equipment,gacha,p.soulGem,1,rng,()=>`sim_${seed}_${++nextId}`,pool);equipment=roll.equipment;gacha=roll.gacha;p.soulGem=roll.soulGem;}
  for(let i=0;i<8;i++){const roll=rollGemBatch(gemCollection,gacha,p.soulGem,1,rng);gemCollection=roll.gemCollection;gacha=roll.gacha;p.soulGem=roll.soulGem;}
  const out=aggregates.get(day);if(out){out.sixLink+=Number(equipment.items.some(item=>equipmentLinkCap(item)===6));out.unique+=Number(equipment.items.some(item=>item.uniqueEffect||item.builtInSupports?.length));out.active.push(Object.keys(gemCollection.active).length);out.support.push(Object.keys(gemCollection.support).length);out.equipmentPulls=gacha.equipmentPulls;out.gemPulls=gacha.gemPulls;}
 }
}
const quantile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*fraction)];
const pointDays=[50,55,60,90].map(points=>{const level=points-11;let xp=0;for(let l=1;l<level;l++)xp+=idleLevelCost(l);return {points,level,xp,daysAt24hCapture:Number((xp/7200).toFixed(4)),daysAt12hCapture:Number((xp/3600).toFixed(4))};});
console.log(JSON.stringify({model:'custom-web-idle-v1',seedRange:[1,samples],rng:'LCG 1664525/1013904223 uint32',assumptions:{claimEveryHours:24,capHours:24,activeMinutesRequired:0,activeXpBonus:0,freeCurrencyPerDay:1440,equipmentPerDay:8,gemsPerDay:8,equipmentPoolSchedule:['armor','weapon','armor','weapon','gloves','boots','ring','armor'],upgradeSpend:0,paidSpend:0,startingPoints:idleBuildBudget(1)},pointDays,acquisition:[...aggregates].map(([day,a])=>({day,equipmentPulls:a.equipmentPulls,gemPulls:a.gemPulls,atLeastOneSixSocketItem:a.sixLink/samples,atLeastOneUniqueOption:a.unique/samples,activeCollected:{p10:quantile(a.active,.1),median:quantile(a.active,.5),p90:quantile(a.active,.9)},supportCollected:{p10:quantile(a.support,.1),median:quantile(a.support,.5),p90:quantile(a.support,.9)}}))},null,2));
