import test from 'node:test';
import assert from 'node:assert/strict';
import {newBuild,changeBuild,compileBuild,compileSkill,validateBuild,getBuildTree,getActiveSkills,buildView,equipJewel,buildStart,buildBudget,type BuildState} from '../../src/components/rpg/hunt-build';
import {createStarterEquipment,equippedItems,equipmentLinkCap,EQUIPMENT_SLOTS,type EquipmentState,type EquipmentSlot} from '../../src/components/rpg/idle-equipment';
import {CHARACTER_IDENTITIES,forbiddenSeed,forbiddenIdentity} from '../../src/components/rpg/character-identities';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {newHuntProgress} from '../../src/components/rpg/hunt-progression';
const idle={x:0,y:0,auto:false};
const close=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function equipped():BuildState{return {...newBuild(),equipment:createStarterEquipment()};}
function group(b:BuildState,slot:EquipmentSlot,gems:(string|null)[],rarity:'normal'|'ancient'='ancient'){
 const item=equippedItems(b.equipment!)[slot];item.rarity=rarity;item.gems=[...gems,...Array(Math.max(0,equipmentLinkCap(item)-gems.length)).fill(null)];return item;
}
function clearSlots(b:BuildState){for(const item of b.equipment!.items)item.gems.fill(null);return b;}
function allocate(b:BuildState,target:string){const tree=getBuildTree(b),graph=new Map(tree.nodes.map(n=>[n.id,[] as string[]]));for(const [a,c] of tree.edges){graph.get(a)!.push(c);graph.get(c)!.push(a);}const queue=[[buildStart(b).nodeId]],seen=new Set(queue[0]);for(const route of queue){if(route.at(-1)===target){for(const id of route.slice(1))if(!b.nodes.includes(id))b=changeBuild(b,`core-allocate-${id}`,79);return b;}for(const id of graph.get(route.at(-1)!)??[])if(!seen.has(id)){seen.add(id);queue.push([...route,id]);}}throw Error('Missing path');}
function pair(b:BuildState,flame:number,flesh:number){b=allocate(allocate(b,'jewel_21'),'jewel_22');b=equipJewel(b,'jewel_21',{instanceId:'flame',jewelId:'forbiddenflame',seed:flame},79);return equipJewel(b,'jewel_22',{instanceId:'flesh',jewelId:'forbiddenflesh',seed:flesh},79);}
function rogue(b:BuildState){const g=new RogueEngine(211);g.build=b;g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+70;m.hp=m.maxHP=1000000;m.until=999;g.command(idle);return g;}
function hunt(b:BuildState){const p=newHuntProgress();p.build=b;const g=new HuntEngine(undefined,1,{progress:p});g.enemyX=g.x+70;g.enemyHP=g.enemies[0].maxHP=1000000;return g;}
function tick(g:RogueEngine|HuntEngine,seconds:number){for(let i=0;i<Math.ceil(seconds*100);i++){if(g instanceof RogueEngine)g.step(.01,idle);else g.step(.01,0);}}

test('physical groups replace archived phantom links, remain immutable, enforce rings and one paired dual group',()=>{
 const b=equipped();b.links[0]=['power','wide','echo','quick','reach'];const baseline=compileSkill(b,0);assert.deepEqual(baseline.supportIds,[]);group(b,'weapon',['rift','power','wide','echo','quick','reach']);validateBuild(b);const c=compileBuild(b);assert.equal(c.equipment.length,6);assert.equal(c.skills[0].supportIds.length,5);assert.ok(c.skills[0].effect!==baseline.effect);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.skills[0])&&Object.isFrozen(c.equipment[0].sockets));
 const captured=c.skills[0].effect;group(b,'weapon',['rift']);close(c.skills[0].effect,captured);assert.notEqual(compileBuild(b).skills[0].effect,captured);
 const broken=structuredClone(b);equippedItems(broken.equipment!).ring1.gems=['rift','power'];assert.throws(()=>validateBuild(broken));
 const dual=equippedItems(b.equipment!).weapon;dual.weaponType='dual';dual.gems=['rift','power','wide'];validateBuild(b);assert.equal(compileBuild(b).equipment.filter(i=>i.slot==='weapon').length,1);dual.gems.push('quick');assert.throws(()=>validateBuild(b));
});

test('built-in support creates a compatible seventh link and duplicate supports never stack',()=>{
 const b=equipped(),item=group(b,'weapon',['rift','power','wide','echo','quick','reach']);const six=compileSkill(b,0);item.builtInSupports=['brutality'];const seven=compileSkill(b,0);assert.equal(seven.supportIds.length,6);close(seven.effect/six.effect,1.45);group(b,'weapon',['rift','brutality']);const once=compileSkill(b,0);delete item.builtInSupports;close(compileSkill(b,0).effect,once.effect);item.builtInSupports=['brutality','bleed'];group(b,'weapon',['fireball']);assert.deepEqual(compileSkill(b,0).builtInSupports,[]);assert.equal(compileSkill(b,0).dot,0);
});

test('both engines use the identical frozen equipment contract, disabled sockets cannot cast or spend',()=>{
 const b=clearSlots(equipped());group(b,'weapon',['fireball','chain','spellpower']);const r=rogue(b),h=hunt(b);assert.deepEqual(r.compiledBuild,h.compiledBuild);assert.deepEqual(r.view().compiled.equipment,h.combatSnapshot.compiled.equipment);const rm=r.mana,hm=h.mana;assert.equal(r.command({...idle,skill:1}),false);assert.equal(h.requestSkill(1),false);close(r.mana,rm);close(h.mana,hm);assert.equal(r.command({...idle,skill:0}),true);assert.equal(h.attack(0),true);assert.ok(r.mana<rm&&h.mana<hm);tick(r,.5);tick(h,1);assert.ok(r.mobs[0].hp<1000000&&h.enemyHP<1000000);
});

test('guard and healing use assigned skill identity in either engine, with real resource settlement and frozen cooldown totals',()=>{
 const b=clearSlots(equipped());group(b,'weapon',['steelskin']);group(b,'armor',['heal']);for(const g of [rogue(b),hunt(b)]){if(g instanceof RogueEngine)g.command({...idle,skill:0});else g.attack(0);tick(g,1);const guard=g instanceof RogueEngine?g.view().defense.guard:g.heroShield;assert.ok(guard>0);const hp=g instanceof RogueEngine?g.hero.hp:g.hp;g.receiveDamage(guard*.25);close(g instanceof RogueEngine?g.hero.hp:g.hp,hp);if(g instanceof RogueEngine){g.hero.hp*=.5;g.command({...idle,skill:1});}else {g.hp*=.5;g.attack(1);}tick(g,2);assert.ok((g instanceof RogueEngine?g.hero.hp/g.hero.maxHP:g.hp/g.maxHP)>.5);const totals=[...g.cooldownTotals],elapsed=g.elapsed;if(g instanceof RogueEngine)g.step(.01,{...idle,paused:true});else {g.paused=true;g.step(.01,0);}close(g.elapsed,elapsed);assert.deepEqual(g.cooldownTotals,totals);}
});

function auraBuild(watcher:boolean){let b=clearSlots(equipped());group(b,'weapon',['hatred']);b=allocate(b,'jewel_9');for(let seed=1;seed<100;seed++){let candidate=equipJewel(b,'jewel_9',{instanceId:'ranger',jewelId:'rangercluster',seed},79);candidate=allocate(allocate(candidate,'cluster_ranger_2'),'cluster_ranger_6');if(getBuildTree(candidate).grantedSkills.includes('vitality')){b=candidate;break;}}assert.ok(getBuildTree(b).grantedSkills.includes('vitality'));b=allocate(b,'jewel_21');return watcher?equipJewel(b,'jewel_21',{instanceId:'watcher',jewelId:'watcherseye',seed:1},79):b;}
test('direct Hatred and granted Vitality coexist: both Watcher effects, regeneration and actor assists are real in both engines',()=>{
 const b=auraBuild(true);for(const g of [rogue(b),hunt(b)]){assert.equal(g.effects.hasAura('hatred',g.elapsed),false);assert.equal(g.effects.hasAura('vitality',g.elapsed),false);if(g instanceof RogueEngine)g.command({...idle,skill:0});else g.attack(0);const assists=[] as ReturnType<typeof g.effects.snapshot>['assists'];for(let i=0;i<300;i++){tick(g,.01);assists.push(...g.effects.snapshot(g.elapsed).assists);}const state=g.effects.snapshot(g.elapsed);assert.deepEqual(new Set(state.auras.map(a=>a.skillId)),new Set(['hatred','vitality']));assert.ok(assists.some(e=>e.sourceActor==='gold-dress'&&e.serial>=1&&e.skillId==='vitality'));close(g.effects.conditionalMultiplier(g.compiledBuild.skills[0],g.compiledBuild,g.elapsed),1.2);close(g.effects.regeneration(g.compiledBuild,g.elapsed),g.compiledBuild.passive.regeneration+.01);if(g instanceof RogueEngine)g.hero.hp=g.hero.maxHP*.5;else g.hp=g.maxHP*.5;const before=g instanceof RogueEngine?g.hero.hp:g.hp;tick(g,.5);const after=g instanceof RogueEngine?g.hero.hp:g.hp;assert.ok(after>before);close(after-before,(g instanceof RogueEngine?g.hero.maxHP:g.maxHP)*.5*(g.compiledBuild.passive.regeneration+.01),1e-6);assert.ok(g.mana<=g.maxMana&&g.mana>=0);}
 const noAura=rogue(equipped());assert.equal(noAura.effects.conditionalMultiplier(noAura.compiledBuild.skills[0],compileBuild(b),0),1);assert.equal(noAura.effects.regeneration(compileBuild(b),0),compileBuild(b).passive.regeneration);
});

test('timed and hurt triggers execute in campaign and Rogue without direct casting, transitive proc or pause advancement',()=>{
 const b=clearSlots(equipped());group(b,'weapon',['fireball','triggerclock']);group(b,'armor',['icenova','triggerhurt']);for(const g of [rogue(b),hunt(b)]){assert.equal(g instanceof RogueEngine?g.command({...idle,skill:0}):g.requestSkill(0),false);tick(g,1.5);assert.ok(g.cooldowns[0]>0);assert.equal(g.cooldowns[1],0);const c=g.compiledBuild.skills[0];g.effects.record('crit',g.elapsed,c);assert.equal(g.effects.triggerReady({...g.compiledBuild.skills[1],trigger:'crit'},g.elapsed),false);g.receiveDamage(g instanceof RogueEngine?100:1);tick(g,1.5);assert.ok(g.cooldowns[1]>0);const e=g.elapsed,m=g.mana;if(g instanceof RogueEngine)g.step(.02,{...idle,paused:true});else {g.paused=true;g.step(.02,0);}close(g.elapsed,e);close(g.mana,m);}
});

test('Forbidden canonical seeds select exactly one of eight other identities without modifying historic seeds',()=>{
 assert.equal(CHARACTER_IDENTITIES.length,9);assert.equal(new Set(CHARACTER_IDENTITIES.map(i=>i.id)).size,9);assert.equal(forbiddenSeed(9999),7);for(const own of CHARACTER_IDENTITIES){const ids=new Set(Array.from({length:8},(_,i)=>forbiddenIdentity(own.characterId,i+1).characterId));assert.equal(ids.size,8);assert.equal(ids.has(own.characterId),false);}
 const b=pair(equipped(),2,10),raw=JSON.stringify(b.jewels),c=compileBuild(b);assert.equal(c.borrowedIdentity?.characterId,'white-bob');assert.equal(JSON.stringify(b.jewels),raw);const mismatch=pair(equipped(),2,3);assert.equal(compileBuild(mismatch).borrowedIdentity,undefined);assert.equal(buildBudget(1),12);assert.equal(buildBudget(79),90);assert.equal(buildBudget(10000),90);
});

test('unique cluster and devotion options change only their explicitly allocated live totals',()=>{
 let b=allocate(equipped(),'jewel_9');b=equipJewel(b,'jewel_9',{instanceId:'unique_cluster',jewelId:'axemancluster',seed:1},79);const item=group(b,'armor',['dark']);item.uniqueEffect='cluster-notables';const initial=compileBuild(b).passive.damage;b=allocate(b,'cluster_unique_cluster_2');const enhanced=compileBuild(b).passive.damage;const plain=structuredClone(b);delete equippedItems(plain.equipment!).armor.uniqueEffect;close(enhanced-compileBuild(plain).passive.damage,.15);close(initial,compileBuild({...b,nodes:b.nodes.filter(n=>!n.startsWith('cluster_'))}).passive.damage);
 let faith=allocate(equipped(),'jewel_1');faith=equipJewel(faith,'jewel_1',{instanceId:'faith',jewelId:'militantfaith',seed:3,conqueror:'Avarus'},79);const devotionNode=getBuildTree(faith).nodes.find(n=>n.transformedBy==='faith'&&(n.devotion??0)>0)!;assert.ok(devotionNode);faith=allocate(faith,devotionNode.id);group(faith,'armor',['dark']).uniqueEffect='devotion-speed';const withEffect=compileBuild(faith).passive;const normal=structuredClone(faith);delete equippedItems(normal.equipment!).armor.uniqueEffect;assert.ok(withEffect.devotion>0);close(withEffect.attackSpeed-compileBuild(normal).passive.attackSpeed,withEffect.devotion*.001);
});

test('Watcher Hatred modifier multiplies actual cold hit damage by 1.2 in both engines',()=>{
 for(const make of [rogue,hunt] as const){const a=make(auraBuild(false)),b=make(auraBuild(true));for(const g of [a,b]){if(g instanceof RogueEngine)g.command({...idle,skill:0});else g.attack(0);tick(g,5);g.cooldowns[0]=0;if(g instanceof RogueEngine)g.mobs[0].hp=1000000;else g.enemyHP=1000000;if(g instanceof RogueEngine)g.command({...idle,skill:0});else g.attack(0);tick(g,1.1);}const ahp=a instanceof RogueEngine?a.mobs[0].hp:a.enemyHP,bhp=b instanceof RogueEngine?b.mobs[0].hp:b.enemyHP;assert.ok(ahp<1000000);close((1000000-bhp)/(1000000-ahp),1.2,1e-8);}
});

test('removing an active only releases its physical assignment and keeps archived links intact',()=>{
 const b=equipped();group(b,'weapon',['rift','power']);b.links[0][0]='wide';const removed=changeBuild(b,'active-0-empty');assert.ok(equippedItems(removed.equipment!).weapon.gems.every(id=>id===null));assert.equal(compileSkill(removed,0).enabled,false);assert.equal(removed.links[0][0],'wide');assert.equal(equippedItems(b.equipment!).weapon.gems[0],'rift');assert.throws(()=>changeBuild(newBuild(),'active-0-empty'));
});

test('empty skill bars expose no default identity or icon and retain the original six shortcut positions',()=>{
 const b=equipped();assert.deepEqual(getActiveSkills(b).map(s=>({id:s.id,icon:s.icon,enabled:s.enabled,slot:s.slotIndex})),Array.from({length:6},(_,slot)=>({id:'',icon:'',enabled:false,slot})));
 group(b,'weapon',['rift']);group(b,'ring2',['heal']);const installed=buildView(b);assert.equal(installed.actives[0].id,'rift');assert.equal(installed.actives[5].id,'heal');
 const removed=changeBuild(b,'active-0-empty'),view=buildView(removed);assert.equal(view.actives.length,6);assert.equal(view.actives[0].icon,'');assert.equal(view.actives[0].id,'');assert.equal(view.skills[0].activeId,'');assert.equal(view.skills[0].enabled,false);assert.equal(view.skills[0].effect,0);assert.equal(view.skills[0].mana,0);assert.equal(view.skills[0].canTriggerEvents,false);assert.equal(view.actives[5].id,'heal');assert.equal(view.skills[5].slotIndex,5);assert.equal(view.skills[5].enabled,true);
 for(const g of [rogue(removed),hunt(removed)]){const mana=g.mana;assert.equal(g instanceof RogueEngine?g.command({...idle,skill:0}):g.requestSkill(0),false);assert.equal(g.mana,mana);assert.equal(g.cooldowns[0],0);assert.equal(g instanceof RogueEngine?g.command({...idle,skill:5}):g.requestSkill(5),true);assert.ok(g.mana<mana);}
});

test('equipped boots and rings contribute actual Rogue attack timing and critical chance through shared growth stats',()=>{
 const base=newHuntProgress(),upgraded=newHuntProgress();base.equipment=createStarterEquipment();upgraded.equipment=createStarterEquipment();const items=equippedItems(upgraded.equipment);items.boots.rarity='ancient';items.boots.gems=['holy',null,null,null];items.ring1.rarity='ancient';const a=rogue(equipped()),b=rogue(equipped());a.setGrowth(base);b.setGrowth(upgraded);assert.ok(b.skillPreview()[0].crit>a.skillPreview()[0].crit);a.command({...idle,attack:true});b.command({...idle,attack:true});assert.ok(b.hero.motion!.duration<a.hero.motion!.duration);assert.ok(b.hero.motion!.hitAt<a.hero.motion!.hitAt);
});
