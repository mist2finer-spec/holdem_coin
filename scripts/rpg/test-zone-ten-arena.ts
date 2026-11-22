import test from 'node:test';import assert from 'node:assert/strict';
import arena from '../../src/lib/generated/zone-ten-arena.json';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import {SOURCE_TRAVERSAL} from '../../src/lib/rpg-traversal-profile';
const idle={x:0,y:0,auto:false};
test('zone ten uses its authored grass map, 2000 HP and unchanged side approach',()=>{
 const g=new MountSundayEngine(111,undefined,9);assert.equal(g.map.sceneKey,'MountZone10');assert.equal(g.map.environment,arena.revision);assert.deepEqual(g.map.terrain,arena.terrain);assert.equal(g.view().mobs.find(m=>m.unityBoss)!.maxHP,2000);
 const start=g.view().hero;g.acceptClientHints({readyBoss:true});for(let i=0;i<99;i++)g.step(.02,idle);assert.equal(g.view().cameraMode,'Side25D');g.step(.02,idle);assert.equal(g.view().hero.x-start.x,300);assert.equal(g.view().cameraMode,'QuarterView');
});
test('walking, rolling, sliding and jumping cannot escape the circular combat boundary',()=>{
 for(const action of ['walk','dodge','slide','jump'])for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1}]){
  const g=new UnityBossEngine(111,{slimeCount:0},arena);g.enterArena();const input={...dir,auto:false};
  for(let i=0;i<700;i++){if(action!=='walk')g.command({...input,[action]:true});g.step(.02,input);assert(Math.hypot(g.hero.x-arena.center.x,g.hero.y-arena.center.y)<=arena.radius-19.9,action+' left circle');}
 }
});
test('boss defeat opens the village exit without completing; arrival alone completes the run',()=>{
 const g=new MountSundayEngine(111,SOURCE_TRAVERSAL,9);g.acceptClientHints({readyBoss:true});const map=g.map;
 for(let i=0;i<10000&&!g.view().bossDefeated;i++)g.step(.02,{...idle,auto:true});
 assert(g.view().bossDefeated);assert.equal(g.status,'playing');assert.equal(g.view().phase,'village-exit');assert.equal(g.view().villageEntered,false);assert.equal(g.view().elementalProjectiles.length,0);
 const waiting=g.view().hero;assert.equal(g.view().villageExitOpen,false);
 for(let i=0;i<40;i++)g.step(.02,{...idle,auto:true});assert.equal(g.view().hero.x,waiting.x);assert.equal(g.view().hero.y,waiting.y);assert(g.view().villageExitProgress>0&&g.view().villageExitProgress<1);assert.equal(g.view().villageExitOpen,false);
 const progress=g.view().villageExitProgress;for(let i=0;i<20;i++)g.step(.02,{...idle,paused:true});assert.equal(g.view().villageExitProgress,progress,'pause also pauses rock descent');
 const p=g.view().hero;for(let i=0;i<250;i++)g.step(.02,idle);assert.equal(g.status,'playing');assert.equal(g.view().hero.x,p.x);assert(!g.command({...idle,attack:true}));
 g.step(.02,{...idle,auto:true});const running=g.view().hero;assert.equal(running.action,'run1');assert(Math.abs(Math.hypot(running.x-p.x,running.y-p.y)-SOURCE_TRAVERSAL.run*.02)<.001,'AUTO exit uses ordinary running speed');
 for(let i=0;i<6000&&g.status==='playing';i++)g.step(.02,{...idle,auto:true});
 assert.equal(g.status,'won');assert(g.view().villageEntered);assert.equal(g.map,map);assert.equal(g.view().routeZone,9);assert.equal(g.view().totalRooms,10);
 const final=g.view();for(let i=0;i<250;i++)g.step(.02,{x:1,y:1,auto:true});assert.deepEqual(g.view(),final);
});
test('village corridor stays blocked while the rocks descend, then admits manual movement',()=>{
 const g=new UnityBossEngine(111,{slimeCount:0,bossHP:60},arena);g.enterArena();
 for(let i=0;i<5000&&!g.bossDefeated;i++)g.step(.02,{...idle,auto:true});assert(g.bossDefeated);
 const exit=arena.exitWaypoints[0],dx=exit.x-arena.center.x,dy=exit.y-arena.center.y,d=Math.hypot(dx,dy),dir={x:dx/d,y:dy/d,auto:false};
 g.hero.x=arena.center.x+dir.x*(arena.radius-21);g.hero.y=arena.center.y+dir.y*(arena.radius-21);
 for(let i=0;i<40;i++){g.step(.02,dir);assert(Math.hypot(g.hero.x-arena.center.x,g.hero.y-arena.center.y)<=arena.radius-19.9);}
 for(let i=0;i<60;i++)g.step(.02,dir);assert(g.view().villageExitOpen);assert(Math.hypot(g.hero.x-arena.center.x,g.hero.y-arena.center.y)>arena.radius+100);
});
// Brief 3 (2026-11-22): a knockback next to the boulders must not carry the hero past them. The kernel hero already stopped at the
// walking wall, but motion.to kept the unreachable point, and Unity draws a knockback as from -> to over .45 s
// (NativeCombatPresentation.ProjectHero), so the drawn hero flew through the boulders. Both the kernel path and that drawn path
// must stay inside the walking wall at every angle (entrance and closed exit included); mid-arena knockbacks keep their 260 cm.
const LANE=5000,C=arena.center,WALL=arena.radius-20,radiusOf=(p:{x:number;y:number})=>Math.hypot(p.x-C.x,p.y-C.y);
// Walk out from the centre along the angle until the wall stops the hero (as a player would), put the boss behind, then blast.
function blastAtWall(g:UnityBossEngine,angle:number){const d={x:Math.cos(angle),y:Math.sin(angle)};g.boss.x=C.x-d.x*600;g.boss.y=C.y-d.y*600;
 g.hero.x=C.x;g.hero.y=C.y;for(let i=0;i<400;i++)g.step(.02,{...d,auto:false});const heroR=radiusOf(g.hero);
 g.hero.motion=null;g.hero.action='stay1';g.boss.x=C.x+d.x*(heroR-450);g.boss.y=C.y+d.y*(heroR-450);
 g.warning={id:1,attackId:1,x:g.hero.x,z:g.hero.y-LANE,radius:150,born:g.elapsed,explodeAt:g.elapsed+.01};const from={x:g.hero.x,y:g.hero.y};let maxR=0,m:any=null;
 for(let i=0;i<30;i++){g.step(.02,idle);if(g.hero.motion?.kind==='knockback')m=g.hero.motion;maxR=Math.max(maxR,radiusOf(g.hero));}return {from,maxR,m,end:{x:g.hero.x,y:g.hero.y}};}
test('a knockback next to the boulders stops at the wall in the kernel and in the drawn path',()=>{
 for(let a=0;a<360;a+=15){const g=new UnityBossEngine(111,{slimeCount:0},arena);g.enterArena();const r=blastAtWall(g,a*Math.PI/180);
  assert(r.m,'knockback at '+a);assert(radiusOf(r.from)>WALL-40,'walked up to the wall at '+a+': '+radiusOf(r.from));
  assert(r.maxR<=WALL+1e-6,'kernel never past the wall at '+a+': '+r.maxR);
  for(let f=0;f<=1;f+=.05){const p={x:r.m.from.x+(r.m.to.x-r.m.from.x)*f,y:r.m.from.y+(r.m.to.y-r.m.from.y)*f};assert(radiusOf(p)<=WALL+1e-6,'drawn path past the wall at '+a+': '+radiusOf(p));}
  assert(Math.hypot(r.end.x-r.m.to.x,r.end.y-r.m.to.y)<1e-6,'kernel ends where it is drawn at '+a);}
 const g=new UnityBossEngine(111,{slimeCount:0},arena);g.enterArena();g.hero.x=C.x-200;g.hero.y=C.y;g.boss.x=C.x+200;g.boss.y=C.y;
 g.warning={id:1,attackId:1,x:g.hero.x,z:g.hero.y-LANE,radius:150,born:g.elapsed,explodeAt:g.elapsed+.01};for(let i=0;i<2;i++)g.step(.02,idle);
 const m:any=g.hero.motion;assert.equal(m?.kind,'knockback');assert(Math.abs(Math.hypot(m.to.x-m.from.x,m.to.y-m.from.y)-260)<1e-6,'mid-arena knockback keeps 260 cm');
});
test('after the boss falls the exit corridor still lets the hero walk out past the boulders',()=>{
 const g=new UnityBossEngine(111,{slimeCount:0,bossHP:60},arena);g.enterArena();
 for(let i=0;i<5000&&!g.bossDefeated;i++)g.step(.02,{...idle,auto:true});assert(g.bossDefeated);for(let i=0;i<60;i++)g.step(.02,idle);assert(g.view().villageExitOpen);
 const e=arena.exitWaypoints[0],d=Math.hypot(e.x-C.x,e.y-C.y),dir={x:(e.x-C.x)/d,y:(e.y-C.y)/d,auto:false};g.hero.x=C.x;g.hero.y=C.y;
 for(let i=0;i<400;i++)g.step(.02,dir);assert(radiusOf(g.hero)>arena.radius+300,'walked out through the opened exit: '+radiusOf(g.hero));
});
