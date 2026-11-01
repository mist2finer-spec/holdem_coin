import test from 'node:test';
import assert from 'node:assert/strict';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
import {big} from '../../src/components/rpg/combat-big';
import {hash} from '../../src/components/rpg/rogue/encounters';
import {newHuntProgress,heroStats} from '../../src/components/rpg/hunt-progression';
import {dungeonEncounter,monsterProfile,rewardForKill,zoneRewardBudget,HYBRID_BALANCE} from '../../src/components/rpg/hybrid-balance';
import {newBuild,changeBuild,getBuildTree,buildStart,equipJewel,type BuildState} from '../../src/components/rpg/hunt-build';
const idle={x:0,y:0,auto:false};
const small={initial:3,min:3,max:3,seconds:0,batch:3};
const close=(a:number,b:number,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function tick(g:RogueEngine,seconds:number){for(let i=0;i<Math.ceil(seconds*100);i++)g.step(.01,idle);}
function arena(build=newBuild(),difficulty=1,seed=123){
 const g=new RogueEngine(seed,small,1,difficulty);g.build=build;g.mobs=g.mobs.slice(0,1);
 const m=g.mobs[0];m.x=g.hero.x+70;m.hp=m.maxHP=1e6;m.until=999;m.traits={valor:0,mental:0,focus:0,tenacity:0};return g;
}
function damage(g:RogueEngine){return 1e6-g.mobs[0].hp;}
function allocate(b:BuildState,target:string){
 const tree=getBuildTree(b),graph=new Map(tree.nodes.map(n=>[n.id,[] as string[]]));for(const [a,c] of tree.edges){graph.get(a)!.push(c);graph.get(c)!.push(a);}
 const queue=[[buildStart(b).nodeId]],seen=new Set(queue[0]);for(const route of queue){if(route.at(-1)===target){for(const id of route.slice(1))if(!b.nodes.includes(id))b=changeBuild(b,`core-allocate-${id}`,79);return b;}for(const id of graph.get(route.at(-1)!)??[])if(!seen.has(id)){seen.add(id);queue.push([...route,id]);}}throw Error('Missing path');
}

test('difficulty is independent of hero level; live packs and BigInfinity monster profiles grow across boundaries',()=>{
 const cases=[[1,50],[100,50],[101,67],[200,67],[201,84],[900,184],[901,200],[1000,200],[1001,200],[10000,200]];
 for(const [difficulty,target] of cases){const g=new RogueEngine(3,undefined,1,difficulty),p=newHuntProgress();p.level=7800;g.setGrowth(p);assert.equal(g.view().wave.target,target);assert.equal(g.progression.dungeonLevel,difficulty);assert.equal(g.mobs.length,dungeonEncounter(difficulty).initial);assert.equal(g.mobs[0].bigMaxHP!,monsterProfile(difficulty,1001).hp.toString());}
 const low=new RogueEngine(3,undefined,1,1000),high=new RogueEngine(3,undefined,1,1001);assert.ok(big(high.mobs[0].bigHP!).gt(low.mobs[0].bigHP!));assert.ok(big(high.mobs[0].bigAttack!).gt(low.mobs[0].bigAttack!));assert.ok(high.mobs[0].elementalResistance!>low.mobs[0].elementalResistance!);assert.ok(high.encounter.haste>low.encounter.haste);assert.ok(high.encounter.penetration>low.encounter.penetration);
 const huge=new RogueEngine(3,undefined,'1e1000',HYBRID_BALANCE.maxDifficulty);assert.ok(big(huge.mobs[0].bigMaxHP!).e>1000);assert.ok(huge.mobs[0].hp>0);assert.doesNotThrow(()=>JSON.stringify(huge.view()));
 assert.equal(new RogueEngine(3,small,1,101).view().wave.target,3);
});

test('native baseline crit and absolute hero attack agree with real basic damage and snapshot',()=>{
 let seed=1;while(hash(seed+1)%10000>=500)seed++;
 const g=arena(newBuild(),1,seed),p=newHuntProgress();p.attackTraining=20;g.setGrowth(p);const stats=heroStats(p),view=g.view();
 close(view.compiled.basic.crit,stats.crit);close(view.compiled.basic.critMultiplier,stats.critMultiplier);assert.equal(view.combat.attack,big(stats.attack).toString());
 g.command({...idle,attack:true});tick(g,.3);close(damage(g),stats.attack*50/6*view.compiled.basic.effect*stats.critMultiplier);
 assert.equal(g.kills,0);assert.equal(g.progression.totalXp,0);
});

test('physical and magical skill hits apply the matching monster defense exactly once',()=>{
 for(const [active,field] of [['rift','physicalReduction'],['fireball','elementalResistance'],['dark','chaosResistance']] as const){
  const build=changeBuild(newBuild(),`active-0-${active}`),a=arena(build),b=arena(build);b.mobs[0][field]=.5;
  a.command({...idle,skill:0});b.command({...idle,skill:0});tick(a,.3);tick(b,.3);assert.ok(damage(a)>0);close(damage(b)/damage(a),.5);
 }
});

test('DoT stores raw damage, applies resistance once per tick, and does not generate critical triggers',()=>{
 const build=changeBuild(changeBuild(newBuild(),'active-0-lacerate'),'gem-1-0-triggercrit'),a=arena(build),b=arena(build);b.mobs[0].physicalReduction=.5;
 a.command({...idle,skill:0});b.command({...idle,skill:0});tick(a,.3);tick(b,.3);const direct=damage(a);close(damage(b)/direct,.5);
 tick(a,2);tick(b,2);assert.ok(damage(a)>direct);close(damage(b)/damage(a),.5);assert.equal(a.cooldowns[1],0);
});

test('granted skills inherit training, crit and monster mitigation without entering a trigger loop',()=>{
 let build=allocate(newBuild(),'jewel_9');build=equipJewel(build,'jewel_9',{instanceId:'cast',jewelId:'axemancluster',seed:1},79);build=allocate(allocate(build,'cluster_cast_2'),'cluster_cast_6');
 const a=arena(build),b=arena(build),grown=arena(build),p=newHuntProgress();p.attackTraining=20;grown.setGrowth(p);b.mobs[0].physicalReduction=.5;b.mobs[0].elementalResistance=.5;b.mobs[0].chaosResistance=.5;
 tick(a,.3);tick(b,.3);tick(grown,.3);assert.ok(damage(a)>0);close(damage(b)/damage(a),.5);assert.ok(damage(grown)>damage(a));
 assert.ok(grown.view().compiled.grantedSkills.every(c=>c.crit>=heroStats(p).crit&&!c.canTriggerEvents));assert.ok(grown.cooldowns.every(n=>n===0));
});

test('native elemental attacks use progressed BigInfinity attack and haste, while pause freezes the timeline',()=>{
 const make=(difficulty:number)=>{const g=arena(newBuild(),difficulty);const m=g.mobs[0],p=monsterProfile(difficulty,1153);Object.assign(m,{species:1153,x:g.hero.x+180,bigAttack:p.attack.toString(),traits:p.traits,until:0});return g;};
 const low=make(1),high=make(101);tick(low,2);tick(high,2);assert.ok(low.hero.hp<low.hero.maxHP);assert.ok(high.hero.hp<low.hero.hp);const before=high.view();for(let i=0;i<100;i++)high.step(.01,{...idle,paused:true});assert.deepEqual(high.view().enemyCombat,before.enemyCombat);assert.equal(high.elapsed,before.elapsed);
 const huge=make(HYBRID_BALANCE.maxDifficulty);tick(huge,2);assert.equal(huge.status,'dead');assert.equal(huge.hero.hp,0);assert.doesNotThrow(()=>JSON.stringify(huge.view()));
});

test('physical kills, culling and repeated hits award one authoritative reward per actual death',()=>{
 const g=arena(allocate(newBuild(),'keystone_culling_strike'));g.mobs[0].hp=150;g.mobs[0].maxHP=1000;g.command({...idle,skill:0});tick(g,.3);assert.equal(g.mobs[0].hp,0);
 const expected=rewardForKill(1,1,3);assert.deepEqual(g.progression,{dungeonLevel:1,totalXp:expected.xp,totalGold:expected.gold,totalSoulGem:0,totalKills:1,totalBossKills:0});assert.equal(g.view().rewards.length,1);tick(g,2);g.command({...idle,skill:1});tick(g,1);assert.equal(g.progression.totalKills,1);assert.equal(g.progression.totalGold,expected.gold);
 const full=new RogueEngine(3,small);for(const m of full.mobs){m.x=full.hero.x+40;m.hp=1;m.until=999;}full.command({...idle,skill:0});tick(full,.3);assert.equal(full.kills,3);assert.deepEqual({xp:full.progression.totalXp,gold:full.progression.totalGold},zoneRewardBudget(1));assert.equal(new Set(full.view().rewards.map(r=>r.mobId)).size,3);
});

test('DoT kill rewards are emitted once even while later ticks remain queued',()=>{
 const g=arena(changeBuild(newBuild(),'active-0-lacerate'));g.command({...idle,skill:0});tick(g,.3);g.mobs[0].hp=1;tick(g,.6);assert.equal(g.kills,1);const p=g.progression;tick(g,3);assert.deepEqual(g.progression,p);assert.equal(g.view().rewards.length,1);
});

test('Valor, Mental and Focus contests affect actual hits through their matching channels',()=>{
 for(const [active,trait] of [['rift','valor'],['fireball','mental']] as const){
  const build=changeBuild(newBuild(),`active-0-${active}`),plain=arena(build),defended=arena(build),unrelated=arena(build);
  defended.mobs[0].traits![trait]=100000;unrelated.mobs[0].traits![trait==='valor'?'mental':'valor']=100000;
  for(const g of [plain,defended,unrelated]){g.command({...idle,skill:0});tick(g,.3);}
  close(damage(defended)/damage(plain),.8);close(damage(unrelated),damage(plain));
 }
 let seed=1;while(hash(seed+1)%10000<8000)seed++;
 const hit=arena(newBuild(),1,seed),miss=arena(newBuild(),1,seed);miss.mobs[0].traits!.focus=100000;
 for(const g of [hit,miss]){g.command({...idle,attack:true});tick(g,.3);}assert.ok(damage(hit)>0);assert.equal(damage(miss),0);assert.equal(miss.kills,0);
});

test('native crowd control uses the player Tenacity stat on the recovered boss timeline',()=>{
 const firstStun=(tenacity:boolean)=>{const g=arena(),p=newHuntProgress();if(tenacity)p.traits[11]=10;g.setGrowth(p);Object.assign(g.mobs[0],{species:1031,boss:true,radius:22,x:g.hero.x+100,until:0});for(let i=0;i<2500;i++){if(g.mobs[0].castSkill===2027)g.hero.x=g.mobs[0].x-50;g.step(.01,idle);const stunned=g.view().debuff.stunned;if(stunned>0)return {at:g.elapsed,duration:stunned};}assert.fail('Native slime boss did not apply crowd control');};
 const a=firstStun(false),b=firstStun(true);close(a.at,b.at);assert.ok(b.duration>0&&b.duration<a.duration);assert.ok(b.duration>=a.duration*.5);
});

test('last normal kill and newly spawned boss kill in one repeated cast retain one boss reward transition',()=>{
 const g=new RogueEngine(3,{initial:2,min:2,max:2,seconds:0,batch:2});g.build=changeBuild(newBuild(),'gem-0-0-echo');g.room=9;g.mobs=[];Object.assign(g.hero,g.map.rooms[9].center);g.visited.add(9);(g as unknown as {spawnRoom:(room:number)=>void}).spawnRoom(9);
 for(const m of g.mobs){m.hp=1;m.x=g.hero.x+40;m.until=999;}g.command({...idle,skill:0});
 for(let i=0;i<80;i++){for(const m of g.mobs)if(m.hp>0){m.hp=1;m.x=g.hero.x+40;}g.step(.01,idle);}
 assert.equal(g.kills,2);assert.equal(g.progression.totalBossKills,1);assert.equal(g.progression.totalXp,zoneRewardBudget(1).xp);assert.equal(g.progression.totalGold,zoneRewardBudget(1).gold);assert.equal(g.view().wave.bossSpawned,true);tick(g,1);assert.equal(g.progression.totalBossKills,1);
});

test('post-1000 haste and penetration change real native impacts even at identical attack and traits',()=>{
 const firstImpact=(difficulty:number)=>{const g=arena(newBuild(),difficulty),m=g.mobs[0];Object.assign(m,{species:1153,x:g.hero.x+180,bigAttack:'65',traits:{valor:0,mental:0,focus:0,tenacity:0},until:0});for(let i=0;i<500;i++){g.step(.01,idle);if(g.hero.hp<g.hero.maxHP)return {time:g.elapsed,damage:g.hero.maxHP-g.hero.hp};}assert.fail('Expected a native projectile impact');};
 const base=firstImpact(1000),later=firstImpact(2000);assert.ok(later.time<base.time);assert.ok(later.damage>base.damage);
});
