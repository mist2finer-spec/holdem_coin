import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';import {UnityBossEngine} from '../../src/lib/rpg-unity-boss-engine';
const source=readFileSync('docs/unity/client-source-snapshot/2026-11-10-environment/Resources/TrainingCombatKernel.js.txt','utf8');
function kernel(mode='mount'){const c:any=vm.createContext({});vm.runInContext(source,c);const initial=JSON.parse(c.stageInitialize(JSON.stringify({mode,seed:111})));return {c,initial,step(steps:number,input:any,commands:any[]=[]){return JSON.parse(c.stageAdvance(JSON.stringify({steps,input,commands,snapshot:true})));}};}
function equal(actual:any,expected:any){for(const key of Object.keys(expected))assert.deepEqual(actual[key],JSON.parse(JSON.stringify(expected[key])),key);}
test('training bundle uses original engines through ten zones and boss, with no network globals',()=>{
 const k=kernel(),g=new MountSundayEngine(111);let ticks=0,maps=1;const contacts=new Set<string>();
 for(;ticks<60000&&g.status==='playing';ticks++){
  const input={x:0,y:0,auto:true,readyZone:Math.min(9,g.room+1),readyBoss:g.room===10};g.acceptClientHints(input);g.step(.02,input);
  const actual=k.step(1,input);if(actual.map)maps++;
  if(ticks%100===0||g.status!=='playing')equal(actual,g.view());
  for(const fx of actual.fx??[])if(fx.damageKind==='attack')contacts.add(fx.definitionId);
 }
 assert.equal(g.room,10);assert.equal(g.status,'won');assert.equal(maps,11);assert.equal(g.kills,300);
 assert(contacts.has('hero-attack1')&&contacts.has('hero-attack2')&&contacts.has('hero-attack3'));
 console.log(JSON.stringify({ticks,maps,kills:g.kills,status:g.status,contacts:[...contacts]}));
});
test('readiness, pause, commands and profile updates retain local rules; snapshots omit unchanged map',()=>{
 const k=kernel(),g=new MountSundayEngine(111);assert(k.initial.map);assert.equal(k.initial.training,true);
 const run=(input:any,commands:any[]=[])=>{g.acceptClientHints(input);g.paused=!!input.paused;for(const e of commands)if(!input.paused)g.command({...input,...e});for(let i=0;i<5;i++)g.step(.02,input);const a=k.step(5,input,commands);equal(a,g.view());assert.equal(a.map,undefined);return a;};
 run({x:0,y:0,auto:false});assert.equal(g.spawned,0);
 const held={x:1,y:0,auto:false,readyZone:0};for(let i=0;i<30;i++)run(held);
 const before=g.elapsed;run({...held,paused:true},[{attack:true}]);assert.equal(g.elapsed,before);
 run(held,[{jump:true}]);for(let i=0;i<15;i++)run(held);run(held,[{dodge:true}]);
 const build={skills:[{enabled:true,activeId:'test',trigger:false}]};g.skillEnabled=[true,false,false,false,false,false];k.c.stageProfile(JSON.stringify({build}));
 for(let i=0;i<20;i++)run(held);run(held,[{skill:0}]);assert.equal(g.resources.mana,950);
});
test('standalone boss mode uses the same engine and rejects unknown modes',()=>{
 const k=kernel('boss'),g=new UnityBossEngine(111);
 for(let i=0;i<2000;i++){const input={x:0,y:0,auto:true};g.step(.02,input);const a=k.step(1,input);if(i%100===0)equal(a,g.view());}
 assert.throws(()=>k.c.stageInitialize('{"mode":"unknown"}'));
});
