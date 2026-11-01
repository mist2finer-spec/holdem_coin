import test from 'node:test';
import assert from 'node:assert/strict';
import {big} from '../../src/components/rpg/combat-big';
import {relativeStat,accuracy,effectDuration} from '../../src/components/rpg/hunt-formulas';
import {HYBRID_BALANCE,dungeonDifficulty,dungeonProfile,dungeonEncounter,monsterProfile,hybridHitChance,hybridControlDuration,hybridTraitMultiplier,hybridResistance,hybridOutgoing,hybridIncoming,zoneRewardBudget,rewardForKill} from '../../src/components/rpg/hybrid-balance';

test('ten 100-difficulty bands reach 200 inclusive of boss and then remain bounded',()=>{
 const expected=[50,67,84,100,117,134,150,167,184,200];
 for(let band=0;band<10;band++)for(const level of [band*100+1,(band+1)*100]){
  const p=dungeonProfile(level),e=dungeonEncounter(level);assert.equal(p.packMax,expected[band]);assert.equal(e.min,expected[band]);assert.equal(e.max,expected[band]);
  assert.ok(e.initial<=e.min);assert.ok(e.batch>=1);assert.ok(e.seconds>0);
 }
 for(const level of [1000,1001,10_000,1_000_000])assert.equal(dungeonEncounter(level).max,200);
 assert.equal(dungeonDifficulty(Number.MAX_SAFE_INTEGER),1_000_000);assert.equal(dungeonDifficulty(0),1);
 for(const invalid of [NaN,Infinity,-Infinity,1.5,1e100])assert.throws(()=>dungeonProfile(invalid));
});

test('HP, attack, defensive stats and traits increase continuously across both pack boundaries',()=>{
 for(const boundary of [100,200,900,1000,1001]){
  const before=monsterProfile(boundary-1,1001),at=monsterProfile(boundary,1001),after=monsterProfile(boundary+1,1001);
  for(const [lo,hi] of [[before,at],[at,after]]){
   assert.ok(hi.hp.gt(lo.hp));assert.ok(hi.attack.gt(lo.attack));assert.ok(hi.hp.div(lo.hp).lt(1.01));assert.ok(hi.attack.div(lo.attack).lt(1.01));
   assert.ok(hi.physicalReduction>lo.physicalReduction);assert.ok(hi.elementalResistance>lo.elementalResistance);assert.ok(hi.chaosResistance>lo.chaosResistance);
   for(const key of ['valor','mental','focus','tenacity'] as const)assert.ok(hi.traits[key]>lo.traits[key]);
  }
 }
 let previous=monsterProfile(1,1001);
 for(let d=2;d<=2000;d++){
  const next=monsterProfile(d,1001);assert.ok(next.hp.gt(previous.hp));assert.ok(next.attack.gt(previous.attack));
  assert.ok(next.physicalReduction>=previous.physicalReduction);assert.ok(next.elementalResistance>=previous.elementalResistance);assert.ok(next.chaosResistance>=previous.chaosResistance);previous=next;
 }
});

test('difficulty 1000 is a population ceiling, not an HP/attack/defense/mechanics ceiling',()=>{
 const before=monsterProfile(1000,1153,true,9),after=monsterProfile(2000,1153,true,9),far=monsterProfile(1_000_000,1153,true,9);
 assert.ok(after.hp.gt(before.hp));assert.ok(after.attack.gt(before.attack));assert.ok(after.elementalResistance>before.elementalResistance);assert.ok(after.chaosResistance>before.chaosResistance);
 assert.ok(after.haste>before.haste);assert.ok(after.penetration>before.penetration);assert.ok(far.mechanicTier>before.mechanicTier);
 assert.ok(far.hp.gt('1e1000'));assert.ok(far.attack.gt('1e800'));assert.ok(Number.isFinite(far.hp.m)&&Number.isSafeInteger(far.hp.e));
 for(const level of [1,100,1000,10_000,100_000,1_000_000]){
  const p=monsterProfile(level,1323,true,9);
  assert.ok(p.physicalReduction>=0&&p.physicalReduction<=.75);assert.ok(p.elementalResistance>=0&&p.elementalResistance<=.75);assert.ok(p.chaosResistance>=0&&p.chaosResistance<=.75);
  assert.ok(p.haste>=1&&p.haste<=1.35);assert.ok(p.penetration>=0&&p.penetration<=.2);
 }
});

test('native Focus, Tenacity, Valor and Mental contests preserve recovered coefficients',()=>{
 for(const attacker of [0,30,300,1000])for(const defender of [0,30,300,1000]){
  assert.equal(hybridHitChance(attacker,defender),accuracy(attacker,defender));
  assert.equal(hybridControlDuration(2,attacker,defender),effectDuration(2,attacker,defender));
  assert.equal(hybridTraitMultiplier('physical',{valor:attacker},{valor:defender}),1+relativeStat(attacker,defender,'Valor'));
  assert.equal(hybridTraitMultiplier('fire',{mental:attacker},{mental:defender}),1+relativeStat(attacker,defender,'Mental'));
 }
 assert.equal(hybridTraitMultiplier('physical',{mental:1000},{}),1);assert.equal(hybridTraitMultiplier('cold',{valor:1000},{}),1);
 for(const n of [NaN,Infinity,-Infinity,Number.MAX_VALUE,-Number.MAX_VALUE]){
  const hit=hybridHitChance(n,-n),duration=hybridControlDuration(n,n,-n),damage=hybridTraitMultiplier('physical',{valor:n},{valor:-n});
  assert.ok(Number.isFinite(hit)&&hit>=.8&&hit<=1);assert.ok(Number.isFinite(duration)&&duration>=0&&duration<=5400);assert.ok(Number.isFinite(damage)&&damage>=.8&&damage<=1.2);
 }
});

test('resistance is capped before subtractive penetration; negative resistance increases damage',()=>{
 assert.equal(hybridResistance(.95,.1),.65);assert.equal(hybridResistance(0,.2),-.2);assert.equal(hybridResistance(-.5,.5),-.6);
 assert.equal(hybridResistance(5,0),.75);assert.equal(hybridResistance(-5,0),-.6);assert.equal(hybridResistance(.4,-.5),.4);
 assert.ok(hybridOutgoing(100,'fire',{}, {elementalResistance:0},.2).eq(120));
 assert.ok(hybridOutgoing(100,'chaos',{}, {chaosResistance:.5}).eq(50));
 assert.ok(hybridOutgoing(100,'fire',{}, {elementalResistance:.95},.1).sub(35).abs().lt(1e-12));
 assert.ok(hybridOutgoing(100,'physical',{}, {physicalReduction:.5,elementalResistance:.75},.5).eq(50));
});

test('Decimal combat remains finite and authoritative above Number range',()=>{
 const amount=big('1e100000'),profile=monsterProfile(1_000_000,1301,true,9),hit=hybridOutgoing(amount,'fire',{mental:1e9},profile,.2),incoming=hybridIncoming(amount,'physical',profile.traits,{valor:0});
 assert.ok(hit.gt('1e99999'));assert.ok(hit.lt(amount.mul(2)));assert.ok(incoming.gte(amount));assert.ok(incoming.lte(amount.mul(1.2)));
 assert.equal(hit.e,99999);assert.ok(Number.isFinite(hit.m));assert.ok(hybridOutgoing(0,'physical',{},profile).eq(0));
 assert.throws(()=>hybridOutgoing(-1,'physical',{},profile));assert.throws(()=>hybridIncoming(-1,'fire',{},{}));
});

test('one zone pays one deterministic budget regardless of density and kill chunking',()=>{
 for(const d of [1,100,101,500,1000,1_000_000]){
  const target=dungeonEncounter(d).max,budget=zoneRewardBudget(d);let xp=0,gold=0;
  for(let k=1;k<=target;k++){const reward=rewardForKill(d,k,target);assert.ok(Number.isSafeInteger(reward.xp)&&reward.xp>=0);assert.ok(Number.isSafeInteger(reward.gold)&&reward.gold>=0);xp+=reward.xp;gold+=reward.gold;}
  assert.equal(xp,budget.xp);assert.equal(gold,budget.gold);assert.ok(xp>=36&&xp<=72);assert.ok(gold>=432&&gold<=864);
 }
 assert.equal(zoneRewardBudget(1).xp*7,252);assert.equal(zoneRewardBudget(1).gold*7,3024);
 assert.equal(zoneRewardBudget(1000).xp*7,504);assert.equal(zoneRewardBudget(1000).gold*7,6048);assert.equal(HYBRID_BALANCE.dailyXpCap,720);assert.equal(HYBRID_BALANCE.dailyGoldCap,8640);
 for(const [ordinal,target] of [[0,50],[51,50],[1,0],[1,201],[1.5,50],[1,NaN]])assert.throws(()=>rewardForKill(1,ordinal,target));
});

test('higher difficulty increases zone XP up to twice the starter budget without changing daily pacing cap',()=>{
 for(const [difficulty,xp] of [[1,36],[10,48],[100,60],[1000,72],[1001,72],[1_000_000,72]])assert.equal(zoneRewardBudget(difficulty).xp,xp);
 let previous=zoneRewardBudget(1).xp;
 for(let difficulty=2;difficulty<=1100;difficulty++){const xp=zoneRewardBudget(difficulty).xp;assert.ok(xp>=previous&&xp<=72);previous=xp;}
 for(const difficulty of [1,1000])for(const target of [50,200]){
  let total=0;for(let ordinal=1;ordinal<=target;ordinal++)total+=rewardForKill(difficulty,ordinal,target).xp;
  assert.equal(total,zoneRewardBudget(difficulty).xp);
 }
 assert.equal(Math.min(504*2,HYBRID_BALANCE.dailyXpCap),720);
 assert.equal(HYBRID_BALANCE.dailyXpCap/(5*60*24),.1);
});
