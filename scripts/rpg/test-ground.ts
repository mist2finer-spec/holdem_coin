import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,Skin,TextureAtlas} from '@esotericsoftware/spine-canvas';
import {attachmentBottom,groundSkeleton} from '../../src/components/rpg/hunt-ground';
import {HUNT_VISUALS} from '../../src/components/rpg/hunt-collision';
test('posed feet/body bottoms share the exact ground plane across animations, flips and screen zooms',()=>{
 Skeleton.yDown=true;
 for(const name of ['Hero_Axe01','Enemy_Slime_01_R']){
  const atlas=new TextureAtlas(fs.readFileSync(`public/rpg/${name}.atlas`,'utf8'));
  for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height} as HTMLImageElement));
  const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(`public/rpg/${name}.json`,'utf8')));
  const sk=new Skeleton(data);
  if(name==='Hero_Axe01'){const skin=new Skin('test');for(const k of ['cos/cos0','weapon/grade1'])skin.addSkin(data.findSkin(k)!);sk.setSkin(skin);}else sk.setSkin(data.skins[0]);
  const slots=name==='Hero_Axe01'?['Rleg','Lleg2']:['body'];
  const state=new AnimationState(new AnimationStateData(data));
  for(const zoom of [.35,.8])for(const direction of [-1,1])for(const anim of data.animations){
   sk.setToSetupPose();state.setAnimation(0,anim.name,false);
   sk.scaleX=direction*zoom*(name==='Hero_Axe01'?HUNT_VISUALS.heroScale:HUNT_VISUALS.slimeScale);
   sk.scaleY=Math.abs(sk.scaleX);sk.x=200;sk.y=300;
   for(let frame=0;frame<Math.ceil(anim.duration*30)+1;frame++){
    state.update(1/30);state.apply(sk);sk.update(1/30);sk.updateWorldTransform(Physics.update);
    assert.equal(groundSkeleton(sk,300,slots),true,`${name} ${anim.name}`);
    assert.ok(Math.abs(attachmentBottom(sk,slots)!-300)<.002,`${name} ${anim.name} grounded`);
   }
  }
 }
 assert.equal(HUNT_VISUALS.slimeScale,1.2*.75);
});
