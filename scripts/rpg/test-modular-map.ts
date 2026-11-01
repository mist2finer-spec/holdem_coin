import test from 'node:test';import assert from 'node:assert/strict';
import {generateRogueMap,ROGUE_TILE,routeFrom} from '../../src/components/rpg/rogue/map';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
import {SPAWN_SAFETY,spawnLanes} from '../../src/components/rpg/rogue/encounters';
const idle={x:0,y:0,auto:false};
test('100 seeds: long connected arenas vary width, elevation, scenery and props, with reproducible layout',()=>{
 const layouts=new Set<string>(),heights=new Set<string>();for(let seed=1;seed<=100;seed++){const map=generateRogueMap(seed);assert.deepEqual(generateRogueMap(seed),map);layouts.add(JSON.stringify(map.rooms.map(r=>[r.x1,r.x2,r.scenery,r.decor])));heights.add(map.rooms.map(r=>r.elevation).join(','));assert.equal(new Set(map.rooms.map(r=>r.scenery)).size,4);
  for(const room of map.rooms){assert.ok(room.x2-room.x1+1>=44);assert.ok(room.x2-room.x1+1<=54);assert.ok(room.decor.length>=10);for(const d of room.decor)assert.ok(d.x>room.x1*ROGUE_TILE&&d.x<(room.x2+1)*ROGUE_TILE);}
  for(const gate of map.gates){assert.equal(gate.from.elevation,map.rooms[gate.fromRoom].elevation);assert.equal(gate.to.elevation,map.rooms[gate.nextRoom].elevation);if(gate.kind==='slide')assert.equal(gate.from.elevation,gate.to.elevation);}
 }assert.equal(layouts.size,100);assert.ok(heights.size>90);
});
test('entry pack leaves room for actual retreat, dodge and slide without bypassing collision rules',()=>{
 for(let seed=1;seed<=30;seed++){const g=new RogueEngine(seed),start=g.hero.x;assert.equal(g.mobs.length,30);assert.ok(g.mobs.every(m=>m.x>=start+SPAWN_SAFETY.nearHero));
  g.command({...idle,x:-1,dodge:true});for(let i=0;i<24;i++)g.step(.02,idle);assert.ok(g.hero.x<=start-119);assert.equal(g.hero.y,g.map.start.y);assert.equal(g.room,0);assert.ok(g.hero.hp>0);
  for(let i=0;i<60;i++)g.step(.02,idle);const x=g.hero.x;g.command({...idle,x:1,slide:true});for(let i=0;i<24;i++)g.step(.02,idle);assert.ok(g.hero.x>x+119);}
});
test('reinforcement birth respects the safety radius even at arena ends and while moving',()=>{
 for(const seed of [2,8,19]){const g=new RogueEngine(seed),r=g.map.rooms[0];g.hero.hp=g.hero.maxHP=1e8;const ids=new Set(g.mobs.map(m=>m.id));for(let n=0;n<2900;n++){if(n%100===0)g.hero.x=n%200===0?r.x1*48+12:(r.x2+1)*48-12;const hx=g.hero.x;g.step(.02,idle);for(const m of g.mobs)if(!ids.has(m.id)){ids.add(m.id);assert.ok(Math.abs(m.x-hx)>=SPAWN_SAFETY.nearHero-2);assert.ok(m.x>=r.x1*48+SPAWN_SAFETY.entryRetreat);}}assert.equal(g.view().wave.spawned,g.view().wave.target);}
 for(const x of [144,1000,2400]){const lanes=spawnLanes(456,2472,x);assert.ok(lanes.length);for(const lane of lanes)assert.ok(lane.left>=x+240||lane.right<=x-240);}
});
test('selected lower passage label follows the actual traversal, not AUTO preference',()=>{
 const g=new RogueEngine(4,{initial:3,min:3,max:3,batch:3,seconds:0});g.mobs.forEach(m=>m.hp=0);g.step(.02,idle);const gate=routeFrom(g.map,0,'lower')!;Object.assign(g.hero,gate.from);assert.ok(g.command({...idle,branch:'lower',jump:true}));assert.equal(g.view().gate?.id,gate.id);assert.equal(g.view().gate?.passage,'jump-down');
});
