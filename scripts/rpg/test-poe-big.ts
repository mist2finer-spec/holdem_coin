import test from 'node:test';import assert from 'node:assert/strict';
import {big,damageBig,settleBig,amountLabel,areaRadius,attachVitals,hurtBig} from '../../src/components/rpg/combat-big';
import {newBuild,migrateBuild,changeBuild,compileSkill,CORE_NODES,CORE_EDGES,connected,validateBuild,basicBuild} from '../../src/components/rpg/hunt-build';
import {RpgStore} from '../../src/lib/rpg-store';import {newHuntProgress} from '../../src/components/rpg/hunt-progression';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
const idle={x:0,y:0,auto:false};const advance=(g:RogueEngine,n:number)=>{for(let i=0;i<n;i++)g.step(.01,idle);};
test('extended-range damage and capped HP subtraction never convert authority through Number',()=>{
 for(const e of [30,100,1000,10000]){const d=damageBig(`1e${e}`,.5,[1.3,.9]);assert.ok(Math.abs(d.m-1.755)<1e-12);assert.equal(d.e,e);const s=settleBig(`2e${e}`,`2e${e}`,d);assert.ok(Math.abs(s.remaining.m-2.45)<1e-10);assert.equal(s.remaining.e,e-1);assert.equal(s.killed,false);assert.equal(settleBig(`1e${e}`,`1e${e}`,`2e${e}`).remaining.toString(),'0');assert.equal(typeof amountLabel(d),'string');}
 for(const bad of ['NaN','Infinity','1e99999999999999999',Infinity,NaN,'--1'])assert.throws(()=>big(bad));assert.throws(()=>damageBig(-1));assert.throws(()=>damageBig(1,0,[Infinity]));assert.throws(()=>settleBig(3,2,1));
 const actor=attachVitals({hp:1,maxHP:1},'1e1000','2e1000');assert.equal(actor.hp,5000);hurtBig(actor,'5e999');assert.equal(actor.hp,2500);assert.equal(actor.bigHP,'5e+999');assert.ok(!JSON.stringify(actor).includes('null'));
});
test('existing v1 saves migrate losslessly to one active plus five supports, persist with same balances',()=>{
 const v1={version:1,nodes:['root','0_1'],links:Array.from({length:6},(_,i)=>i===0?['power',null,null]:[null,null,null])},before=JSON.stringify(v1),b=migrateBuild(v1);assert.equal(JSON.stringify(v1),before);assert.equal(b.version,2);assert.equal(b.weapon,'axe');assert.deepEqual(b.nodes,v1.nodes);assert.deepEqual(b.links[0],['power',null,null,null,null]);
 const store=new RpgStore(':memory:');try{const p={...newHuntProgress(),gold:12345,build:v1};store.db.prepare('INSERT INTO rpg_players VALUES(?,?,0,0)').run('v1',JSON.stringify(p));const row=store.load('v1');assert.equal(row.progress.gold,12345);assert.deepEqual(row.progress.build,b);store.save('v1',row.progress,0);assert.deepEqual(store.load('v1').progress.build,b);}finally{store.close();}
 assert.throws(()=>migrateBuild({...v1,links:[[null]]}));assert.throws(()=>migrateBuild({...v1,nodes:['root','bad']}));
});
test('five distinct compatible supports fill a six-link; invalid slot, duplicates and incompatible tags rejected',()=>{
 let b=newBuild();for(const [slot,id] of ['power','wide','echo','quick','reach'].entries())b=changeBuild(b,`gem-0-${slot}-${id}`);assert.equal(b.links[0].filter(Boolean).length,5);const c=compileSkill(b,0);assert.ok(Math.abs(c.effect-1.3*.9*.65*.9*1.08)<1e-12);assert.ok(Math.abs(c.area-1.4*1.25)<1e-12);assert.ok(Math.abs(c.range-Math.sqrt(1.75))<1e-12);assert.equal(c.repeats,1);assert.throws(()=>changeBuild(b,'gem-0-5-power'));assert.throws(()=>changeBuild(b,'gem-0-4-wide'));assert.throws(()=>changeBuild(b,'gem-5-4-power'));
});
test('axe AoE node changes real boundary hits and visual radius, without hitting beyond the boundary',()=>{
 const b=changeBuild(newBuild(),'core-allocate-2_1'),range=compileSkill(b,0).range;assert.equal(compileSkill(newBuild(),0).range,1);assert.ok(Math.abs(range-Math.sqrt(1.12))<1e-12);
 for(const [build,distance,hit] of [[newBuild(),200,false],[b,200,true],[b,210,false]] as const){const g=new RogueEngine(3);g.build=build;g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+distance;m.hp=m.maxHP=10000;m.until=999;g.command({...idle,skill:0});advance(g,27);assert.equal(m.hp<10000,hit);assert.equal(g.view().fx.find(f=>f.kind==='rift')?.scale,compileSkill(build,0).range);}
 const basic=basicBuild(b);assert.ok(basic.range>1);assert.equal(compileSkill(b,0,'sword').range,1);
});
test('cyclic tree refund enforces connectivity and notable/keystone tradeoffs are compiled',()=>{
 assert.equal(CORE_NODES.length,222);for(const [a,b] of CORE_EDGES)assert.ok(CORE_NODES.some(n=>n.id===a)&&CORE_NODES.some(n=>n.id===b));
 let b=newBuild();for(let n=1;n<=9;n++)b=changeBuild(b,`core-allocate-2_${n}`);assert.ok(compileSkill(b,0).range>1.6);assert.equal(compileSkill(b,0).effect,.85);assert.throws(()=>changeBuild(b,'core-refund-2_1'));
 b=changeBuild(changeBuild(b,'core-allocate-2_10'),'core-allocate-2_11');const refunded=changeBuild(b,'core-refund-2_3');assert.ok(connected(refunded.nodes));validateBuild(refunded);assert.ok(compileSkill(refunded,0).range<compileSkill(b,0).range);
});
test('actual Rogue engine at 1e1000 scale applies damage, death, healing and serializable HUD ratios',()=>{
 const g=new RogueEngine(4,undefined,'1e1000');g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+45;m.until=999;g.command({...idle,attack:true});advance(g,27);assert.ok(big(m.bigHP!).eq('5e1001'));assert.equal(m.hp,5000);assert.equal(m.maxHP,10000);assert.equal(g.kills,0);advance(g,40);g.command({...idle,attack:true});advance(g,40);assert.equal(m.hp,0);assert.equal(g.kills,1);assert.equal(g.gold,10);
 g.hero.hp='1e1003' as unknown as number;g.command({...idle,skill:5});advance(g,80);assert.ok(big(g.hero.bigHP!).gt('1e1003'));const text=JSON.stringify(g.view());assert.ok(!text.includes('Infinity'));assert.ok(text.includes('e+100'));assert.equal(JSON.parse(text).hero.maxHP,10000);
});
test('build-editor pause freezes damage, cooldowns and waves, then resumes without catch-up',async()=>{
 const {RogueService}=await import('../../src/lib/rpg-rogue-service');let now=0;const service=new RogueService(()=>now,()=>8),start=service.start('pause','hong');const a=service.command('pause',start.id,1,{...idle,paused:true});now=60000;const b=service.command('pause',start.id,2,{...idle,paused:true},'core-allocate-2_1');assert.equal(b.elapsed,a.elapsed);assert.equal(b.hero.hp,a.hero.hp);assert.equal(b.wave.spawned,30);assert.equal(b.paused,true);assert.ok(b.build.skills[0].range>1);now+=100;const c=service.command('pause',start.id,3,idle);assert.equal(c.elapsed,b.elapsed);now+=100;const d=service.command('pause',start.id,4,idle);assert.ok(d.elapsed>c.elapsed);assert.ok(d.elapsed<.11);
});
test('tiny extended-exponent health remains alive and normal attack captures the allocated range',()=>{
 const tiny=new RogueEngine(1,undefined,'1e-1000');assert.equal(tiny.hero.maxHP,10000);assert.ok(tiny.hero.hp>0);assert.ok(tiny.mobs.every(m=>m.hp>0));
 let b=changeBuild(newBuild(),'core-allocate-2_1');const g=new RogueEngine(2);g.build=b;g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+116;m.hp=m.maxHP=10000;m.until=999;g.command({...idle,attack:true});g.build=newBuild();advance(g,27);assert.ok(m.hp<10000);assert.ok(g.view().fx.find(f=>f.kind==='slash')!.scale!>1);
});
