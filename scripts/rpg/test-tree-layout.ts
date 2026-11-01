import test from 'node:test';import assert from 'node:assert/strict';
import {CORE_NODES,TREE_BOUNDS,newBuild,getBuildTree} from '../../src/components/rpg/hunt-build';
import {layoutTree,treeNodeSize,TREE_DISPLAY} from '../../src/components/rpg/tree-layout';
function check(nodes:typeof CORE_NODES){const before=JSON.stringify(nodes),layout=layoutTree(nodes,TREE_BOUNDS);assert.equal(layout.positions.size,nodes.length);assert.equal(JSON.stringify(nodes),before);
 for(const zoom of [TREE_DISPLAY.minZoom,TREE_DISPLAY.defaultZoom,1,TREE_DISPLAY.maxZoom])for(let i=0;i<nodes.length;i++){const a=layout.positions.get(nodes[i].id)!;assert.ok(a.x*zoom-treeNodeSize(nodes[i],zoom)/2>=0);assert.ok(a.x*zoom+treeNodeSize(nodes[i],zoom)/2<=layout.width*zoom);for(let j=i+1;j<nodes.length;j++){const b=layout.positions.get(nodes[j].id)!,distance=Math.hypot(a.x-b.x,a.y-b.y)*zoom,footprint=(treeNodeSize(nodes[i],zoom)+treeNodeSize(nodes[j],zoom))/2;assert.ok(distance-footprint>=8,`${nodes[i].id}/${nodes[j].id} overlap at ${zoom}`);}}
 return layout;
}
test('all 780 nodes, including coincident branches, remain separate from 25% through 180%',()=>{const a=check(CORE_NODES);assert.deepEqual(a,layoutTree([...CORE_NODES].reverse(),TREE_BOUNDS));assert.notDeepEqual(a.positions.get('balance_0_1'),a.positions.get('balance_2_1'));});
test('expanded cluster nodes remain separate while canonical jewel distances and edges stay untouched',()=>{
 const b=newBuild(),base=getBuildTree(b),queue=[[b.nodes[0]]],seen=new Set(b.nodes);for(const route of queue){const end=route.at(-1)!;if(end==='jewel_9'){b.nodes=route;break;}for(const [a,z]of base.edges){const next=a===end?z:z===end?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push([...route,next]);}}}b.jewels=[{socketId:'jewel_9',jewelId:'axemancluster',instanceId:'layout_cluster',seed:23,order:1}];const tree=getBuildTree(b),before=JSON.stringify(tree);assert.ok(tree.nodes.length>780);const layout=check(tree.nodes);for(const [a,z]of tree.edges){assert.ok(layout.positions.has(a));assert.ok(layout.positions.has(z));}assert.equal(JSON.stringify(tree),before);
});
