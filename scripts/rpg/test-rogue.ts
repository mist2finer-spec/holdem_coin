import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RNG} from 'rot-js';
import {generateRogueMap,walkable,moveOnMap,lineClear,cell,ROGUE_TILE} from '../../src/components/rpg/rogue/map';
import {RogueEngine,ROGUE_SPECIES,type RogueInput} from '../../src/components/rpg/rogue/engine';
import {LABYRINTH} from '../../src/components/rpg/hunt-labyrinth';
import {RogueService,parseRogueInput} from '../../src/lib/rpg-rogue-service';
const idle:RogueInput={x:0,y:0,auto:false};
const step=(g:RogueEngine,n:number,input:RogueInput=idle)=>{for(let i=0;i<n;i++)g.step(.02,input);};
test('100 seeds yield exactly ten connected rooms, sealed borders and reachable exits',()=>{
 const hashes=new Set<string>();for(let seed=1;seed<=100;seed++){
  const m=generateRogueMap(seed),q=[cell(m.start.y)*m.width+cell(m.start.x)],seen=new Set(q);hashes.add(m.rooms.map(r=>r.x1+','+r.y1).join('|'));assert.equal(m.rooms.length,10);
  for(let i=0;i<q.length;i++)for(const n of [q[i]-1,q[i]+1,q[i]-m.width,q[i]+m.width])if(n>=0&&n<m.tiles.length&&!seen.has(n)&&m.tiles[n]===0){q.push(n);seen.add(n);}
  for(const r of m.rooms){assert.equal(seen.has(cell(r.center.y)*m.width+cell(r.center.x)),true);assert.ok(walkable(m,r.center.x,r.center.y));}
  assert.ok(seen.has(cell(m.exit.y)*m.width+cell(m.exit.x)));assert.ok(walkable(m,m.exit.x,m.exit.y));
  for(let x=0;x<m.width;x++){assert.equal(m.tiles[x],1);assert.equal(m.tiles[(m.height-1)*m.width+x],1);}for(let y=0;y<m.height;y++){assert.equal(m.tiles[y*m.width],1);assert.equal(m.tiles[y*m.width+m.width-1],1);}
 }assert.ok(hashes.size>90);
});
test('seeded maps reproduce layouts and preserve the caller RNG state',()=>{
 RNG.setSeed(501);const seed=RNG.getSeed(),state=RNG.getState();const a=generateRogueMap(345);assert.deepEqual(RNG.getState(),state);assert.equal(RNG.getSeed(),seed);assert.deepEqual(generateRogueMap(345),a);
 for(const value of [NaN,-1,Infinity,2**40])assert.throws(()=>generateRogueMap(value));
});
test('circle collision and swept motion cannot tunnel through walls or outside the map',()=>{
 const m=generateRogueMap(9);for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1}]){let p={...m.start};for(let i=0;i<100;i++){p=moveOnMap(m,p,dir.x*40,dir.y*40);assert.ok(walkable(m,p.x,p.y));}}
 assert.equal(walkable(m,-100,100),false);assert.equal(walkable(m,NaN,1),false);assert.deepEqual(moveOnMap(m,m.start,Infinity,0),m.start);
});
test('multiple original monster rigs exist; finite packs never respawn and room 1 starts safe',()=>{
 const g=new RogueEngine(33);assert.ok(g.mobs.length>=27&&g.mobs.length<=45);assert.ok(new Set(g.mobs.map(m=>m.species)).size>=7);assert.equal(g.mobs.some(m=>m.room===0),false);
 for(const species of [...ROGUE_SPECIES,1031]){const a=LABYRINTH.assets[LABYRINTH.monsters[species].asset];for(const ext of ['json','atlas'])assert.ok(fs.existsSync('public/rpg/'+a.skeleton+'.'+ext));}
 for(const m of g.mobs){assert.ok(walkable(g.map,m.x,m.y,m.radius));m.hp=0;m.state='dead';}step(g,500);assert.ok(g.mobs.every(m=>m.hp===0));assert.equal(g.status,'playing');
 for(const room of g.map.rooms){g.hero.x=room.center.x;g.hero.y=room.center.y;g.step(.02,idle);}g.hero.x=g.map.exit.x;g.hero.y=g.map.exit.y;g.step(.02,idle);assert.equal(g.cleared.size,10);assert.equal(g.status,'won');
});
test('2D movement includes vertical/diagonal travel without diagonal speed boost',()=>{
 const a=new RogueEngine(9),b=new RogueEngine(9);a.mobs.forEach(m=>m.hp=0);b.mobs.forEach(m=>m.hp=0);const start={...a.hero};step(a,10,{...idle,y:1});step(b,10,{...idle,x:1,y:1});assert.ok(a.hero.y>start.y);assert.ok(Math.abs(Math.hypot(a.hero.x-start.x,a.hero.y-start.y)-Math.hypot(b.hero.x-start.x,b.hero.y-start.y))<.01);
});
test('attacks award once, skills reserve across attacks, jump cannot pass walls or land inside a mob',()=>{
 const g=new RogueEngine(3);for(const m of g.mobs)m.hp=0;const m=g.mobs[0];m.x=g.hero.x+45;m.y=g.hero.y;m.hp=40;m.maxHP=40;m.state='idle';g.command({...idle,attack:true});g.command({...idle,skill:0});step(g,55);assert.equal(g.kills,1);assert.equal(g.gold,10);assert.ok(g.cooldowns[0]>0);step(g,100);assert.equal(g.gold,10);
 g.command({...idle,x:1,jump:true});assert.equal(g.hero.motion?.kind,'jump');step(g,50);assert.equal(g.hero.motion,null);assert.ok(walkable(g.map,g.hero.x,g.hero.y));assert.ok(Math.hypot(m.x-g.hero.x,m.y-g.hero.y)>=24||m.hp===0);
});
test('server sessions cap elapsed time, isolate users, deduplicate actions and reject replaced sessions',()=>{
 let now=0;const service=new RogueService(()=>now,()=>17),v=service.start('one','hong'),other=service.start('two','hong');assert.throws(()=>service.start('three','white-bob'));const a=service.command('one',v.id,1,{...idle,skill:0});assert.equal(a.cooldowns[0],5);assert.deepEqual(service.command('one',v.id,1,{...idle,skill:0}),a);
 assert.throws(()=>service.command('two',v.id,1,idle));assert.throws(()=>service.command('one',v.id,3,idle));assert.throws(()=>service.command('one',v.id,0,idle));
 now=100000;const b=service.command('one',v.id,2,idle);assert.ok(b.elapsed<=.250001);assert.equal(service.command('two',other.id,1,idle).kills,0);service.start('one','hong');assert.throws(()=>service.command('one',v.id,3,idle));
 for(const p of [{...idle,x:NaN},{...idle,y:2},{...idle,jump:1},{...idle,skill:3}])assert.throws(()=>parseRogueInput(p));
});
test('seeded headless run can fight through rooms and reach the exit without stage transitions',async()=>{
 const {Path}=await import('rot-js');const g=new RogueEngine(33);let goal={...g.map.start},waypoint={...goal};
 for(let tick=0;tick<26000&&g.status==='playing';tick++){
  const living=g.mobs.filter(m=>m.hp>0).sort((a,b)=>Math.hypot(a.x-g.hero.x,a.y-g.hero.y)-Math.hypot(b.x-g.hero.x,b.y-g.hero.y));
  const nearest=living[0],close=nearest&&Math.hypot(nearest.x-g.hero.x,nearest.y-g.hero.y)<100&&lineClear(g.map,g.hero,nearest);
  const missing=g.map.rooms.find(r=>!g.visited.has(r.id));goal=nearest??missing?.center??g.map.exit;
  if(tick%10===0){const points:{x:number;y:number}[]=[];new Path.AStar(cell(goal.x),cell(goal.y),(x,y)=>x>=0&&y>=0&&x<g.map.width&&y<g.map.height&&g.map.tiles[y*g.map.width+x]===0,{topology:4}).compute(cell(g.hero.x),cell(g.hero.y),(x,y)=>points.push({x:(x+.5)*ROGUE_TILE,y:(y+.5)*ROGUE_TILE}));waypoint=points[1]??goal;}
  const dx=waypoint.x-g.hero.x,dy=waypoint.y-g.hero.y,d=Math.hypot(dx,dy),input={x:close||d<3?0:dx/Math.max(d,1),y:close||d<3?0:dy/Math.max(d,1),auto:true};
  if(close&&g.cooldowns[0]===0)g.command({...input,skill:0});g.step(.02,input);
 }
 assert.equal(g.status,'won',JSON.stringify({kills:g.kills,remaining:g.mobs.filter(m=>m.hp>0).length,hp:g.hero.hp,rooms:g.visited.size,x:g.hero.x,y:g.hero.y}));assert.equal(g.cleared.size,10);assert.ok(g.kills>=27);
});
