/** Reproducible custom-balance model, not measured play or a native/PoE balance claim. */
import assert from 'node:assert/strict';
import {big, type Decimal} from '../../src/components/rpg/combat-big';
import {CORE_EDGES,CORE_NODES,buildBudget,changeBuild,compileBuild,getBuildTree,newBuild,supportsActive,validateBuild,type BuildState,type CoreNode} from '../../src/components/rpg/hunt-build';
import {GEMS,ACTIVE_SKILLS} from '../../src/components/rpg/build-catalog';
import {buyTrait,traitPoints} from '../../src/components/rpg/hunt-development';
import {newHuntProgress,heroStats,trainHunt,trainingCost,type HuntProgress} from '../../src/components/rpg/hunt-progression';
import {accrueIdleProgress,advanceIdleLevel,createIdleProgress,idleLevelCost} from '../../src/components/rpg/idle-progression';
import {EQUIPMENT_RARITIES,EQUIPMENT_SLOTS,createStarterEquipment,equippedItems,equipmentLinkCap,equipmentUpgradeCost,upgradeEquipment,type EquipmentInstance} from '../../src/components/rpg/idle-equipment';
import {createGachaState,createGemCollection,rollEquipmentBatch,rollGemBatch,validateOwnedEquipmentGems,type EquipmentGachaPool} from '../../src/components/rpg/idle-gacha';
import {HYBRID_BALANCE,dungeonProfile,monsterProfile,hybridOutgoing,hybridIncoming,hybridHitChance,zoneRewardBudget,rewardForKill} from '../../src/components/rpg/hybrid-balance';
import combatProfile from '../../src/components/rpg/combat-profile.json';
import {ROGUE_PACE} from '../../src/components/rpg/rogue/pace';

const SEED=20261101,DAY=86400000,CHECKPOINTS=[0,1,7,30,60],DIFFICULTIES=[1,10,50,100,101,200,500,1000,1001,10000,1_000_000];
const poolSchedule:EquipmentGachaPool[]=['armor','weapon','armor','weapon','gloves','boots','ring','armor'];
const traitOrder=[7,8,59,60,9,12,10,11,17,18,25,26,27];
const averageAttackDuration=combatProfile.combo.reduce((sum,row)=>sum+row.duration,0)/combatProfile.combo.length/ROGUE_PACE.attackRate;
const rounded=(n:number)=>Math.round(n*10000)/10000;
const amount=(n:Decimal)=>n.toString();
function random(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

/** Local, reachable, greedy choice: no free nodes, jewels, keystones or refunded-path shortcuts. */
function nodeScore(n:CoreNode){return (n.damage??0)+(n.attackDamage??0)+(n.meleeDamage??0)+(n.physicalDamage??0)+.7*(n.life??0)+.35*(n.armour??0)+.3*(n.resistance??0)+(n.attackSpeed??0)+.002*(n.strength??0)+.001*(n.dexterity??0)+(n.moreDamage-1);}
function allocateNodes(build:BuildState,level:number){
 let b=build;
 while(getBuildTree(b).spent<buildBudget(level)){
  const owned=new Set(b.nodes),frontier=new Set(CORE_EDGES.flatMap(([a,z])=>owned.has(a)&&!owned.has(z)?[z]:owned.has(z)&&!owned.has(a)?[a]:[]));
  const candidates=CORE_NODES.filter(n=>frontier.has(n.id)&&n.kind!=='keystone'&&n.kind!=='socket'&&!n.startFor).sort((a,z)=>nodeScore(z)-nodeScore(a)||a.id.localeCompare(z.id));
  let next:BuildState|undefined;
  for(const n of candidates){try{next=changeBuild(b,`core-allocate-${n.id}`,level);break;}catch{/* Invalid/over-budget candidates are excluded, not granted. */}}
  if(!next)break;b=next;
 }
 validateBuild(b,level);return b;
}
function equipAndSocket(p:HuntProgress){
 const equipment=p.equipment!,collection=p.gemCollection!;
 const quality=(item:EquipmentInstance)=>EQUIPMENT_RARITIES.indexOf(item.rarity)*100+item.level;
 for(const slot of EQUIPMENT_SLOTS){
  const candidates=equipment.items.filter(item=>item.slot===slot&&(slot!=='weapon'||item.weaponType==='axe'));
  candidates.sort((a,z)=>quality(z)-quality(a)||a.instanceId.localeCompare(z.instanceId));equipment.equipped[slot]=candidates[0].instanceId;
 }
 // Unsocket inventory items first: every allocated gem below consumes one genuinely owned copy.
 for(const item of equipment.items)item.gems=item.gems.map(()=>null);
 const available={...collection.support},equipped=equippedItems(equipment);
 for(const [index,slot] of EQUIPMENT_SLOTS.entries()){
  const item=equipped[slot],active=ACTIVE_SKILLS[index];item.gems[0]=active.id;
  const ranked=GEMS.filter(g=>!g.trigger&&supportsActive(active,g.id)).sort((a,z)=>{
   const score=(g:typeof a)=>(g.more??1)*(1+(g.repeat??0))*(1+(g.dot??0))*(1+(g.crit??0)*.5)/(g.cooldown??1)/Math.sqrt(g.mana??1);
   return score(z)-score(a)||a.id.localeCompare(z.id);
  });
  const selected=new Set<string>();
  for(let socket=1;socket<item.gems.length;socket++){
   const gem=ranked.find(g=>(available[g.id]??0)>0&&!selected.has(g.id));if(!gem)break;
   item.gems[socket]=gem.id;selected.add(gem.id);available[gem.id]--;
  }
 }
 validateOwnedEquipmentGems(equipment,collection);
 p.build={...(p.build??newBuild()),equipment};p.build=allocateNodes(p.build,p.level);
}
function spendGrowth(p:HuntProgress){
 // Buy equally many native attack and health training levels, never beyond actual wallet/cost.
 for(;;){const kind=p.attackTraining<=p.healthTraining?'attack':'health',cost=trainingCost(p,kind);if(!cost||cost>p.gold)break;trainHunt(p,kind);}
 for(;;){const used=Object.values(p.traits).reduce((a,b)=>a+b,0);if(!traitPoints(p))break;const ability=traitOrder.slice(used%traitOrder.length).concat(traitOrder.slice(0,used%traitOrder.length)).find(id=>(p.traits[id]??0)<10);if(ability===undefined)break;buyTrait(p,ability);}
 // Summons take priority. Only the leftover soul gems pay actual native weapon-upgrade costs.
 for(;;){const weapon=equippedItems(p.equipment!).weapon,cost=equipmentUpgradeCost(weapon);if(!cost||cost>p.soulGem)break;const upgraded=upgradeEquipment(p.equipment!,p.soulGem,weapon.instanceId);p.equipment=upgraded.equipment;p.soulGem=upgraded.soulGem;}
 equipAndSocket(p);
}
function bench(p:HuntProgress,difficulty:number){
 const stats=heroStats(p),compiled=compileBuild(p.build),passive=compiled.passive,basic=compiled.basic,traits={valor:stats.valor,mental:stats.mental,focus:stats.focus,tenacity:stats.tenacity};
 const crit=passive.noCritical?0:Math.min(.9,basic.crit+stats.crit),critMultiplier=Math.max(1,basic.critMultiplier-1.5+stats.critMultiplier),expectedCrit=1+crit*(critMultiplier-1);
 const rawBasic=big(stats.attack).mul(50/6).mul(basic.effect*stats.basicDamageMultiplier*expectedCrit*(1+2*basic.tripleChance));
 const interval=averageAttackDuration/Math.max(.2,(1+basic.attackSpeed)*stats.attackSpeed);
 const normal=monsterProfile(difficulty,1001,false,0),boss=monsterProfile(difficulty,1031,true,9),normalDps=hybridOutgoing(rawBasic,'physical',traits,normal).mul(hybridHitChance(stats.focus,normal.traits.focus)/interval),bossDps=hybridOutgoing(rawBasic,'physical',traits,boss).mul(hybridHitChance(stats.focus,boss.traits.focus)/interval);
 const life=big(Math.max(1,(stats.maxHP+passive.lifeFlat)*(1+passive.life))),shield=big(Math.max(0,stats.maxHP*passive.energyShield+passive.shieldFlat)),pool=life.add(shield);
 const armourFactor=1-Math.min(.75,Math.max(0,passive.armour)/(1+Math.max(0,passive.armour)));
 const incoming=(monster:typeof boss)=>hybridIncoming(monster.attack.mul((1-passive.reduction)*stats.incomingDamageScale),'physical',monster.traits,traits).mul(armourFactor);
 const bossHit=incoming(boss),normalHit=incoming(normal),normalTtk=normal.hp.div(normalDps),bossTtk=boss.hp.div(bossDps),bossSurvival=pool.div(bossHit).mul(1.8/boss.haste);
 const skill=compiled.skills[0],skillCrit=passive.noCritical?0:Math.min(.9,skill.crit+stats.crit),skillCritMulti=Math.max(1,skill.critMultiplier-1.5+stats.critMultiplier),rawSkill=big(stats.attack).mul(110/6).mul(skill.effect*stats.skillDamageMultiplier*(1+skillCrit*(skillCritMulti-1))*(1+2*skill.tripleChance));
 return {difficulty,pack:dungeonProfile(difficulty).packMax,normalHp:amount(normal.hp),bossHp:amount(boss.hp),normalBasicDps:amount(normalDps),bossBasicDps:amount(bossDps),normalTtkSeconds:amount(normalTtk),bossTtkSeconds:amount(bossTtk),riftExpectedHit:amount(hybridOutgoing(rawSkill,skill.element,traits,boss).mul(hybridHitChance(stats.focus,boss.traits.focus))),normalPhysicalHit:amount(normalHit),bossPhysicalHit:amount(bossHit),bossNoAvoidanceSurvivalSeconds:amount(bossSurvival),threeNormalNoAvoidanceSurvivalSeconds:amount(pool.div(normalHit).mul(1.5/(3*normal.haste))),viable:normalTtk.lte(2.5)&&bossTtk.lte(45)&&bossTtk.lte(bossSurvival)};
}
function highestBenchmarkDifficulty(p:HuntProgress){
 if(!bench(p,1).viable)return 0;let low=1,high=HYBRID_BALANCE.maxDifficulty;
 while(low<high){const mid=Math.floor((low+high+1)/2);if(bench(p,mid).viable)low=mid;else high=mid-1;}return low;
}
function checkpoint(p:HuntProgress,day:number,spent:{gold:number;soul:number}){
 const stats=heroStats(p),items=equippedItems(p.equipment!),compiled=compileBuild(p.build);
 assert.ok(getBuildTree(p.build).spent<=buildBudget(p.level));
 assert.ok(Object.values(p.traits).reduce((a,b)=>a+b,0)<=p.level-1);
 assert.ok(p.attackTraining<=500&&p.healthTraining<=500&&p.gold>=0&&p.soulGem>=0);
 return {day,level:p.level,earnedBuildBudget:buildBudget(p.level),spentBuildPoints:getBuildTree(p.build).spent,nodes:[...p.build!.nodes],traitPointsSpent:Object.values(p.traits).reduce((a,b)=>a+b,0),unspentTraitPoints:traitPoints(p),traits:{...p.traits},attackTraining:p.attackTraining,healthTraining:p.healthTraining,cumulativeGoldSpent:spent.gold,cumulativeEquipmentUpgradeSoulGems:spent.soul,remainingGold:p.gold,remainingSoulGems:p.soulGem,equipmentPulls:p.gacha!.equipmentPulls,gemPulls:p.gacha!.gemPulls,equipment:EQUIPMENT_SLOTS.map(slot=>({slot,rarity:items[slot].rarity,level:items[slot].level,sockets:equipmentLinkCap(items[slot]),gems:[...items[slot].gems]})),stats:{attack:stats.attack,naturalHP:stats.naturalHP,incomingDamageScale:stats.incomingDamageScale,crit:stats.crit,critMultiplier:stats.critMultiplier,valor:stats.valor,mental:stats.mental,focus:stats.focus,tenacity:stats.tenacity,passiveLife:compiled.passive.life,passiveArmour:compiled.passive.armour,basicEffect:compiled.basic.effect},highestConservativeBenchmarkDifficulty:highestBenchmarkDifficulty(p),benchmarks:DIFFICULTIES.map(d=>bench(p,d))};
}
function simulate(activeCaps:boolean){
 const rng=random(SEED),p=newHuntProgress();p.idle=createIdleProgress(0);p.equipment=createStarterEquipment();p.gacha=createGachaState();p.gemCollection=createGemCollection();let serial=0;const spent={gold:0,soul:0};
 equipAndSocket(p);const checkpoints=[checkpoint(p,0,spent)];
 for(let day=1;day<=60;day++){
  accrueIdleProgress(p,day*DAY);
  if(activeCaps){p.xp+=HYBRID_BALANCE.dailyXpCap;p.gold+=HYBRID_BALANCE.dailyGoldCap;advanceIdleLevel(p);}
  for(const pool of poolSchedule){const roll=rollEquipmentBatch(p.equipment!,p.gacha!,p.soulGem,1,rng,()=>`hybrid_${++serial}`,pool);p.equipment=roll.equipment;p.gacha=roll.gacha;p.soulGem=roll.soulGem;}
  for(let i=0;i<8;i++){const roll=rollGemBatch(p.gemCollection!,p.gacha!,p.soulGem,1,rng);p.gemCollection=roll.gemCollection;p.gacha=roll.gacha;p.soulGem=roll.soulGem;}
  // Select today's best acquired gear before paying to upgrade it.
  equipAndSocket(p);const previousGold=p.gold,previousSoul=p.soulGem;spendGrowth(p);spent.gold+=previousGold-p.gold;spent.soul+=previousSoul-p.soulGem;
  if(CHECKPOINTS.includes(day))checkpoints.push(checkpoint(p,day,spent));
 }
 return {scenario:activeCaps?'daily-combat-cap-upper-bound':'idle-only',checkpoints};
}
const pointDays=[50,55,60,90].map(points=>{const level=points-11;let xp=0;for(let l=1;l<level;l++)xp+=idleLevelCost(l);return {points,level,xp,idle24hDays:rounded(xp/7200),withDailyCombatCapDays:rounded(xp/(7200+HYBRID_BALANCE.dailyXpCap))};});
const profileChecks=DIFFICULTIES.map(difficulty=>{const profile=dungeonProfile(difficulty),normal=monsterProfile(difficulty,1001),boss=monsterProfile(difficulty,1031,true,9);assert.ok(Number.isFinite(normal.hp.m)&&Number.isFinite(normal.attack.m));assert.ok(normal.elementalResistance<=.75&&normal.chaosResistance<=.75&&normal.physicalReduction<=.6);return {difficulty,pack:profile.packMax,hpScale:amount(profile.hpScale),attackScale:amount(profile.attackScale),bossHp:amount(boss.hp),bossAttack:amount(boss.attack),physicalReduction:normal.physicalReduction,elementalResistance:normal.elementalResistance,chaosResistance:normal.chaosResistance,haste:profile.haste,penetration:profile.penetration};});
for(let i=1;i<profileChecks.length;i++){assert.ok(big(profileChecks[i].hpScale).gt(profileChecks[i-1].hpScale));assert.ok(big(profileChecks[i].attackScale).gt(profileChecks[i-1].attackScale));}
const bandBoundaries=[100,1000].map(boundary=>{const before=dungeonProfile(boundary-1),at=dungeonProfile(boundary),after=dungeonProfile(boundary+1);return {boundary,packs:[before.packMax,at.packMax,after.packMax],hpRatioBefore:amount(at.hpScale.div(before.hpScale)),hpRatioAfter:amount(after.hpScale.div(at.hpScale)),attackRatioBefore:amount(at.attackScale.div(before.attackScale)),attackRatioAfter:amount(after.attackScale.div(at.attackScale))};});
const output={model:HYBRID_BALANCE.source,seed:SEED,assumptions:{claimEveryHours:24,offlineCapHours:24,dailyIdleXp:7200,dailyIdleGold:43200,dailySoulGems:1440,dailyCombatXpCap:HYBRID_BALANCE.dailyXpCap,dailyCombatGoldCap:HYBRID_BALANCE.dailyGoldCap,activeCapScenario:'An optimistic capped-income bound, not a claim that every build can earn the cap daily.',equipmentSummonsPerDay:8,gemSummonsPerDay:8,poolSchedule,paidCurrency:0,startingNodes:'Root plus only the 12 legitimately available starter points, allocated through adjacent non-keystone nodes.',nodeAllocation:'Greedy connected physical-damage/life choices; only actual level budget; no jewels or free nodes.',traits:'One earned point per account level, bought through native buyTrait with actual limits, round-robin across 13 abilities.',equipment:'Highest owned rarity per slot, axe weapons only; no free upgrades. Leftover summon currency pays actual native weapon-upgrade cost.',sockets:'Starter active gems, only owned compatible supports; no trigger assumptions.',goldTraining:'Balanced actual attack/health levels via native trainingCost/trainHunt; no free gold or levels.',benchmark:'Stationary physical basic attacks with actual native crit, hit chance, tree effects and timing; no active-skill DPS, culling, AoE, leech, regeneration, healing, potions, avoidance or block credit. TTK is continuous expected DPS, not exact discrete hit latency. Rift expected single hit is shown separately.',viableDefinition:'Normal TTK <=2.5 s; boss TTK <=45 s and <= physical no-avoidance survival with one boss strike/1.8 s, accelerated by actual haste. This is a conservative build benchmark, not a measured run result.',runRouteRooms:7,runRewards:'Actual routed rooms only; seven fully cleared rooms give 252–504 XP by difficulty before the unchanged shared 720 XP daily cap. No reward for unvisited branches.'},pointDays,profileChecks,bandBoundaries,zoneAndRouteBudgets:[1,100,1000,10000].map(difficulty=>{const budget=zoneRewardBudget(difficulty),target=dungeonProfile(difficulty).packMax,allocated={xp:0,gold:0};for(let ordinal=1;ordinal<=target;ordinal++){const reward=rewardForKill(difficulty,ordinal,target);allocated.xp+=reward.xp;allocated.gold+=reward.gold;}assert.deepEqual(allocated,budget);return {difficulty,zone:budget,allocatedFromActualKillOrdinals:allocated,sevenRoomRoute:{xp:budget.xp*7,gold:budget.gold*7},dailyXpCapEquivalentRuns:rounded(HYBRID_BALANCE.dailyXpCap/(budget.xp*7))};}),scenarios:[simulate(false),simulate(true)]};
for(const scenario of output.scenarios)for(const row of scenario.checkpoints){assert.equal(Object.values(row.traits).reduce((a,b)=>a+b,0),row.traitPointsSpent);assert.ok(row.traitPointsSpent<=row.level-1);}
console.log(JSON.stringify(output,null,2));
