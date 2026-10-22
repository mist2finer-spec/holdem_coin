// Parse every exported Spine skeleton with the actual runtime, without a browser/GPU.
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-canvas';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../rpg-assets');
const entries=JSON.parse(readFileSync(resolve(root,'catalog/spine.json'),'utf8'));
let animations=0;
const failures=[];
for(const item of entries){
 try{
  const folder=dirname(resolve(root,item.manifest));
  const atlas=new TextureAtlas(readFileSync(resolve(folder,item.atlas),'utf8'));
  for(const page of atlas.pages)page.setTexture(new CanvasTexture({width:page.width,height:page.height}));
  const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(resolve(folder,item.skeleton),'utf8')));
  const skeleton=new Skeleton(data);
  if(data.skins.length)skeleton.setSkin(data.skins[0]);
  skeleton.setSlotsToSetupPose();
  const state=new AnimationState(new AnimationStateData(data));
  for(const animation of data.animations){
   skeleton.setToSetupPose();skeleton.updateWorldTransform(Physics.reset);state.clearTracks();state.setAnimation(0,animation.name,false);
   for(const dt of [0.016,0.25]){
    state.update(dt);state.apply(skeleton);skeleton.update(dt);skeleton.updateWorldTransform(Physics.update);
    for(const bone of skeleton.bones)assert.ok([bone.worldX,bone.worldY,bone.a,bone.b,bone.c,bone.d].every(Number.isFinite),`${animation.name}/${bone.data.name}: non-finite transform`);
   }
   animations++;
  }
 }catch(error){failures.push({name:item.name,error:error.message});}
}
console.log(JSON.stringify({skeletons:entries.length,animations,failures},null,2));
if(failures.length)process.exitCode=1;
