import {assertNativeBoneTimelines}from './assert-hong-retarget';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,Skin,Physics,MixBlend,MixDirection}from '@esotericsoftware/spine-canvas';
import {attachmentBottom,groundSkeleton}from '../../src/components/rpg/hunt-ground';
import {weaponLoadout}from '../../src/components/rpg/hunt-weapons';
const variants=[['sword','Sword','sword07'],['spear','Spear','spear07'],['dual','Dagger','dagger07']]as const;
function load(root:string,name:string){const atlas=new TextureAtlas(fs.readFileSync(root+'/'+name+'.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height}as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(root+'/'+name+'.json','utf8')));}
Skeleton.yDown=true;
for(const [weapon,type,region]of variants){
 const originalRoot='archive/rpg/vardian-native-weapons',root='public/rpg/characters/hong/native-'+weapon;
 test(`${weapon}: recovered Cat matches original native motion and rendered meshes`,()=>{
  const source=load(originalRoot,'Hero_'+type+'01'),cat=load(originalRoot+'/cat-'+weapon,'cat');assert.equal(cat.bones.length,45);assert.equal(cat.animations.length,32);
  const skin=new Skin('cat');skin.addSkin(source.findSkin('cos/cos15')!);skin.addSkin(source.findSkin('weapon/grade7')!);
  for(const clip of cat.animations)for(let frame=0;frame<=16;frame++){
   const a=new Skeleton(source),b=new Skeleton(cat);a.setSkin(skin);a.setSlotsToSetupPose();
   for(const s of [a,b]){s.data.findAnimation(clip.name)!.apply(s,0,clip.duration*frame/16,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.pose);}
   for(let i=0;i<a.bones.length;i++)for(const k of ['worldX','worldY','a','b','c','d']as const)assert.equal(a.bones[i][k],b.bones[i][k]);
   for(let i=0;i<a.slots.length;i++){const aa=a.slots[i].getAttachment()as any,bb=b.slots[i].getAttachment()as any;if(!aa||!aa.worldVerticesLength)continue;assert.ok(bb,clip.name);const av=new Float32Array(aa.worldVerticesLength),bv=new Float32Array(bb.worldVerticesLength);aa.computeWorldVertices(a.slots[i],0,av.length,av,0,2);bb.computeWorldVertices(b.slots[i],0,bv.length,bv,0,2);assert.deepEqual(av,bv,clip.name+' '+a.slots[i].data.name);}
  }
 });
 test(`${weapon}: Hong retains distinct native timelines, grip meshes and 4x atlas through all clips`,()=>{
  const raw=JSON.parse(fs.readFileSync(root+'/hong.json','utf8')),source=JSON.parse(fs.readFileSync(originalRoot+'/Hero_'+type+'01.json','utf8')),data=load(root,'hong');
  assert.deepEqual(raw.ik,source.ik);assert.deepEqual(raw.transform,source.transform);
  for(const [name,clip]of Object.entries(raw.animations)as [string,any][]){assertNativeBoneTimelines(clip.bones,source.animations[name].bones);for(const key of ['ik','transform','events'])assert.deepEqual(clip[key],source.animations[name][key]);}
  assert.equal(data.animations.length,32);assert.equal(data.bones.length,45);const atlas=fs.readFileSync(root+'/hong.atlas','utf8');assert.match(atlas,/size:2048,1024/);assert.ok(atlas.includes('\n'+region+'\n'));assert.ok(!atlas.includes('axe07'));
  const ws=source.skins.find((s:any)=>s.name==='weapon/grade7').attachments;for(const [slot,atts]of Object.entries(ws))assert.deepEqual(raw.skins[0].attachments[slot],atts);
  const loadout=weaponLoadout('hong',weapon);for(const stage of loadout.combo)assert.ok(data.findAnimation(stage.animation));
  for(const clip of data.animations)for(const facing of [-1,1])for(let frame=0;frame<=20;frame++){
   const s=new Skeleton(data);clip.apply(s,0,clip.duration*frame/20,false,[],1,MixBlend.replace,MixDirection.mixIn);s.x=160;s.y=240;s.scaleX=.62*facing;s.scaleY=.62;s.updateWorldTransform(Physics.pose);
   assert.ok(s.bones.every(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite)));assert.equal(new Set(s.drawOrder).size,s.slots.length);
   const slots=/avoid|die|defeat|jump|knockdown/.test(clip.name)?['Rleg','Lleg2','body','head','Larm','Rarm']:['Rleg','Lleg2'];assert.ok(groundSkeleton(s,240,slots));assert.ok(Math.abs(attachmentBottom(s,slots)!-240)<.001);
  }
  if(weapon==='dual')assert.equal(raw.bones.find((b:any)=>b.name==='B_wp2').scaleY,undefined,'Preserve dagger-specific handedness');
  const axe=JSON.parse(fs.readFileSync('public/rpg/characters/hong/native-axe/hong.json','utf8'));assert.notDeepEqual(raw.animations.attack1.bones,axe.animations.attack1.bones,'Never substitute axe motion');
 });
}
