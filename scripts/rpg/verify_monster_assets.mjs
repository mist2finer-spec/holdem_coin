import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-canvas';
const root=resolve(process.argv[2]??'');
const assets=JSON.parse(readFileSync(join(root,'monster-assets.json'),'utf8'));Skeleton.yDown=true;
let clips=0,frames=0,skins=0;const issues=[];
for(const asset of assets){
 const folder=join(root,'monsters',asset.name),atlas=new TextureAtlas(readFileSync(join(folder,asset.atlas),'utf8'));
 for(const page of atlas.pages){const png=readFileSync(join(folder,page.name));assert.equal(png.subarray(1,4).toString(),'PNG');const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.equal(page.width,width);assert.equal(page.height,height);page.setTexture(new CanvasTexture({width,height}));}
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(join(folder,asset.skeleton),'utf8'))),skeleton=new Skeleton(data);
 const state=new AnimationState(new AnimationStateData(data));
 for(const skin of data.skins){skeleton.setSkin(skin);skeleton.setToSetupPose();skeleton.updateWorldTransform(Physics.update);skins++;}
 if(data.skins.length)skeleton.setSkin(data.skins[0]);
 for(const a of data.animations){
  const skeleton=new Skeleton(data),state=new AnimationState(new AnimationStateData(data));if(data.skins.length)skeleton.setSkin(data.skins[0]);skeleton.setToSetupPose();state.setAnimation(0,a.name,false);clips++;
  for(let i=0;i<Math.ceil(a.duration*30)+2;i++){state.update(1/30);state.apply(skeleton);skeleton.update(1/30);skeleton.updateWorldTransform(Physics.update);const invalid=skeleton.bones.filter(b=>![b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite));frames++;if(invalid.length){issues.push({asset:asset.name,clip:a.name,frame:i,bones:invalid.map(b=>b.data.name)});break;}}
 }
}
const result={status:issues.length?'PARTIAL':'PASSED',packs:assets.length,clips,passedClips:clips-issues.length,skins,frames,issues,scope:'original Spine parser, skin, atlas dimensions and animation transforms; no screenshot or full collider-gameplay validation'};
writeFileSync(join(root,'asset-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
