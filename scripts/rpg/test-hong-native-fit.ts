import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-canvas';
import {groundSkeleton,attachmentBottom} from '../../src/components/rpg/hunt-ground';
import {hongNativeName,hongNativeContact,HONG_NATIVE_FOOT_SLOTS,HONG_NATIVE_BODY_SLOTS} from '../../src/components/rpg/hong-native-motion';
const root='public/rpg/characters/hong/native-axe/',raw=JSON.parse(fs.readFileSync(root+'hong.json','utf8')),original=JSON.parse(fs.readFileSync('archive/rpg/hong-native-v1/source.json','utf8'));
function rig(){const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:512,height:256} as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);}
test('native Hong fit changes bind dimensions while preserving all original animation channels and constraints',()=>{
 assert.equal(raw.bones.length,45);assert.deepEqual(raw.animations,original.animations);assert.deepEqual(raw.ik,original.ik);assert.deepEqual(raw.transform,original.transform);
 const b=(n:string)=>raw.bones.find((b:any)=>b.name===n);
 assert.equal(b('center').y,34);for(const n of ['Rleg','Lleg','Rleg2','Lleg2'])assert.equal(b(n).length,15);
 assert.equal(b('Larm').y,8);assert.equal(b('LShoulder').y,8);assert.equal(b('Rarm').y,-3.5);
 for(const n of ['Rleg2','Lleg2','Lleg3'])assert.equal(b(n).x,15);assert.equal(b('Rleg3').x,15.5);
 for(const a of Object.values(raw.skins[0].attachments.body) as any[]){let i=0,count=0;while(i<a.vertices.length){const n=a.vertices[i++];let sum=0,leg=0;for(let j=0;j<n;j++){const[bone,x,y,w]=a.vertices.slice(i,i+4);i+=4;assert.ok([x,y,w].every(Number.isFinite));sum+=w;if(bone===8||bone===10)leg+=w;}assert.ok(Math.abs(sum-1)<1e-8);assert.ok(leg<=.25);count++;}assert.equal(count,a.uvs.length/2);}
});
test('all 32 fitted native clips ground and mirror, with finite weighted meshes and unchanged event counts',()=>{
 const data=rig();Skeleton.yDown=true;
 for(const a of data.animations)for(const facing of [-1,1])for(let i=0;i<=30;i++){
  const s=new Skeleton(data);a.apply(s,0,a.duration*i/30,false,[],1,MixBlend.replace,MixDirection.mixIn);s.x=180;s.y=240;s.scaleX=.465*1.75*facing;s.scaleY=.465*1.75;s.updateWorldTransform(Physics.pose);
  assert.ok(s.bones.every(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite)));
  const slots=/avoid|die|defeat|jump|knockdown/.test(a.name)?HONG_NATIVE_BODY_SLOTS:HONG_NATIVE_FOOT_SLOTS;
  assert.ok(groundSkeleton(s,240,slots));assert.ok(Math.abs(attachmentBottom(s,slots)!-240)<.001,a.name);
  assert.equal(s.drawOrder.length,new Set(s.drawOrder).size);
 }
 assert.equal(hongNativeName('damage1'),'defeat1');assert.equal(hongNativeName('skill6'),'skill5');assert.equal(hongNativeName('walk'),'run1');
 for(let i=1;i<=5;i++){const name='attack'+i,a=data.findAnimation(name)!;assert.equal(hongNativeContact(name,a.duration),i===5?.3:.2);}
});
