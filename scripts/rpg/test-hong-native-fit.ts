import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-canvas';
import {groundSkeleton,attachmentBottom} from '../../src/components/rpg/hunt-ground';
import {hongNativeName,hongNativeContact,HONG_NATIVE_FOOT_SLOTS,HONG_NATIVE_BODY_SLOTS} from '../../src/components/rpg/hong-native-motion';
const root='public/rpg/characters/hong/native-axe/',raw=JSON.parse(fs.readFileSync(root+'hong.json','utf8')),original=JSON.parse(fs.readFileSync('archive/rpg/hong-native-v1/source.json','utf8'));
function rig(){const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height} as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);}
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

test('4x source atlas preserves JSON bytes, normalized UVs and posed mesh geometry',()=>{
 const source='archive/rpg/hong-native-hd-source/';assert.deepEqual(fs.readFileSync(root+'hong.json'),fs.readFileSync(source+'geometry.json'));
 const png=fs.readFileSync(root+'hong.png');assert.equal(png.readUInt32BE(16),2048);assert.equal(png.readUInt32BE(20),1024);
 const previous=new TextureAtlas(fs.readFileSync(source+'layout-1x.atlas','utf8')),current=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));
 for(const p of [...previous.pages,...current.pages])p.setTexture(new CanvasTexture({width:p.width,height:p.height} as HTMLImageElement));
 for(const r of previous.regions){const n=current.findRegion(r.name)!;assert.ok(n);for(const k of ['x','y','width','height'] as const)assert.equal(n[k],r[k]*4);for(const k of ['u','v','u2','v2'] as const)assert.equal(n[k],r[k]);}
 assert.match(fs.readFileSync(root+'hong-nearest.atlas','utf8'),/filter:Nearest,Nearest/);assert.match(fs.readFileSync(root+'hong.atlas','utf8'),/filter:Linear,Linear/);
 const oldData=new SkeletonJson(new AtlasAttachmentLoader(previous)).readSkeletonData(raw),newData=rig();
 for(const clip of newData.animations)for(const t of [0,clip.duration*.38,clip.duration]){
  const a=new Skeleton(oldData),b=new Skeleton(newData);for(const s of [a,b]){s.data.findAnimation(clip.name)!.apply(s,0,t,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.pose);}
  for(let i=0;i<a.slots.length;i++){
   const aa=a.slots[i].getAttachment() as any,bb=b.slots[i].getAttachment() as any;if(!aa||!aa.worldVerticesLength)continue;
   const av=new Float32Array(aa.worldVerticesLength),bv=new Float32Array(bb.worldVerticesLength);aa.computeWorldVertices(a.slots[i],0,av.length,av,0,2);bb.computeWorldVertices(b.slots[i],0,bv.length,bv,0,2);assert.deepEqual(av,bv);assert.deepEqual(aa.uvs,bb.uvs);
  }
 }
});

test('axe arm direction fix changes only bent arm color registration, never alpha/thickness or rig',async()=>{
 const {createCanvas,loadImage}=await import('@napi-rs/canvas');
 const source='archive/rpg/hong-axe-arm-orientation/';assert.deepEqual(fs.readFileSync(root+'hong.json'),fs.readFileSync(source+'geometry.json'));assert.deepEqual(fs.readFileSync(root+'hong.atlas'),fs.readFileSync(source+'layout.atlas'));
 const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8')),boxes=['hong_Rarm','hong_B_Rarm'].map(n=>atlas.findRegion(n)!);
 const pixels=async(file:string)=>{const im=await loadImage(file),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,im.width,im.height).data;};
 const before=await pixels(source+'before.png'),after=await pixels(root+'hong.png');assert.equal(before.length,after.length);let changed=0;
 for(let i=0;i<before.length;i+=4){const x=i/4%2048,y=Math.floor(i/4/2048);assert.equal(after[i+3],before[i+3],'Alpha silhouette/width must be identical');
  const inside=boxes.some(b=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height);const different=before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2];if(different){assert.ok(inside,'Unrelated texture changed');changed++;}}
 assert.ok(changed>100);assert.equal(JSON.parse(fs.readFileSync(root+'manifest.json','utf8')).armOrientation.thicknessChanged,false);
});
