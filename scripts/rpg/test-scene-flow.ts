import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneFlow,sceneBinding,sceneCoverage,type SceneLayout} from '../../src/components/rpg/hunt-scene-flow';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {newHuntProgress} from '../../src/components/rpg/hunt-progression';
import {LABYRINTH} from '../../src/components/rpg/hunt-labyrinth';
import raw from '../../src/components/rpg/data/scene-flow-runtime.json';
function simple():SceneLayout{return {source:'test',mapKey:[1,1],root:'MapEntityRoot',axis:'z',startX:0,spawns:[{id:0,name:'소형',x:100}],waves:[{id:0,waveNo:1,spawns:[0],delay:0,repeat:false,interval:0,count:0}],triggers:[{type:20,targets:[0],deps:[],x:100,radius:5}]};}
test('an area encounter cannot clear before entry; crossing starts it only once',()=>{
 const flow=new SceneFlow(simple());let emitted=0,alive=false;
 flow.step(.05,0,()=>alive,()=>{emitted++;alive=true;});assert.equal(emitted,0);assert.equal(flow.complete,false);assert.equal(flow.nextAreaX,100);
 flow.step(.05,110,()=>alive,()=>{emitted++;alive=true;});assert.equal(emitted,1);assert.equal(flow.nextAreaX,undefined);
 alive=false;flow.step(.05,0,()=>alive,()=>{emitted++;});assert.equal(flow.complete,true);flow.step(.05,110,()=>false,()=>{emitted++;});assert.equal(emitted,1);
});
test('delay overshoot spawns next update; repeat count is total and never catches up in a loop',()=>{
 const layout=simple();layout.triggers[0].type=10;Object.assign(layout.waves[0],{delay:.1,repeat:true,interval:.2,count:3});const flow=new SceneFlow(layout);let emitted=0;
 flow.step(1,0,()=>false,()=>{emitted++;});assert.equal(emitted,0);
 for(let i=0;i<6;i++)flow.step(1,0,()=>false,()=>{emitted++;});assert.equal(emitted,3);assert.equal(flow.complete,false);
 flow.step(.1,0,()=>false,()=>{emitted++;});assert.equal(flow.complete,true);assert.equal(emitted,3);
});
test('wave clear triggers observe their own actor group, not actors from other waves',()=>{
 const layout=simple();layout.triggers[0].type=10;layout.waves.push({...layout.waves[0],id:1,waveNo:2});layout.triggers.push({type:40,targets:[1],deps:[0],x:0,radius:0});
 const flow=new SceneFlow(layout),spawned:number[]=[];
 flow.step(0,0,()=>false,(_p,id)=>spawned.push(id));assert.deepEqual(spawned,[0]);
 flow.step(.1,0,id=>id===1,(_p,id)=>spawned.push(id));flow.step(.1,0,id=>id===1,(_p,id)=>spawned.push(id));assert.deepEqual(spawned,[0,1]);assert.equal(flow.complete,false);
 flow.step(.1,0,()=>false,()=>{});assert.equal(flow.complete,true);
});
test('every shipped layout terminates when its areas are visited and its spawned monsters die',()=>{
 assert.ok(sceneCoverage().stages>=1193);
 for(const layout of Object.values(raw.layouts) as SceneLayout[]){
  const flow=new SceneFlow(layout);let emitted=0;
  for(let i=0;i<3000&&!flow.complete;i++)flow.step(.1,flow.nextAreaX??layout.startX,()=>false,()=>{emitted++;});
  assert.equal(flow.complete,true,layout.mapKey+'/'+layout.root);assert.equal(emitted,layout.waves.reduce((n,w)=>n+w.spawns.length*(w.repeat?w.count:1),0));assert.ok(emitted<=128);
 }
});
test('stage bindings resolve every name to valid original monster stats and visual assets',()=>{
 for(const [sid,b] of Object.entries(raw.stages)){
  const {layout,binding}=sceneBinding(Number(sid))!;
  for(const spawn of layout.spawns){const m=binding.roster[spawn.name];assert.ok(m,sid+':'+spawn.name);assert.ok(m.row[1]>0&&m.row[2]>0&&m.row.every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(LABYRINTH.assets[LABYRINTH.monsters[m.row[0]].asset]);}
  assert.equal(b.layout,sceneBinding(Number(sid))!.binding.layout);
 }
});
test('the original 1-4 has 23 referenced spawns plus one unused inspector definition',()=>{
 const {layout}=sceneBinding(104)!;assert.equal(layout.unusedSpawnDefinitions,1);assert.equal(layout.spawns.length,23);
 const p=newHuntProgress();p.labyrinthStage=3;const g=new HuntEngine(undefined,7,{campaign:true,hostile:true,progress:p});assert.equal(g.stage.total,23);assert.equal(g.stage.remaining,20);
 for(let i=0;i<10;i++)g.step(.05,0);assert.equal(g.stage.remaining,23);assert.ok(g.enemies.some(e=>e.boss));
});
test('automatic real combat advances all five introductory stages, including the empty boss approach',()=>{
 const p=newHuntProgress();p.attackTraining=500;const g=new HuntEngine(undefined,7,{campaign:true,hostile:true,progress:p});g.setAuto(true);
 const seen=new Set<number>();
 for(let i=0;i<24000&&p.labyrinthStage<5&&g.hp>0;i++){seen.add(g.stage.id);g.step(.05,0);}
 assert.deepEqual([...seen],[101,102,103,104,105]);assert.ok(p.labyrinthStage>=5,'stuck at '+g.stage.id+' '+g.stage.objective);assert.ok(p.kills>=77);assert.ok(g.hp>0);
});
