import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,RegionAttachment,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-canvas';
import {COMBAT_CHARACTERS} from '../../src/components/rpg/combat-characters';
import {attachmentBottom,groundSkeleton} from '../../src/components/rpg/hunt-ground';
import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
Skeleton.yDown=true;
for(const c of COMBAT_CHARACTERS)test(`${c.id}: articulated Spine rig, motion, floor and single contact timing`,()=>{
 const folder=`public/rpg/characters/${c.id}/rig`,raw=JSON.parse(fs.readFileSync(`${folder}/character.json`,'utf8'));
 const atlasText=fs.readFileSync(`${folder}/character.atlas`,'utf8');assert.equal(atlasText,fs.readFileSync(`${folder}/character.atlas.txt`,'utf8'));
 const atlas=new TextureAtlas(atlasText);for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height} as HTMLImageElement));
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
 assert.equal(data.bones.length,18);assert.equal(data.slots.length,16);
 const skeleton=new Skeleton(data);skeleton.setSkin(data.skins[0]);skeleton.setSlotsToSetupPose();
 for(const slot of skeleton.slots)assert.ok(slot.getAttachment() instanceof RegionAttachment);
 for(const name of ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','skill1','skill2','skill3','skill4','skill5','skill5_loop','skill5_end','rest1','damage1','die1'])assert.ok(data.findAnimation(name),name);
 const slots=data.slots.map(s=>s.name);
 for(const anim of data.animations){
  assert.equal(raw.animations[anim.name].slots,undefined,'motions must articulate bones, never swap complete pose pictures');
  const state=new AnimationState(new AnimationStateData(data));skeleton.setToSetupPose();skeleton.scaleX=1;skeleton.scaleY=1;skeleton.x=100;skeleton.y=200;
  state.setAnimation(0,anim.name,false);
  for(let frame=0;frame<=Math.ceil(anim.duration*60);frame++){
   state.update(1/60);state.apply(skeleton);skeleton.update(1/60);skeleton.updateWorldTransform(Physics.update);
   for(const b of skeleton.bones)assert.ok([b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite));
   assert.ok(groundSkeleton(skeleton,200,slots));assert.ok(Math.abs(attachmentBottom(skeleton,slots)!-200)<.003);
  }
 }
 for(const direction of [-1,1]){
  skeleton.setToSetupPose();skeleton.scaleX=direction;skeleton.scaleY=1;skeleton.updateWorldTransform(Physics.update);groundSkeleton(skeleton,200,slots);assert.ok(Math.abs(attachmentBottom(skeleton,slots)!-200)<.003);
 }
 for(const [i,stage] of HUNT_RULES.combo.entries()){
  const state=new AnimationState(new AnimationStateData(data)),events:number[]=[];state.addListener({event:(_entry,e)=>{if(e.data.name==='contact')events.push(e.intValue);}});
  state.setAnimation(0,stage.animation,false);state.update(stage.hitAt-.001);state.apply(skeleton);assert.deepEqual(events,[]);
  state.update(.002);state.apply(skeleton);assert.deepEqual(events,[i+1]);state.update(2);state.apply(skeleton);assert.deepEqual(events,[i+1]);
 }
 // The active joints must actually change over the run cycle.
 const state=new AnimationState(new AnimationStateData(data));skeleton.setToSetupPose();state.setAnimation(0,'run1',true);state.update(.01);state.apply(skeleton);const first=skeleton.findBone('front-thigh')!.rotation;state.update(.24);state.apply(skeleton);assert.ok(Math.abs(skeleton.findBone('front-thigh')!.rotation-first)>10);
});
test('all appearances preserve supplied art provenance and use the same native motion retarget',()=>{
 const motions=JSON.parse(fs.readFileSync('scripts/rpg/vardian-retarget.json','utf8'));
 assert.equal(motions.source,'public/rpg/Hero_Axe01.json');
 assert.equal(motions.sampleRate,60);
 for(const c of COMBAT_CHARACTERS){
  const root=`public/rpg/characters/${c.id}/rig`;
  const art=JSON.parse(fs.readFileSync(`${root}/original-art.json`,'utf8'));
  assert.equal(art.source,`public/island/chr_${c.portrait}.jpg`);
  const raw=JSON.parse(fs.readFileSync(`${root}/character.json`,'utf8'));
  assert.deepEqual(raw.animations,motions.animations);
 }
 assert.equal(COMBAT_CHARACTERS.find(c=>c.id==='boy-hoodie')!.portrait,2);
 assert.equal(COMBAT_CHARACTERS.find(c=>c.id==='white-bob')!.portrait,3);
 assert.equal(COMBAT_CHARACTERS.find(c=>c.id==='gold-dress')!.portrait,1);
});
