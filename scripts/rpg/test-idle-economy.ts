import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarterEquipment,EQUIPMENT_LINK_CAPS,EQUIPMENT_RARITIES,EQUIPMENT_SLOTS,EQUIPMENT_WEAPONS,equipmentLinkCap,equipEquipment,migrateEquipmentRarity,upgradeEquipment,validateEquipmentState} from '../../src/components/rpg/idle-equipment';
import {ACQUIRABLE_ACTIVE_GEMS,createGachaState,createGemCollection,EQUIPMENT_GACHA_WEIGHTS,gachaLevel,GACHA_POLICY,rollEquipmentBatch,rollGemBatch,socketEquipmentGem,validateOwnedEquipmentGems,weightedIndex} from '../../src/components/rpg/idle-gacha';
import {accrueIdleProgress,createIdleProgress,IDLE_BALANCE,idleBuildBudget,idleLevelCost} from '../../src/components/rpg/idle-progression';
import {ACTIVE_CATALOG,GEMS} from '../../src/components/rpg/build-catalog';
import {buildBudget} from '../../src/components/rpg/hunt-build';
import {awardHuntKill,awardStageClear,DEFAULT_HUNT_BALANCE,heroStats,newHuntProgress} from '../../src/components/rpg/hunt-progression';
import {buyMastery,buySkill,buyWill,extraAbilities,traitPoints} from '../../src/components/rpg/hunt-development';

function numbers(values:number[]){let i=0;return()=>{assert.ok(i<values.length,'deterministic roll consumed unexpected randomness');return values[i++];};}
test('six physical groups obey every grade cap; paired dual is a single three-socket group',()=>{
 const expected={sword:[1,2,3,4,4,4],axe:[2,3,4,5,6,6],dual:[1,1,2,2,3,3],spear:[2,3,4,5,6,6],armor:[2,3,4,5,6,6],gloves:[1,2,3,4,4,4],boots:[1,2,3,4,4,4],ring1:[1,1,1,1,1,1],ring2:[1,1,1,1,1,1]};
 assert.deepEqual(EQUIPMENT_LINK_CAPS,expected);
 for(const [kind,caps] of Object.entries(expected))for(let i=0;i<6;i++)assert.equal(equipmentLinkCap({slot:EQUIPMENT_WEAPONS.includes(kind as any)?'weapon':kind as any,weaponType:EQUIPMENT_WEAPONS.includes(kind as any)?kind as any:undefined,rarity:EQUIPMENT_RARITIES[i]}),caps[i]);
 const starter=createStarterEquipment('dual');assert.equal(starter.items.length,6);assert.equal(starter.items.filter(i=>i.slot==='weapon').length,1);assert.equal(starter.items.reduce((sum,i)=>sum+i.gems.filter(Boolean).length,0),6);validateOwnedEquipmentGems(starter,createGemCollection());
 const bad=structuredClone(starter);bad.items[5].gems.push('quick');assert.throws(()=>validateEquipmentState(bad));
 const forged=structuredClone(starter);forged.items[0].builtInSupports=['power'];assert.throws(()=>validateEquipmentState(forged));forged.items[0].builtInSupports=['bleed'];assert.throws(()=>validateEquipmentState(forged));delete forged.items[0].builtInSupports;forged.items[1].uniqueEffect='cluster-notables';assert.throws(()=>validateEquipmentState(forged));
});
test('legacy seven grades map without deleting ids, levels, or original top grade',()=>{
 const mapped=['C','UC','R','SR','SSR','UR','LR'].map((rarity,i)=>migrateEquipmentRarity({instanceId:`legacy_${i}`,rarity,level:23,preserved:{a:1}}));
 assert.deepEqual(mapped.map(i=>i.rarity),['normal','high','rare','heroic','ancient','mythic','mythic']);assert.equal(mapped[6].legacyRarity,'LR');assert.equal(mapped[6].level,23);assert.deepEqual(mapped[6].preserved,{a:1});
});
test('recovered grade-one upgrade fixtures and transaction failures preserve input',()=>{
 const state=createStarterEquipment(),before=structuredClone(state);
 assert.equal(upgradeEquipment(state,40,'starter_weapon').cost,40);assert.equal(upgradeEquipment(state,400,'starter_armor').cost,400);
 assert.throws(()=>upgradeEquipment(state,39,'starter_weapon'));assert.deepEqual(state,before);
 const max=structuredClone(state);max.items[0].level=50;assert.throws(()=>upgradeEquipment(max,1e6,'starter_weapon'));
 assert.throws(()=>equipEquipment(state,'forged_item'));
});
test('all 10 probability tables are exact and every integer ticket receives its published rarity',()=>{
 assert.deepEqual(EQUIPMENT_GACHA_WEIGHTS[0],[6000,2600,1000,320,70,10]);assert.deepEqual(EQUIPMENT_GACHA_WEIGHTS[9],[3300,3950,1900,590,205,55]);
 for(const table of EQUIPMENT_GACHA_WEIGHTS){assert.equal(table.reduce((s,v)=>s+v,0),10000);const counts=[0,0,0,0,0,0];for(let ticket=0;ticket<10000;ticket++)counts[weightedIndex(table,()=>(ticket+.5)/10000)]++;assert.deepEqual(counts,table);}
 assert.equal(weightedIndex([6000,2600,1000,320,70,10],()=>.6),1);assert.equal(weightedIndex([6000,2600,1000,320,70,10],()=>.999),5);
 assert.equal(gachaLevel(99),1);assert.equal(gachaLevel(100),2);assert.equal(gachaLevel(999999),10);
 for(const invalid of [-1,1,NaN,Infinity])assert.throws(()=>weightedIndex([1],()=>invalid));
});
test('server rolls each weapon type uniformly and enforce pool, currency, batch, and unique-instance boundaries',()=>{
 const state=createStarterEquipment(),gacha=createGachaState();const before=structuredClone(state);
 for(let i=0;i<4;i++){const roll=rollEquipmentBatch(state,gacha,100,1,numbers([0,(i+.5)/4,0]),()=>`roll_${i}`,'weapon');assert.equal(roll.results[0].weaponType,EQUIPMENT_WEAPONS[i]);assert.equal(roll.soulGem,0);assert.equal(roll.gacha.equipmentPulls,1);}
 assert.throws(()=>rollEquipmentBatch(state,gacha,1e6,11,()=>0,()=>`x`));assert.throws(()=>rollEquipmentBatch(state,gacha,99,1,()=>0,()=>`x`));assert.throws(()=>rollEquipmentBatch(state,gacha,100,1,()=>0,()=>`starter_weapon`));assert.deepEqual(state,before);
 const top=rollEquipmentBatch(state,gacha,100,1,numbers([.9999,.6,0,0,0]),()=>`unique_weapon`,'weapon');assert.equal(top.results[0].rarity,'mythic');assert.deepEqual(top.results[0].builtInSupports,['brutality']);
 const armor=rollEquipmentBatch(state,gacha,100,1,numbers([.995,0,.75,0]),()=>`unique_armor`,'armor');assert.equal(armor.results[0].uniqueEffect,'devotion-speed');
});
test('starter collection is six active gems; all remaining29 actives and all30 supports have a reachable roll',()=>{
 const starter=createGemCollection();assert.equal(Object.keys(starter.active).length,6);assert.equal(Object.keys(starter.support).length,0);assert.equal(ACQUIRABLE_ACTIVE_GEMS.length,29);assert.equal(GEMS.length,30);assert.equal(ACTIVE_CATALOG.length,35);
 for(const [kind,pool,kindRoll] of [['active',ACQUIRABLE_ACTIVE_GEMS,.1],['support',GEMS,.9]] as const)for(let i=0;i<pool.length;i++){const result=rollGemBatch(starter,createGachaState(),75,1,numbers([kindRoll,(i+.5)/pool.length]));assert.equal(result.results[0].kind,kind);assert.equal(result.results[0].gemId,pool[i].id);assert.equal(result.gemCollection[kind][pool[i].id],1);}
 assert.equal(GACHA_POLICY.pity,null);
});
test('gem copies are reserved across physical inventory items; changing equipment preserves its socket group',()=>{
 let state=createStarterEquipment();const collection=createGemCollection();collection.support.power=1;
 state=socketEquipmentGem(state,collection,'starter_weapon',1,'power');assert.equal(state.items[0].gems[1],'power');assert.throws(()=>socketEquipmentGem(state,collection,'starter_armor',1,'power'));assert.throws(()=>socketEquipmentGem(state,collection,'starter_weapon',1,'fireball'));
 const rolled=rollEquipmentBatch(state,createGachaState(),100,1,numbers([0,0,.75,.99]),()=>`second_weapon`,'weapon');const switched=equipEquipment(rolled.equipment,'second_weapon');assert.equal(switched.items.find(i=>i.instanceId==='starter_weapon')!.gems[1],'power');assert.deepEqual(switched.items.find(i=>i.instanceId==='second_weapon')!.gems,[null]);
});
test('native XP fixtures and clock pacing place50–60P in32–58 captured days without kill shortcuts',()=>{
 assert.equal(idleLevelCost(1),1000);assert.equal(idleLevelCost(2),1107);assert.equal(idleLevelCost(49),21928);assert.equal(idleLevelCost(50),22028);
 const p=newHuntProgress();p.idle=createIdleProgress(0);let now=0,day50=0,day60=0;
 for(let day=1;day<=60;day++){now+=86400000;accrueIdleProgress(p,now);if(!day50&&idleBuildBudget(p.level)>=50)day50=day;if(!day60&&idleBuildBudget(p.level)>=60)day60=day;}
 assert.equal(day50,33);assert.equal(day60,58);assert.equal(IDLE_BALANCE.offlineCapMs,86400000);
 const xp=p.xp,level=p.level;for(let i=0;i<10000;i++)awardHuntKill(p,DEFAULT_HUNT_BALANCE);awardStageClear(p,DEFAULT_HUNT_BALANCE,[100,10000000,10]);assert.equal(p.xp,xp);assert.equal(p.level,level);assert.equal(p.masteryEssence,0);assert.deepEqual(p.skillCopies,[0,0,0,0,0,0]);
 assert.equal(idleBuildBudget(7800),90);assert.equal(traitPoints({...p,level:49,traits:{7:3}}),45);
 for(const level of [1,38.99,39,49,79,7800,NaN,Infinity,-Infinity])assert.equal(buildBudget(level),idleBuildBudget(level));
});
test('clock credit is partition invariant, capped, replay safe, and robust to clock rollback',()=>{
 const a=newHuntProgress(),b=newHuntProgress();a.idle=createIdleProgress(0);b.idle=createIdleProgress(0);
 for(let i=1;i<=60000;i++)accrueIdleProgress(a,i);accrueIdleProgress(b,60000);assert.deepEqual(a,b);assert.equal(a.xp,5);assert.equal(a.gold,30);assert.equal(a.soulGem,1);
 const before=structuredClone(a);accrueIdleProgress(a,60000);accrueIdleProgress(a,59999);assert.deepEqual(a,before);
 const capped=accrueIdleProgress(a,60000+3*86400000);assert.equal(capped.elapsedMs,86400000);assert.equal(capped.discardedMs,2*86400000);assert.equal(capped.xp,7200);
 assert.throws(()=>accrueIdleProgress(a,NaN));
});
test('old growth values remain stored while idle removes skill/mastery/will purchases and benefits',()=>{
 const p=newHuntProgress();p.masteryLevel=50;p.masteryEssence=10000;p.willLevel=50;p.soulOrb=10000;p.skillCopies.fill(1000);const oldExtra=extraAbilities(p);p.idle=createIdleProgress(0);
 assert.throws(()=>buyMastery(p));assert.throws(()=>buyWill(p));assert.throws(()=>buySkill(p,0));assert.equal(p.masteryLevel,50);assert.equal(p.willLevel,50);assert.notDeepEqual(extraAbilities(p),oldExtra);
 p.equipment=createStarterEquipment();const starting=heroStats(p);p.attackTraining=10;p.healthTraining=10;const trained=heroStats(p);assert.ok(trained.attack>starting.attack);assert.ok(trained.naturalHP>starting.naturalHP);
 p.equipment.items[0].rarity='mythic';p.equipment.items[0].gems=Array(6).fill(null);assert.ok(heroStats(p).attack>trained.attack);
});
