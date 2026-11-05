import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_NODES,CORE_EDGES,newBuild,passiveBuild} from '../../src/components/rpg/hunt-build';
import {JEWEL_CATALOG} from '../../src/components/rpg/jewel-catalog';
import {timelessTargets,resolveJewelTree,MAX_TIMELESS_TARGETS} from '../../src/components/rpg/jewel-system';

const helpers={make:(v:any)=>v,describe:()=>[],keys:Object.keys(passiveBuild(newBuild()))};
test('all eight sockets and five timeless families transform at most eight base nodes',()=>{
 const before=JSON.stringify(CORE_NODES);
 for(const socket of CORE_NODES.filter(n=>n.socketType==='timeless')){
  const targets=timelessTargets(CORE_NODES,socket);assert.equal(targets.length,MAX_TIMELESS_TARGETS);
  assert.deepEqual(timelessTargets([...CORE_NODES].reverse(),socket).map(n=>n.id),targets.map(n=>n.id));
  for(const jewel of JEWEL_CATALOG.filter(j=>j.kind==='timeless')){
   const build={...newBuild(),nodes:['root',socket.id],jewels:[{socketId:socket.id,jewelId:jewel.id,instanceId:'density',seed:7,order:1,conqueror:jewel.variants?.[0]}]};
   const tree=resolveJewelTree(CORE_NODES,CORE_EDGES,build,helpers);
   assert.deepEqual(tree.transformations.map(t=>t.nodeId).sort(),targets.map(n=>n.id).sort());
  }
 }
 assert.equal(JSON.stringify(CORE_NODES),before);
});
test('radius boundary, tie order and ineligible/cluster exclusions do not consume eight slots',()=>{
 const base=CORE_NODES.find(n=>!n.startFor&&n.kind==='small')!;
 const fixture=Array.from({length:10},(_,i)=>({...base,id:`n${i}`,x:310,y:0}));
 const excluded=[{...base,id:'start',startFor:'hong',x:0,y:0},{...base,id:'socket',kind:'socket' as const,x:0,y:0},{...base,id:'key',kind:'keystone' as const,x:0,y:0},{...base,id:'cluster',clusterId:'nested',x:0,y:0},{...base,id:'outside',x:310.001,y:0}];
 assert.deepEqual(timelessTargets([...excluded,...fixture],{x:0,y:0}).map(n=>n.id),['n0','n1','n2','n3','n4','n5','n6','n7']);
});
test('capped Doryani conversions still preserve spell/ES/attribute conversion semantics',()=>{
 const socket=CORE_NODES.find(n=>n.id==='jewel_3')!,base=CORE_NODES.find(n=>n.kind==='small'&&!n.startFor)!;
 const target={...base,id:'convert',x:socket.x,y:socket.y,intelligence:10,strength:5,dexterity:2,spellDamage:.2,energyShield:.1,shieldFlat:20};
 const tree=resolveJewelTree([socket,target],[],{nodes:[socket.id],jewels:[{socketId:socket.id,jewelId:'gloriousvanity',instanceId:'convert',seed:7,order:1,conqueror:'Doryani'}]},helpers);
 const n=tree.nodes.find(n=>n.id==='convert')!;assert.equal(n.dexterity,17);assert.equal(n.intelligence,undefined);assert.equal(n.spellDamage,undefined);assert.equal(n.energyShield,undefined);assert.equal(n.attackSpeed,.2);assert.ok((n.evasion??0)>=.12);
});
