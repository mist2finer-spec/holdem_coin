import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {ElementalCombat,linkedElementSupports,ELEMENTAL_RULES,type ElementWorld} from '../../src/lib/rpg-elemental-combat';
import {MountSundayEngine} from '../../src/lib/rpg-mount-sunday-engine';
import {compileSkill,newBuild} from '../../src/components/rpg/hunt-build';
import {createStarterEquipment} from '../../src/components/rpg/idle-equipment';
test('lightning tier uses effective connected supports, not socket count or unconnected inventory',()=>{
 const b=newBuild();b.equipment=createStarterEquipment('axe');const item=b.equipment.items.find(i=>i.instanceId===b.equipment!.equipped.weapon)!;
 item.rarity='heroic';item.gems=['stormcall','echo','elemental','reach','quick'];item.socketColors=['white','white','white','white','white'];item.socketLinks=[true,true,false,true];
 assert.equal(linkedElementSupports(compileSkill(b,0)),2);item.socketLinks[2]=true;assert.equal(linkedElementSupports(compileSkill(b,0)),4);
 item.gems[2]=null;assert.equal(linkedElementSupports(compileSkill(b,0)),3);assert.equal(linkedElementSupports({supportIds:['echo','echo','',null]}),1);assert.equal(linkedElementSupports({}),0);
});
for(const variant of [1,2,3])test(`lightning ${variant}: support presentation is captured per strike without expanding damage`,()=>{
 const results=[];
 for(const supports of [0,1,2,4,5]){
  const fx=new ElementalCombat(),events:any[]=[],hits:any[]=[];const world:ElementWorld={targets:[{id:1,x:0,y:0,elevation:0,radius:12.5,hp:1000}],obstacles:[],ground:()=>0,emit:e=>events.push(e),damage:(t,d)=>{t.hp-=d;hits.push(d);},impulse:()=>{}};
  fx.cast('storm-call',variant,{x:-100,y:0,elevation:0},{x:0,y:0,elevation:0},0,1,180,world,supports);
  for(let i=0;i<60;i++)fx.step(i*.02,.02,world);
  assert(events.every(e=>e.linkedSupports===supports&&e.radius===ELEMENTAL_RULES.lightningRadius));results.push(hits);
 }
 for(const result of results)assert.deepEqual(result,[180]);
});
test('boss handoff preserves linked supports; changing gear mid-cast affects the next cast',()=>{
 const g=new MountSundayEngine(111,undefined,9);g.skillIds[0]='stormcall';g.skillEnabled[0]=true;g.skillSupportCounts[0]=4;g.acceptClientHints({readyBoss:true});const input={x:0,y:0,auto:false};
 for(let i=0;i<180;i++)g.step(.02,input);assert(g.command({...input,skill:0}));g.skillSupportCounts[0]=0;
 for(let i=0;i<50;i++)g.step(.02,input);const events=g.view().fx.filter(f=>f.kind==='elemental-strike');assert(events.length);assert(events.every(f=>f.linkedSupports===4));
});
test('shipped local kernel passes compiled support metadata and removal through actual skill commands',()=>{
 const c:any=vm.createContext({});vm.runInContext(readFileSync('unity/IslandGame/Assets/Island/Resources/TrainingCombatKernel.js.txt','utf8'),c);
 const build={skills:[{activeId:'stormcall',enabled:true,supportIds:['echo','elemental','reach','quick']}]};
 c.stageInitialize(JSON.stringify({mode:'mount',seed:111,build}));
 const advance=(commands:any[]=[])=>JSON.parse(c.stageAdvance(JSON.stringify({steps:5,snapshot:true,input:{x:0,y:0,auto:false,readyZone:0},commands})));
 let s=advance([{skill:0}]);assert.equal(s.hero.motion.linkedSupports,4);let linked=false;for(let i=0;i<15;i++){s=advance();linked ||= s.fx.some((e:any)=>e.kind==='elemental-strike'&&e.linkedSupports===4);}assert(linked);
 build.skills[0].supportIds=[];c.stageProfile(JSON.stringify({build}));for(let i=0;i<65;i++)advance();s=advance([{skill:0}]);assert.equal(s.hero.motion.linkedSupports,0);
});
