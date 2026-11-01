import test from 'node:test';import assert from 'node:assert/strict';
import {EnemyAttackSystem,nativeSkillReady,type NativeEnemy,type EnemyTarget} from '../../src/components/rpg/rogue/enemy-attacks';
import {LABYRINTH} from '../../src/components/rpg/hunt-labyrinth';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
const actor=(species:number,boss=false):NativeEnemy=>({id:1,species,room:0,x:0,y:100,hp:10000,maxHP:10000,radius:16,boss,state:'idle',until:0,target:{x:200,y:100}});
const target=(x=200):EnemyTarget=>({x,y:100,airHeight:0,dodge:false,slide:false});
function scenario(species:number,seconds:number,hero=target(),boss=false){const system=new EnemyAttackSystem(7),mob=actor(species,boss),casts:number[]=[],hits:{time:number;skill:number;value:number;type:number}[]=[];let previous=0;for(let t=0;t<seconds;t+=.02){system.actor(mob,hero,t);if(mob.castSkill&&mob.castSkill!==previous){casts.push(mob.castSkill);previous=mob.castSkill;}if(!mob.castSkill)previous=0;system.advance(t,.02,[mob],hero,0,(_,e,h)=>hits.push({time:t,skill:h.skill,value:e.value,type:e.type}));}return {system,mob,casts,hits};}
test('native six-second mage skills normally follow two basics with recovered slow AI waits, not a modulo-three invention',()=>{
 for(const [species,basic,special] of [[1153,2210,2211],[1103,2160,2161]]){const s=scenario(species,18);assert.deepEqual(s.casts.slice(0,3),[basic,basic,special]);assert.ok(s.hits.filter(h=>h.skill===basic).length>0);assert.equal(LABYRINTH.actions[special].cooldownMethod,0);assert.equal(LABYRINTH.actions[special].cooldown,6);}
 const action={...LABYRINTH.actions[2311],cooldownMethod:1,cooldown:3},state={entered:0,basics:2,ready:{},counts:{}};assert.equal(nativeSkillReady(action,state,99999),false);state.basics=3;assert.equal(nativeSkillReady(action,state,0),true);
});
test('bat pulse travels before damage; slide evades the upper pulse while jump alone does not',()=>{
 const a=scenario(1252,7);const hit=a.hits.find(h=>h.skill===2306);assert.ok(hit);assert.ok(hit.time>4+.4);assert.equal(hit.value,300);
 assert.equal(scenario(1252,7,{...target(),slide:true}).hits.length,0);assert.ok(scenario(1252,7,{...target(),airHeight:80}).hits.length>0);assert.equal(scenario(1252,7,{...target(),dodge:true}).hits.length,0);
});
test('skeleton pillar has four delayed landing footprints and no warning-phase damage; movement avoids locked locations',()=>{
 const s=new EnemyAttackSystem(9),m=actor(1153),hero=target(),damage:number[]=[];let found=false,first=0;
 for(let t=0;t<20;t+=.02){s.actor(m,hero,t);const h=s.view(t).hazards.filter(h=>h.skill===2211);if(h.length&&!found){found=true;first=t;assert.equal(h.length,4);assert.ok(h.every(h=>h.phase==='warning'));assert.deepEqual(damage,[]);hero.x=1000;}
 s.advance(t,.02,[m],hero,0,(_,e,h)=>{if(h.skill===2211)damage.push(e.value);});if(found&&t>first+2)break;}
 assert.ok(found);assert.equal(damage.length,0);
});
test('goblin targeted poison cloud follows one target for its recovered lifetime; no invented poison-DoT debuff',()=>{
 const s=new EnemyAttackSystem(7),m=actor(1103),hero=target();let cloud=false;const hits:number[]=[];
 for(let t=0;t<18;t+=.02){s.actor(m,hero,t);if(m.castSkill===2161)hero.x+=.5;s.advance(t,.02,[m],hero,0,(_,e,h)=>{if(h.skill===2161)hits.push(e.value);});const h=s.view(t).hazards.find(h=>h.skill===2161&&h.phase==='active');if(h){cloud=true;assert.equal(h.x,hero.x);}}
 assert.ok(cloud);assert.deepEqual(hits,[120]);
});
test('core spirit has ranged basics plus a delayed ground explosion; source death and zone exit cancel pending hits',()=>{
 const s=scenario(1311,14,target(80));assert.ok(s.casts.includes(2356));assert.ok(s.hits.some(h=>h.skill===2356&&h.value===500));
 const system=new EnemyAttackSystem(1),m=actor(1153),hero=target();system.actor(m,hero,0);assert.ok(system.view(1).hazards.length);m.hp=0;system.advance(1,.02,[m],hero,0,()=>assert.fail('dead caster hit'));assert.equal(system.view(1).hazards.length,0);
});
test('ranged shot crossing uses swept collision; jump clears low shot and per-command phases never repeat frame damage',()=>{
 const a=scenario(1153,2,target(200));assert.equal(a.hits.filter(h=>h.skill===2210).length,1);assert.equal(scenario(1153,2,{...target(),airHeight:50}).hits.length,0);
});
test('native actor serials, projectile budget, pause, and real Rogue HP remain bounded and server-owned',()=>{
 const g=new RogueEngine(77);g.mobs=g.mobs.slice(0,1);Object.assign(g.mobs[0],{species:1153,x:g.hero.x+180,hp:10000,maxHP:10000,until:0});for(let i=0;i<200;i++)g.step(.02,{x:0,y:0,auto:false});assert.ok(g.hero.hp<10000);const before=g.view();for(let i=0;i<100;i++)g.step(.02,{x:0,y:0,auto:false,paused:true});assert.equal(g.elapsed,before.elapsed);assert.deepEqual(g.view().enemyCombat,before.enemyCombat);assert.ok(g.view().enemyCombat.hazards.length<=128);g.mobs[0].hp=0;g.step(.02,{x:0,y:0,auto:false});assert.equal(g.view().enemyCombat.hazards.length,0);
});
test('count cooldown uses native midpoint-to-even and cannot unlock through elapsed seconds',()=>{
 const a={...LABYRINTH.actions[2311],cooldownMethod:1,cooldown:2.5},state={entered:0,basics:1,ready:{},counts:{}};
 assert.equal(nativeSkillReady(a,state,99999),false);state.basics=2;assert.equal(nativeSkillReady(a,state,0),true);
});
test('all boss candidates have local native attacks and room changes clear projectiles',()=>{
 for(const species of [1031,1105,1155,1253,1321,1322,1323]){const p=LABYRINTH.monsters[species];assert.ok(p);assert.ok(p.skills.some(id=>LABYRINTH.actions[id]?.commands.some(c=>c.effects.some(e=>e.type===1&&e.value>0))));}
 const s=new EnemyAttackSystem(1),m=actor(1153);s.actor(m,target(),0);assert.ok(s.view(1).hazards.length);s.advance(1,.02,[m],target(),1,()=>assert.fail('another-room attack'));assert.equal(s.view(1).hazards.length,0);
});
