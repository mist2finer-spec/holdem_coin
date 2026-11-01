import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_SKILLS,ACTIVE_CATALOG,GEMS,CORE_NODES,CORE_EDGES,CHARACTER_STARTS,TREE_BOUNDS,newBuild,migrateBuild,validateBuild,changeBuild,connected,buildBudget,buildView,buildStart,activeSkill,getActiveSkills,supports,compileSkill,passiveBuild,basicBuild,canTriggerFrom,isBuildAction,type BuildState} from '../../src/components/rpg/hunt-build';
import {COMBAT_CHARACTERS} from '../../src/components/rpg/combat-characters';
const graph=new Map(CORE_NODES.map(n=>[n.id,[] as string[]]));
for(const [a,b] of CORE_EDGES){graph.get(a)!.push(b);graph.get(b)!.push(a);}
function paths(root:string){const result=new Map<string,string[]>([[root,[root]]]),queue=[root];for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i])!)if(!result.has(n)){result.set(n,[...result.get(queue[i])!,n]);queue.push(n);}return result;}
function allocate(build:BuildState,id:string,level=40){const path=paths(buildStart(build).nodeId).get(id)!;for(const n of path.slice(1))if(!build.nodes.includes(n))build=changeBuild(build,`core-allocate-${n}`,level);return build;}
function close(a:number,b:number){assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);}

test('catalog has 780 connected nodes, nine real character starts, 35 actives and 30 supports',()=>{
 assert.equal(CORE_NODES.length,780);assert.equal(ACTIVE_CATALOG.length,35);assert.equal(GEMS.length,30);assert.equal(ACTIVE_SKILLS.length,6);
 assert.equal(new Set(CORE_NODES.map(n=>n.id)).size,780);assert.equal(new Set(ACTIVE_CATALOG.map(s=>s.id)).size,35);assert.equal(new Set(GEMS.map(g=>g.id)).size,30);
 assert.deepEqual(CHARACTER_STARTS.map(s=>s.id).sort(),COMBAT_CHARACTERS.map(c=>c.id).sort());
 for(const n of CORE_NODES){assert.ok(n.description);assert.ok(n.x>0&&n.x<TREE_BOUNDS.width&&n.y>0&&n.y<TREE_BOUNDS.height);}
 for(const g of GEMS)assert.match(g.id,/^[a-z][a-z0-9]*$/);
 for(const s of ACTIVE_CATALOG){assert.ok(s.description);assert.ok(s.baseIndex>=0&&s.baseIndex<6);assert.ok(!s.tags.some(t=>/MINION|TOTEM|SUMMON/.test(t)));}
 for(const start of CHARACTER_STARTS){const reachable=paths(start.nodeId);assert.equal(reachable.size,780);for(const path of reachable.values()){const b={...newBuild(start.id),nodes:path};assert.equal(connected(path,start.id),true);validateBuild(b,40);}}
});

test('starting regions enforce owned-root connectivity, paid travel and reset/refund rules',()=>{
 for(const start of CHARACTER_STARTS){const b=newBuild(start.id);validateBuild(b);assert.equal(buildView(b).remaining,12);assert.deepEqual(b.nodes,[start.nodeId]);assert.throws(()=>changeBuild(b,`core-refund-${start.nodeId}`));if(start.id!=='hong'){assert.throws(()=>changeBuild(b,'core-allocate-root'));assert.equal(connected(b.nodes),false);}}
 const arcane=newBuild('pink-glasses');assert.throws(()=>changeBuild(arcane,'core-allocate-chaosinoculation'));
 let b=allocate(arcane,'arcane_0_3');for(const id of ['arcane_1_3','arcane_1_2','arcane_1_1'])b=changeBuild(b,`core-allocate-${id}`);
 const loop=changeBuild(b,'core-refund-arcane_0_1');assert.equal(connected(loop.nodes,'pink-glasses'),true);
 assert.throws(()=>changeBuild(changeBuild(arcane,'core-allocate-arcane_0_1'),'core-allocate-arcane_0_3'));
 assert.deepEqual(changeBuild(b,'core-reset').nodes,['start_arcane']);assert.deepEqual(changeBuild(b,'core-start-hong').nodes,['root']);assert.equal(changeBuild(b,'core-start-hong').start,undefined);
 assert.equal(buildBudget(1),12);assert.equal(buildBudget(40),51);assert.equal(buildBudget(100),90);
});

test('v1 migration and raw v2 preserve IDs, defaults, balances, shapes and caller data',()=>{
 const old={version:1,nodes:['root','0_1','0_2'],links:Array.from({length:6},(_,i)=>i===0?['power','echo','quick']:[null,null,null])};
 const before=structuredClone(old),b=migrateBuild(old);assert.deepEqual(old,before);assert.equal(b.version,2);assert.equal(b.start,undefined);assert.equal(b.activeIds,undefined);assert.deepEqual(b.nodes,old.nodes);close(compileSkill(b,0).effect,1.12*1.3*.65*.9);
 const raw=newBuild();assert.deepEqual(Object.keys(raw),['version','weapon','nodes','links']);assert.deepEqual(migrateBuild(raw),raw);assert.notEqual(migrateBuild(raw),raw);
 assert.deepEqual(getActiveSkills(raw).map(s=>s.id),['rift','dark','frost','holy','whirl','heal']);assert.equal(buildView(raw).skills.length,6);
 const snapshot=buildView(raw);snapshot.state.nodes.push('invalid');snapshot.actives[0].name='changed';assert.equal(activeSkill(raw,0).name,'대지 균열');validateBuild(raw);
});

test('all 1050 active/support pairs follow tags, exclusions and five-socket validation',()=>{
 for(const active of ACTIVE_CATALOG){const b=changeBuild(newBuild(),`active-0-${active.id}`);for(const gem of GEMS){const copy=structuredClone(b);if(supports(0,gem.id,b)){const linked=changeBuild(b,`gem-0-0-${gem.id}`);validateBuild(linked);const c=compileSkill(linked,0);assert.ok(Number.isFinite(c.effect)&&c.effect>0);assert.ok(Number.isFinite(c.range)&&c.range>0);assert.throws(()=>changeBuild(linked,`gem-0-1-${gem.id}`));}else assert.throws(()=>changeBuild(b,`gem-0-0-${gem.id}`));assert.deepEqual(b,copy);}}
 const molten=changeBuild(newBuild(),'active-0-moltenstrike');assert.equal(supports(0,'brutality',molten),false);assert.equal(supports(0,'bleed',molten),false);assert.equal(supports(0,'volley',molten),true);
 assert.equal(supports(0,'volley'),false);assert.equal(supports(5,'renew'),true);assert.equal(supports(5,'leech'),false);
});

test('loadout swaps preserve compatible links and remove incompatible links atomically',()=>{
 let b=changeBuild(newBuild(),'gem-5-0-renew');b=changeBuild(b,'gem-5-1-echo');const before=structuredClone(b),next=changeBuild(b,'active-5-fireball');
 assert.deepEqual(b,before);assert.deepEqual(next.links[5],[null,'echo',null,null,null]);assert.equal(activeSkill(next,5).id,'fireball');assert.equal(compileSkill(next,5).heal,false);assert.equal(compileSkill(next,5).baseIndex,3);assert.equal(compileSkill(next,5).element,'fire');
 assert.equal(compileSkill(changeBuild(newBuild(),'active-0-heal'),0).heal,true);assert.equal(compileSkill(changeBuild(newBuild(),'active-5-steelskin'),5).heal,false);
});

test('expanded supports compile projectiles, chain, pierce, DoT, crit, leech and mana numerically',()=>{
 let b=changeBuild(newBuild(),'active-0-fireball');for(const [i,id] of ['volley','chain','pierce','critical','efficient'].entries())b=changeBuild(b,`gem-0-${i}-${id}`);
 const c=compileSkill(b,0);close(c.effect,1.2*.75*.8*.95*.95);assert.equal(c.projectiles,3);assert.equal(c.chain,2);assert.equal(c.pierce,3);close(c.crit,.1);close(c.critMultiplier,1.75);close(c.mana,1.1*1.1*.65);
 let dot=changeBuild(newBuild(),'active-0-essence');for(const [i,id] of ['swift','duration','poison','leech'].entries())dot=changeBuild(dot,`gem-0-${i}-${id}`);
 const d=compileSkill(dot,0);close(d.dot,1.5*1.45);close(d.dotDuration,4*.75*1.5);close(d.leech,.03);close(d.effect,.7*.85*.85*.9);
 const multi=compileSkill(changeBuild(changeBuild(newBuild(),'active-0-doublestrike'),'gem-0-0-multistrike'),0);assert.equal(multi.repeats,3);close(multi.effect,.65*.55);
 const guard=compileSkill(changeBuild(newBuild(),'active-0-steelskin'),0);close(guard.guard,.3);const aura=compileSkill(changeBuild(newBuild(),'active-5-vitality'),5);close(aura.aura,.12);assert.equal(aura.heal,true);
});

test('passive specializations affect matching tags and preserve neutral legacy calculations',()=>{
 let b=changeBuild(newBuild('pink-glasses'),'core-allocate-arcane_0_1');close(compileSkill(b,0).effect,1);close(compileSkill(b,1).effect,1.05);close(compileSkill(b,5).effect,1);close(compileSkill(b,1,'sword').effect,1);
 b=allocate(newBuild('black-suit'),'perfectagony');assert.ok(basicBuild(b).crit>0);assert.ok(compileSkill(b,0).critMultiplier>1.5);
 b=allocate(newBuild('longhair-man'),'resolute');b=changeBuild(b,'gem-0-0-critical',40);assert.equal(compileSkill(b,0).crit,0);assert.ok(compileSkill(b,0).effect>1);
 const elemental=allocate(newBuild('teal-twins'),'elementaloverload');close(compileSkill(elemental,0).effect,1);assert.ok(compileSkill(elemental,2).effect>1.7);assert.equal(compileSkill(elemental,2).crit,0);
});

test('CI is a real tradeoff flag with independent shield scaling, travel cost and refundable conversion',()=>{
 const b=allocate(newBuild('pink-glasses'),'chaosinoculation'),p=passiveBuild(b);assert.equal(p.chaosImmune,true);assert.equal(p.maxLifeOne,true);close(p.energyShield,1.05);assert.equal(p.reduction,0);
 const view=buildView(b);assert.ok(view.statDescriptions.some(s=>s.includes('1이')));assert.ok(view.statDescriptions.some(s=>s.includes('혼돈')));
 const off=passiveBuild(changeBuild(b,'core-refund-chaosinoculation'));assert.equal(off.chaosImmune,false);assert.equal(off.maxLifeOne,false);close(off.energyShield,.25);
 const hong=allocate(newBuild(),'chaosinoculation');validateBuild(hong);assert.equal(buildView(hong).remaining,0);assert.ok(hong.nodes.includes('root'));assert.ok(hong.nodes.includes('start_arcane'));
 assert.equal(passiveBuild(b,'sword').chaosImmune,false);
});

test('trigger supports are exclusive, reject native-trigger/channel/aura loops and mark event sources',()=>{
 const timed=changeBuild(newBuild(),'gem-1-0-triggerclock'),c=compileSkill(timed,1);assert.equal(c.trigger,'timed');close(c.triggerInterval,1.6);assert.equal(c.canTriggerEvents,false);assert.ok(canTriggerFrom(c,'timed'));assert.equal(canTriggerFrom(c,'hit'),false);
 assert.throws(()=>changeBuild(timed,'gem-1-1-triggercrit'));assert.throws(()=>changeBuild(timed,'gem-1-1-triggerhurt'));
 for(const active of ['heraldstorm','blight','hatred'])for(const trigger of ['triggerclock','triggercrit','triggerhurt']){const b=changeBuild(newBuild(),`active-0-${active}`);assert.equal(supports(0,trigger,b),false);assert.throws(()=>changeBuild(b,`gem-0-0-${trigger}`));}
 for(const trigger of ['crit','hurt'] as const){const b=changeBuild(newBuild(),`gem-1-0-trigger${trigger}`),compiled=compileSkill(b,1);assert.ok(canTriggerFrom(compiled,trigger));assert.equal(canTriggerFrom(compiled,trigger,true),false);assert.equal(canTriggerFrom(compiled,'dot'),false);assert.equal(canTriggerFrom(compiled,'hit'),false);}
 const repeat=compileSkill(changeBuild(timed,'gem-1-1-echo'),1);assert.equal(repeat.repeats,1);assert.equal(repeat.canTriggerEvents,false);
 assert.equal(compileSkill(changeBuild(newBuild(),'active-0-heraldstorm'),0).trigger,'timed');
});

test('malformed optional fields, sparse arrays and forged action IDs cannot bypass validation',()=>{
 for(const start of ['unknown',null,42])assert.throws(()=>validateBuild({...newBuild(),start}));
 for(const activeIds of [[],Array(6),['rift','dark','frost','holy','whirl','unknown'],['rift','dark','frost','holy','whirl',null]])assert.throws(()=>validateBuild({...newBuild(),activeIds}));
 const nodes=newBuild();nodes.nodes.length=2;assert.throws(()=>validateBuild(nodes));const links=newBuild();links.links=Array(6);assert.throws(()=>validateBuild(links));const sockets=newBuild();sockets.links[0]=Array(5);assert.throws(()=>validateBuild(sockets));
 for(const action of ['active-6-fireball','active-0-__proto__','active-0-fireball-extra','gem-0-0-triggerclock-extra','core-start-unknown','core-allocate-0_18','core-allocate-__proto__'])assert.equal(isBuildAction(action),false);
 assert.ok(isBuildAction('active-5-fireball'));assert.ok(isBuildAction('core-start-pink-glasses'));assert.ok(isBuildAction('core-allocate-chaosinoculation'));
});

test('compilation is deterministic and makes no random draws',()=>{
 const b=allocate(changeBuild(newBuild(),'active-0-fireball'),'chaosinoculation'),before=JSON.stringify(b),random=Math.random;Math.random=()=>{throw Error('compiler must not draw randomness');};try{const expected=compileSkill(b,0);for(let i=0;i<100;i++)assert.deepEqual(compileSkill(b,0),expected);assert.equal(JSON.stringify(b),before);}finally{Math.random=random;}
});
