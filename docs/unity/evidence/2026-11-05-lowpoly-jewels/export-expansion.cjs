process.env.NODE_PATH='G:/new_project/IslandGame/.island-tools/rpg-hud-checks/node_modules';
require('module').Module._initPaths();require('tsx/cjs');
const fs=require('fs'),h=require('C:/Users/SHK/island-3d-review/src/components/rpg/hunt-build.ts');
let b=h.newBuild('hong');const level=100;
function allocate(id){b=h.changeBuild(b,'core-path-'+id,level)}
function equip(socketId,instanceId,jewelId){allocate(socketId);b=h.equipJewel(b,socketId,{instanceId,jewelId,seed:713},level)}
for(const [tag,socket]of[['a','jewel_9'],['b','jewel_20']]){
 const id='review_large_'+tag;equip(socket,id,'axemancluster');
 for(const [part,index]of[[0,4],[1,8]]){
  const medium='review_medium_'+tag+'_'+part;equip('cluster_'+id+'_'+index,medium,'battlecluster');
  equip('cluster_'+medium+'_4','review_small_'+tag+'_'+part,'smalllife');
 }
}
h.validateBuild(b,level);const tree=h.getBuildTree(b);
const out={source:'actual getBuildTree/equipJewel/changeBuild',level,build:b,nodes:tree.nodes,edges:tree.edges,spent:tree.spent};
fs.writeFileSync('C:/Users/SHK/island-tree-design-review/expansion-graph.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({nodes:tree.nodes.length,edges:tree.edges.length,placements:b.jewels.length,spent:tree.spent,legalBuild:true}));
