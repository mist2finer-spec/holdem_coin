import test from 'node:test';import assert from 'node:assert/strict';
import arena from '../../src/lib/generated/zone-ten-arena.json';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
const idle={x:0,y:0,auto:false};
test('zone ten uses its authored grass map, 2000 HP and unchanged side approach',()=>{
 const g=new MountSundayEngine(111,undefined,9);assert.equal(g.map.sceneKey,'MountZone10');assert.equal(g.map.environment,'zone10-grass-arena-v1');assert.deepEqual(g.map.terrain,arena.terrain);assert.equal(g.view().mobs.find(m=>m.unityBoss)!.maxHP,2000);
 const start=g.view().hero;g.acceptClientHints({readyBoss:true});for(let i=0;i<99;i++)g.step(.02,idle);assert.equal(g.view().cameraMode,'Side25D');g.step(.02,idle);assert.equal(g.view().hero.x-start.x,300);assert.equal(g.view().cameraMode,'QuarterView');
});
test('walking, rolling, sliding and jumping cannot escape the circular combat boundary',()=>{
 for(const action of ['walk','dodge','slide','jump'])for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1}]){
  const g=new UnityBossEngine(111,{slimeCount:0},arena);g.enterArena();const input={...dir,auto:false};
  for(let i=0;i<700;i++){if(action!=='walk')g.command({...input,[action]:true});g.step(.02,input);assert(Math.hypot(g.hero.x-arena.center.x,g.hero.y-arena.center.y)<=arena.radius-19.9,action+' left circle');}
 }
});
test('boss defeat opens the village exit without completing; arrival alone completes the run',()=>{
 const g=new MountSundayEngine(111,undefined,9);g.acceptClientHints({readyBoss:true});const map=g.map;
 for(let i=0;i<10000&&!g.view().bossDefeated;i++)g.step(.02,{...idle,auto:true});
 assert(g.view().bossDefeated);assert.equal(g.status,'playing');assert.equal(g.view().phase,'village-exit');assert.equal(g.view().villageEntered,false);assert.equal(g.view().elementalProjectiles.length,0);
 const p=g.view().hero;for(let i=0;i<250;i++)g.step(.02,idle);assert.equal(g.status,'playing');assert.equal(g.view().hero.x,p.x);assert(!g.command({...idle,attack:true}));
 for(let i=0;i<6000&&g.status==='playing';i++)g.step(.02,{...idle,auto:true});
 assert.equal(g.status,'won');assert(g.view().villageEntered);assert.equal(g.map,map);assert.equal(g.view().routeZone,9);assert.equal(g.view().totalRooms,10);
 const final=g.view();for(let i=0;i<250;i++)g.step(.02,{x:1,y:1,auto:true});assert.deepEqual(g.view(),final);
});
