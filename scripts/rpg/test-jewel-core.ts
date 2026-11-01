import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_NODES,CORE_EDGES,CHARACTER_STARTS,newBuild,changeBuild,buildStart,buildView,migrateBuild,validateBuild,getBuildTree,equipJewel,unequipJewel,passiveBuild,compileSkill,compileGrantedSkills,type BuildState,type JewelInstance} from '../../src/components/rpg/hunt-build';
import {JEWEL_CATALOG} from '../../src/components/rpg/jewel-catalog';
import {TIMELESS_RADIUS,validateJewelInstance} from '../../src/components/rpg/jewel-system';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
import {big} from '../../src/components/rpg/combat-big';
const idle={x:0,y:0,auto:false};
function instance(jewelId:string,instanceId=jewelId,seed=1,conqueror?:string):JewelInstance{return {jewelId,instanceId,seed,...(conqueror?{conqueror}:{})};}
function path(build:BuildState,target:string){const tree=getBuildTree(build),adj=new Map(tree.nodes.map(n=>[n.id,[] as string[]]));for(const [a,b] of tree.edges){adj.get(a)!.push(b);adj.get(b)!.push(a);}const queue=[[buildStart(build).nodeId]],seen=new Set(queue[0]);for(const route of queue){if(route.at(-1)===target)return route;for(const n of adj.get(route.at(-1)!)??[])if(!seen.has(n)){seen.add(n);queue.push([...route,n]);}}throw Error(`Missing ${target}`);}
function allocate(build:BuildState,target:string){for(const id of path(build,target).slice(1))if(!build.nodes.includes(id))build=changeBuild(build,`core-allocate-${id}`,40);return build;}
function arena(build=newBuild(),scale='1'){const g=new RogueEngine(111,undefined,scale);g.build=build;g.mobs=g.mobs.slice(0,1);g.mobs[0].x=g.hero.x+70;g.mobs[0].hp=g.mobs[0].maxHP=100000;g.mobs[0].until=999;g.command(idle);return g;}
function tick(g:RogueEngine,seconds:number){for(let i=0;i<Math.ceil(seconds*100);i++)g.step(.01,idle);}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('780 categories, all 222 legacy IDs, nine attribute positions and 8/12/5 sockets are exact',()=>{
 const counts=Object.fromEntries(['small','notable','keystone','socket','start','hub','travel'].map(k=>[k,CORE_NODES.filter(n=>n.category===k).length]));assert.deepEqual(counts,{small:350,notable:250,keystone:25,socket:25,start:9,hub:80,travel:41});assert.equal(CORE_NODES.filter(n=>n.legacy).length,222);
 assert.deepEqual(['timeless','large','unique'].map(t=>CORE_NODES.filter(n=>n.socketType===t).length),[8,12,5]);assert.equal(CORE_NODES.filter(n=>n.kind==='keystone').length,25);
 for(const start of CHARACTER_STARTS){const n=CORE_NODES.find(n=>n.id===start.nodeId)!;close(Math.hypot(n.x-1750,n.y-1750),start.id==='blonde-office'?0:400);}
 for(const id of ['root','0_1','2_17','chaosinoculation','resolute','start_balance','travel_8_2'])assert.ok(CORE_NODES.some(n=>n.id===id&&n.legacy));
 for(const [a,b] of CORE_EDGES)assert.ok(a!==b&&CORE_NODES.some(n=>n.id===a)&&CORE_NODES.some(n=>n.id===b));
});

test('Glorious Vanity deterministically converts INT to DEX, ES to evasion and spell to attack speed without mutating base',()=>{
 let b=allocate(newBuild('pink-glasses'),'jewel_3');const before=JSON.stringify(CORE_NODES);b=equipJewel(b,'jewel_3',instance('gloriousvanity','vaal',993,'Doryani'),40);const tree=getBuildTree(b),socket=CORE_NODES.find(n=>n.id==='jewel_3')!,eligible=CORE_NODES.filter(n=>!n.startFor&&n.kind!=='socket'&&n.kind!=='keystone'&&Math.hypot(n.x-socket.x,n.y-socket.y)<=TIMELESS_RADIUS);
 assert.ok(eligible.some(n=>(n.intelligence??0)>0));assert.ok(eligible.some(n=>(n.spellDamage??0)>0));
 for(const original of eligible){const n=tree.nodes.find(n=>n.id===original.id)!;assert.equal(n.transformedBy,'vaal');assert.equal(n.intelligence,undefined);assert.equal(n.spellDamage,undefined);assert.equal(n.energyShield,undefined);close(n.dexterity??0,(original.dexterity??0)+(original.intelligence??0)+(original.strength??0));close(n.lifeFlat??0,-1);}
 assert.equal(JSON.stringify(CORE_NODES),before);assert.deepEqual(getBuildTree(migrateBuild(b,40)),tree);assert.equal(unequipJewel(b,'jewel_3',40).jewels,undefined);
});

test('Atziri and Xibaqua convert actual DEX/STR nodes to INT and every Timeless family changes stats',()=>{
 for(const [socket,start,variant,key] of [['jewel_2','boy-hoodie','Atziri','dexterity'],['jewel_1','hong','Xibaqua','strength']] as const){let b=allocate(newBuild(start),socket);b=equipJewel(b,socket,instance('gloriousvanity',variant,7,variant),40);const tree=getBuildTree(b),changed=tree.nodes.filter(n=>n.transformedBy);assert.ok(changed.some(n=>(CORE_NODES.find(o=>o.id===n.id)?.[key]??0)>0));for(const n of changed)assert.equal(n[key],undefined);assert.ok(changed.some(n=>(n.intelligence??0)>0));}
 for(const [id,conqueror] of [['lethalpride','Kaom'],['brutalrestraint','Asenath'],['militantfaith','Avarus'],['eleganthubris','Caspiro']] as const){const b=equipJewel(allocate(newBuild(),'jewel_1'),'jewel_1',instance(id,id,2,conqueror),40);assert.ok(getBuildTree(b).transformations.length>0);const stats=passiveBuild(b);if(id==='militantfaith')assert.ok(stats.devotion>0);if(id==='eleganthubris'){assert.ok(stats.tripleChance>0);assert.ok(getBuildTree(b).spent>b.nodes.length-1);}}
});

test('overlapping Timeless transformations use only latest equipment, reversal restores previous mapping',()=>{
 let b=allocate(allocate(newBuild(),'jewel_1'),'jewel_5');b=equipJewel(b,'jewel_1',instance('lethalpride','first',1,'Kaom'),40);b=equipJewel(b,'jewel_5',instance('gloriousvanity','second',9,'Doryani'),40);
 const a=CORE_NODES.find(n=>n.id==='jewel_1')!,c=CORE_NODES.find(n=>n.id==='jewel_5')!,overlap=getBuildTree(b).nodes.filter(n=>n.transformedBy&&Math.hypot(n.x-a.x,n.y-a.y)<=TIMELESS_RADIUS&&Math.hypot(n.x-c.x,n.y-c.y)<=TIMELESS_RADIUS);assert.ok(overlap.length>0);assert.ok(overlap.every(n=>n.transformedBy==='second'));
 const reverted=getBuildTree(unequipJewel(b,'jewel_5',40));for(const n of overlap)assert.equal(reverted.nodes.find(v=>v.id===n.id)!.transformedBy,'first');
});

test('Large10 Medium5 Small3 create exactly798 server-derived nodes and refunds enforce subtree ownership',()=>{
 let b=allocate(newBuild(),'jewel_9');b=equipJewel(b,'jewel_9',instance('axemancluster','large'),40);assert.equal(getBuildTree(b).nodes.length,790);b=allocate(b,'cluster_large_4');b=equipJewel(b,'cluster_large_4',instance('lifecluster','medium'),40);b=allocate(b,'cluster_medium_4');b=equipJewel(b,'cluster_medium_4',instance('smalllife','small'),40);assert.equal(getBuildTree(b).nodes.length,798);
 b=allocate(b,'cluster_small_2');assert.throws(()=>unequipJewel(b,'jewel_9',40));assert.throws(()=>unequipJewel(b,'cluster_large_4',40));assert.throws(()=>unequipJewel(b,'cluster_medium_4',40));assert.throws(()=>changeBuild(b,'core-refund-cluster_medium_4',40));
 const original=JSON.stringify(b);assert.deepEqual(migrateBuild(b,40),b);assert.equal(JSON.stringify(b),original);validateBuild(b,40);assert.ok(passiveBuild(b).life>=.15);
 for(const id of ['cluster_small_2','cluster_small_1','cluster_small_0'])b=changeBuild(b,`core-refund-${id}`,40);b=unequipJewel(b,'cluster_medium_4',40);assert.equal(getBuildTree(b).nodes.length,795);assert.equal(changeBuild(b,'core-reset',40).jewels,undefined);
});

test('unallocated sockets, wrong tier, forged IDs/seeds/orders and third Large are rejected atomically',()=>{
 const start=newBuild();assert.throws(()=>equipJewel(start,'jewel_1',instance('lethalpride','x',1,'Kaom'),40));let b=allocate(newBuild(),'jewel_9');assert.throws(()=>equipJewel(b,'jewel_9',instance('smalllife'),40));b=equipJewel(b,'jewel_9',instance('axemancluster','one'),40);assert.throws(()=>equipJewel(b,'jewel_9',instance('axemancluster','two'),40));assert.throws(()=>equipJewel(b,'cluster_one_4',instance('lifecluster'),40));
 b=allocate(b,'jewel_10');b=equipJewel(b,'jewel_10',instance('guardiancluster','two'),40);b=allocate(b,'jewel_11');assert.throws(()=>equipJewel(b,'jewel_11',instance('arcanecluster','three'),40),/최대 2/);
 for(const seed of [0,-1,10001,NaN,1.2])assert.throws(()=>validateJewelInstance(instance('crimson','a',seed)));assert.throws(()=>validateJewelInstance(instance('gloriousvanity','a',1,'Fake')));assert.throws(()=>validateJewelInstance(instance('crimson','../x')));
 for(const change of [{instanceId:'one'},{order:1},{socketId:'cluster_fake_4'}]){const forged=structuredClone(b);Object.assign(forged.jewels![1],change);assert.throws(()=>validateBuild(forged,40));}
 assert.throws(()=>changeBuild(b,'core-allocate-cluster_fake_0',40));assert.equal(start.jewels,undefined);
});

test('normal rolls, path-distance Split, matched Forbidden pair and conditional Watcher never bypass allocation',()=>{
 let b=allocate(newBuild(),'jewel_21');const base=passiveBuild(b);const split=equipJewel(b,'jewel_21',instance('splitpersonality'),40);assert.ok(passiveBuild(split).life>base.life);assert.ok(passiveBuild(split).life-base.life<=.25);
 b=allocate(b,'jewel_22');b=equipJewel(b,'jewel_21',instance('forbiddenflame','flame',2),40);const unpaired=passiveBuild(b);let matched=equipJewel(b,'jewel_22',instance('forbiddenflesh','flesh',2),40);close(passiveBuild(matched).life-unpaired.life,.12);const mismatch=equipJewel(b,'jewel_22',instance('forbiddenflesh','flesh',3),40);close(passiveBuild(mismatch).life,unpaired.life);
 matched=unequipJewel(matched,'jewel_22',40);assert.equal(passiveBuild(matched).life,unpaired.life);const watcher=equipJewel(allocate(newBuild(),'jewel_21'),'jewel_21',instance('watcherseye'),40);assert.deepEqual(getBuildTree(watcher).conditionalJewels,['watcherseye']);
 const pristine=allocate(newBuild(),'jewel_21'),normal=equipJewel(pristine,'jewel_21',instance('crimson'),40);assert.ok(passiveBuild(normal).strength>passiveBuild(pristine).strength);assert.equal(JEWEL_CATALOG.filter(j=>j.kind==='timeless').length,5);
});

test('cluster skill grants work outside six links, consume mana and cannot form a trigger chain',()=>{
 let b=allocate(newBuild(),'jewel_9');b=equipJewel(b,'jewel_9',instance('axemancluster','cast',1),40);for(const id of ['cluster_cast_2','cluster_cast_6'])b=allocate(b,id);const grants=compileGrantedSkills(b);assert.ok(grants.length>0);assert.ok(grants.every(s=>!s.canTriggerEvents&&s.trigger===null));assert.equal(b.links.length,6);const g=arena(b),mana=g.mana;tick(g,.3);assert.ok(g.mobs[0].hp<100000);assert.ok(g.mana<mana);assert.equal(g.hero.motion?.build?.canTriggerEvents,false);assert.ok(g.cooldowns.every(c=>c===0));
});

test('new defensive keystones settle BigInfinity MoM, EB, Blood Magic and culling in live combat',()=>{
 const mom=arena(allocate(newBuild(),'keystone_mind_over_matter'),'1e1000');const before=mom.mana;mom.receiveDamage('5e1003');assert.ok(mom.mana<before);assert.ok(big(mom.hero.bigHP!).gt(0));
 const eb=arena(allocate(allocate(newBuild(),'keystone_eldritch_battery'),'arcane_1_1'));assert.equal(eb.view().defense.maxShield,'0');assert.ok(eb.maxMana>100);
 const bm=arena(allocate(newBuild(),'keystone_blood_magic')),health=big(bm.hero.bigHP!),mana=bm.mana;bm.command({...idle,skill:0});assert.ok(big(bm.hero.bigHP!).lt(health));assert.equal(bm.mana,mana);
 const culled=arena(allocate(newBuild(),'keystone_culling_strike'));culled.mobs[0].hp=150;culled.mobs[0].maxHP=1000;culled.command({...idle,skill:0});tick(culled,.3);assert.equal(culled.mobs[0].hp,0);assert.equal(culled.kills,1);
});

test('cast totals retain actual original duration after edits and paused clocks do not advance',()=>{
 const g=arena(changeBuild(newBuild(),'gem-0-0-power'));g.command({...idle,skill:0});const total=g.cooldownTotals[0];close(total,5*1.15);tick(g,.2);g.build=changeBuild(newBuild(),'gem-0-0-quick');const remaining=g.cooldowns[0];assert.ok(remaining<total);close(g.view().cooldownTotals[0],total);for(let i=0;i<100;i++)g.step(.01,{...idle,paused:true});close(g.cooldowns[0],remaining);close(g.cooldownTotals[0],total);tick(g,.3);assert.ok(g.cooldowns[0]<remaining);
});
