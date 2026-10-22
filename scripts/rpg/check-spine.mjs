import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,Skin,TextureAtlas} from '@esotericsoftware/spine-canvas';
Skeleton.yDown=true;
for(const name of ['Hero_Axe01','Enemy_Slime_01_R']) {
 const atlas=new TextureAtlas(readFileSync(`public/rpg/${name}.atlas`,'utf8'));
 for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height}));
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(`public/rpg/${name}.json`,'utf8')));
 const skeleton=new Skeleton(data);
 if(name==='Hero_Axe01'){const skin=new Skin('test');skin.addSkin(data.findSkin('cos/cos0'));skin.addSkin(data.findSkin('weapon/grade1'));skeleton.setSkin(skin);}else skeleton.setSkin(data.skins[0]);
 skeleton.setSlotsToSetupPose();skeleton.updateWorldTransform(Physics.update);
 console.log(name,'setup bounds',skeleton.getBoundsRect());
 const state=new AnimationState(new AnimationStateData(data));
 for(const a of data.animations){skeleton.setToSetupPose();state.setAnimation(0,a.name,false);for(let i=0;i<30;i++){state.update(1/30);state.apply(skeleton);skeleton.update(1/30);skeleton.updateWorldTransform(Physics.update);for(const b of skeleton.bones)assert.ok([b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite),`${name} ${a.name}`);}}
 state.setAnimation(0,'stay1',true);state.update(.1);state.apply(skeleton);skeleton.updateWorldTransform(Physics.update);console.log(name,'stay bounds',skeleton.getBoundsRect());
 console.log(name,data.animations.length,'animations: PASS');
}
