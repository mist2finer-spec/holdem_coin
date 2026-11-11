import test from 'node:test';import assert from 'node:assert/strict';
import {ElementalCombat,ELEMENTAL_RULES,sweepCircle,elementLineClear,type ElementWorld,type ElementTarget} from '../../src/lib/rpg-elemental-combat';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
import {packSwordContact} from '../../src/lib/rpg-reference-skills';
const idle={x:0,y:0,auto:false};
function fixture(){const targets:ElementTarget[]=[],events:any[]=[],hits:any[]=[];const w:ElementWorld={targets,obstacles:[],ground:()=>0,emit:e=>events.push(e),damage:(t,d,id,at,el)=>{t.hp-=d;hits.push({id:t.id,d,cast:id,at,el});},impulse:()=>{}};return {w,events,hits,fx:new ElementalCombat(),target:(id:number,x:number,y=0)=>{const t={id,x,y,elevation:0,hp:1000,radius:12.5,bodyHeight:31};targets.push(t);return t;}};}
function run(f:ReturnType<typeof fixture>,seconds=2){for(let i=1;i<=seconds*50;i++)f.fx.step(i*.02,.02,f.w);}
test('swept projectile detects initial overlap and a thin collider at 80m/s',()=>{assert.equal(sweepCircle({x:0,y:0},{x:160,y:0},{x:70,y:0},6),.4);assert.equal(sweepCircle({x:0,y:0},{x:160,y:0},{x:0,y:0},6),0);assert.equal(sweepCircle({x:0,y:0},{x:160,y:0},{x:70,y:40},6),Infinity);});
test('alternating sword stages hit at the same angular phase as their visible crescent',()=>{
 const hero={x:0,y:0,elevation:0,airHeight:0,facing:1,motion:{comboStep:1}},angle=-70*Math.PI/180,target={x:80*Math.cos(angle),y:80*Math.sin(angle),elevation:0,radius:12.5};
 assert(packSwordContact(.32+.26*.15,.32,.58,hero,target));hero.motion.comboStep=2;assert.equal(packSwordContact(.32+.26*.15,.32,.58,hero,target),null);assert(packSwordContact(.32+.26*.85,.32,.58,hero,target));
});
for(const variant of [1,2,3])test(`water variant ${variant}: real swept hits in multiple directions, dedup, gravity and bounded lifetime`,()=>{
 const f=fixture();f.target(1,100);f.target(2,-100);f.target(3,1000);f.fx.cast('water-ring',variant,{x:0,y:0,elevation:0},{x:0,y:0,elevation:0},0,1,120,f.w);run(f);assert.equal(f.hits.filter(h=>h.id===1).length,1);assert.equal(f.hits.filter(h=>h.id===2).length,1);assert.equal(f.hits.filter(h=>h.id===3).length,0);assert.equal(f.fx.view(2).length,0);assert(f.events.some(e=>e.kind==='elemental-splash'));assert((f.w.targets[0].wetUntil??0)>4);
});
test('water wall interception reflects once and shields a target behind the wall',()=>{const f=fixture();f.target(1,130);f.w.obstacles=[{x:60,y:0,radius:15,bodyHeight:200}];f.fx.cast('water-ring',1,{x:0,y:0,elevation:0},{x:0,y:0,elevation:0},0,1,120,f.w);for(let i=1;i<10;i++)f.fx.step(i*.02,.02,f.w);assert(f.fx.view(.18).some(d=>d.bounces===1&&d.vx<0));for(let i=10;i<=100;i++)f.fx.step(i*.02,.02,f.w);assert.equal(f.hits.length,0);assert(f.events.some(e=>e.blocked));});
for(const variant of [1,2,3])test(`lightning variant ${variant}: real damage once per cast, no tier radius increase`,()=>{const f=fixture();f.target(1,0);f.target(2,150);f.target(3,1200);f.fx.cast('storm-call',variant,{x:-100,y:0,elevation:0},{x:0,y:0,elevation:0},.1,1,180,f.w);run(f,1);assert.equal(f.hits.filter(h=>h.id===1).length,1);assert.equal(f.hits.filter(h=>h.id===2).length,1);assert.equal(f.hits.filter(h=>h.id===3).length,0);const events=f.events.filter(e=>e.kind==='elemental-strike');assert.equal(events.length,variant===1?1:variant===2?2:5);assert(events.every(e=>e.radius===ELEMENTAL_RULES.lightningRadius));});
test('lightning can be dodged after locking and a roof/trunk blocks the locked strike',()=>{for(const blocked of [false,true]){const f=fixture(),t=f.target(1,0);if(blocked)f.w.obstacles=[{x:0,y:0,radius:30}];f.fx.cast('storm-call',1,{x:-100,y:0,elevation:0},{x:0,y:0,elevation:0},.5,1,180,f.w);if(!blocked)t.x=400;run(f,1);assert.equal(f.hits.length,0);}});
test('wet status increases lightning by 25% and expires; obstacle LOS blocks splash damage',()=>{const f=fixture(),t=f.target(1,0);t.wetUntil=4;f.fx.cast('storm-call',1,{x:-100,y:0,elevation:0},{x:0,y:0,elevation:0},.1,1,180,f.w);run(f,1);assert.equal(f.hits[0].d,225);f.fx.cast('storm-call',1,{x:-100,y:0,elevation:0},{x:0,y:0,elevation:0},5,2,180,f.w);f.fx.step(5,.02,f.w);assert.equal(f.hits[1].d,180);assert(!elementLineClear({x:0,y:0,elevation:30},{x:100,y:0,elevation:30},[{x:50,y:0,radius:10}],()=>0));});
test('fixed tick projectile results do not depend on 30 vs 100 display FPS',()=>{const simulate=(fps:number)=>{const f=fixture();f.target(1,100);f.target(2,-100);f.fx.cast('water-ring',3,{x:0,y:0,elevation:0},{x:0,y:0,elevation:0},0,1,120,f.w);let acc=0,tick=0;for(let frame=0;frame<fps*2;frame++){acc+=1/fps;while(acc>=.02-1e-9){acc-=.02;f.fx.step(++tick*.02,.02,f.w);}}return f.hits;};assert.deepEqual(simulate(30),simulate(100));});
test('zone ten waits for environment then walks 3m side-on, reveals once, blends to quarter and pursues walking',()=>{
 const g=new MountSundayEngine(111,undefined,9);assert.equal(g.view().totalRooms,10);assert.equal(g.view().routeZone,9);assert.equal(g.view().phase,'boss-loading');const first=g.view().hero.x;
 for(let i=0;i<100;i++)g.step(.02,idle);assert.equal(g.view().hero.x,first);assert.equal(g.view().bossVisible,false);assert(!g.command({...idle,attack:true}));g.acceptClientHints({readyBoss:true});
 g.step(.02,idle);assert.equal(g.view().hero.action,'walk');assert.equal(g.view().cameraMode,'Side25D');let pause=g.view().elapsed;g.step(.02,{...idle,paused:true});assert.equal(g.view().elapsed,pause);
 for(let i=0;i<101;i++)g.step(.02,idle);assert.equal(g.view().hero.x-first,300);assert.equal(g.view().bossIntroStage,'reveal');assert.equal(g.view().cameraMode,'QuarterView');assert(g.view().bossVisible);assert.equal(g.view().fx.filter(f=>f.kind==='boss-arrival').length,1);
 for(let i=0;i<76;i++)g.step(.02,idle);assert.equal(g.view().bossIntroStage,'none');assert.equal(g.view().mobs.find(m=>m.unityBoss)!.action,'walk');assert.equal(g.view().totalRooms,10);
});
test('six existing gems drive all water/lightning variants, removal gates casts and five sword stages wrap without growth',()=>{
 for(const make of [()=>new MountSundayEngine(),()=>new UnityBossEngine(111,{slimeCount:0})]){const g=make();if(g instanceof MountSundayEngine){g.readyZone=0;g.spawned=30;}g.skillEnabled[0]=true;
  for(const [gem,element,variant] of [['icespear','water-ring',1],['icenova','water-ring',2],['frostshot','water-ring',3],['stormcall','storm-call',1],['arc','storm-call',2],['spark','storm-call',3]] as const){g.skillIds[0]=gem;g.cooldowns[0]=0;g.resources.mana=1000;assert(g.command({...idle,skill:0}));assert.equal(g.hero.motion?.skillId,element);assert.equal(g.hero.motion?.variant,variant);for(let i=0;i<60;i++)g.step(.02,idle);}
  g.skillEnabled[0]=false;g.cooldowns[0]=0;assert(!g.command({...idle,skill:0}));const stages=[];for(let i=0;i<6;i++){assert(g.command({...idle,attack:true}));stages.push(g.hero.motion!.comboStep);for(let j=0;j<30;j++)g.step(.02,idle);}assert.deepEqual(stages,[1,2,3,4,5,1]);
 }
});
test('tenth-zone victory is terminal: no extra boss map or eleventh zone after escape',()=>{
 const g=new MountSundayEngine(111,undefined,9);g.acceptClientHints({readyBoss:true});
 for(let i=0;i<10000&&g.status==='playing';i++)g.step(.02,{...idle,auto:true});
 assert.equal(g.status,'won');const state=g.view(),map=g.map;
 assert.equal(state.routeZone,9);assert.equal(state.totalRooms,10);assert.equal(state.phase,'complete');
 for(let i=0;i<500;i++){g.acceptClientHints({readyZone:10,readyBoss:true});assert.equal(g.command({...idle,attack:true}),false);g.step(.02,{x:1,y:0,auto:true});}
 assert.equal(g.map,map);assert.deepEqual(g.view(),state);
});
