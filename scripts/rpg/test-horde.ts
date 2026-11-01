import test from 'node:test';import assert from 'node:assert/strict';
import {RogueEngine,type RogueInput} from '../../src/components/rpg/rogue/engine';
import {HORDE,createWave,THEME_SPECIES} from '../../src/components/rpg/rogue/encounters';
import {UPPER_ROUTE,roomGates,routeFrom} from '../../src/components/rpg/rogue/map';
import {parseRogueInput,RogueService} from '../../src/lib/rpg-rogue-service';
import {dungeonEncounter,zoneRewardBudget} from '../../src/components/rpg/hybrid-balance';
const idle:RogueInput={x:0,y:0,auto:false};
const advance=(g:RogueEngine,n:number,input=idle)=>{for(let i=0;i<n;i++)g.step(.02,input);};
test('production starts twelve at difficulty one, scales actual packs to 200, and finishes spawning before 60s without a kill deadline',()=>{
 for(let seed=1;seed<=100;seed++){const wave=createWave(seed,0,0);assert.equal(wave.target,50);assert.deepEqual(createWave(seed,0,0),wave);}
 for(const [difficulty,target] of [[1,50],[100,50],[101,67],[500,117],[1000,200],[1000000,200]]){
  const g=new RogueEngine(111,undefined,1,difficulty);assert.equal(g.mobs.length,dungeonEncounter(difficulty).initial);assert.equal(g.view().wave.target,target);assert.ok(g.mobs.every(m=>Math.abs(m.x-g.hero.x)>=24));g.step(.02,idle);g.hero.bigHP=g.hero.bigMaxHP='1e10000';
  for(let tick=0;tick<2800;tick++){g.step(.02,idle);assert.ok(g.mobs.length<=200);}
  const v=g.view();assert.equal(v.wave.spawned,target);assert.equal(v.mobs.length,target);assert.equal(v.phase,'combat');assert.equal(v.kills,0);assert.equal(v.status,'playing');assert.equal(new Set(v.mobs.map(m=>m.id)).size,target);advance(g,1000);assert.equal(g.view().wave.spawned,target);assert.equal(g.status,'playing');assert.ok(g.mobs.every(m=>m.room===0&&m.species===1001));}
});
test('killing an early wave does not open exits; actual damage awards once and bounds corpses/FX',()=>{
 const g=new RogueEngine(9),initial=HORDE.initial,gold=Math.floor(zoneRewardBudget(1).gold*initial/HORDE.max);for(const m of g.mobs){m.x=g.hero.x+40;m.hp=m.maxHP=1;}g.command({...idle,skill:0});advance(g,40);assert.equal(g.kills,initial);assert.equal(g.gold,gold);assert.equal(g.view().phase,'combat');assert.equal(g.view().gate?.ready,false);advance(g,50);assert.equal(g.kills,initial);assert.equal(g.gold,gold);assert.equal(g.mobs.length,0);advance(g,200);assert.ok(g.mobs.length>0);assert.ok(g.mobs.length<=HORDE.batch*2);assert.ok(g.view().fx.length<=96);
});
test('all production AUTO routes survive and win with real skills, horde cadence and one final boss',()=>{
 for(const seed of [1,9,31,57]){const g=new RogueEngine(seed);let lastRoom=0,targets=0,bosses=0;const seen=new Set<number>();
  for(let tick=0;tick<60000&&g.status==='playing';tick++){g.step(.02,{...idle,auto:true});if(g.room!==lastRoom){targets+=g.view().wave.target;lastRoom=g.room;}for(const m of g.mobs)if(m.boss&&!seen.has(m.id)){seen.add(m.id);bosses++;}}
  assert.equal(g.status,'won',JSON.stringify({seed,room:g.room,kills:g.kills,hp:g.hero.hp,wave:g.view().wave,mobs:g.mobs.filter(m=>m.hp>0).map(m=>[m.x,m.state])}));assert.deepEqual(g.autoOrder,UPPER_ROUTE);assert.equal(bosses,1);assert.equal(g.kills,targets+createWave(seed,0,0).target);assert.ok(g.fx.length<=96);assert.ok(g.mobs.length<=200);}
});
test('theme variety, branch input validation and in-flight branch change protection',()=>{
 const g=new RogueEngine(33,{initial:3,min:3,max:3,batch:3,seconds:0});assert.ok(new Set(g.map.rooms.map(r=>r.theme)).size>=7);for(const r of g.map.rooms)assert.ok(THEME_SPECIES[r.theme]?.length);
 for(const branch of ['bad',null,3,{}])assert.throws(()=>parseRogueInput({...idle,branch}));assert.equal(parseRogueInput({...idle,branch:'lower'}).branch,'lower');g.mobs.forEach(m=>m.hp=0);advance(g,1);const upper=routeFrom(g.map,0)!;Object.assign(g.hero,upper.from);assert.equal(roomGates(g.map,0).length,2);g.command({...idle,jump:true,branch:'lower'});const selected=g.hero.motion?.gateId;assert.ok(selected!==upper.id);assert.equal(g.command({...idle,jump:true,branch:'upper'}),false);advance(g,150);assert.equal(g.room,2);assert.deepEqual(g.transitions,[selected]);
 let now=0;const service=new RogueService(()=>now,()=>3),v=service.start('horde','hong');now=100;const a=service.command('horde',v.id,1,{...idle,branch:'lower'});now=600;assert.deepEqual(service.command('horde',v.id,1,{...idle,branch:'upper'}),a);assert.equal(a.wave.spawned,HORDE.initial);
});
