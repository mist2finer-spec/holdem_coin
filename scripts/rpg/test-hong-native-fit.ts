import {assertNativeBoneTimelines}from './assert-hong-retarget';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-canvas';
import {groundSkeleton,attachmentBottom} from '../../src/components/rpg/hunt-ground';
import {hongNativeName,hongNativeContact,HONG_NATIVE_FOOT_SLOTS,HONG_NATIVE_BODY_SLOTS} from '../../src/components/rpg/hong-native-motion';
const root='public/rpg/characters/hong/native-axe/',raw=JSON.parse(fs.readFileSync(root+'hong.json','utf8')),original=JSON.parse(fs.readFileSync('archive/rpg/hong-native-v1/source.json','utf8'));
function rig(){const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height} as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);}
test('native Hong fit changes bind dimensions while preserving all original animation channels and constraints',()=>{
 assert.equal(raw.bones.length,45);for(const [name,clip]of Object.entries(raw.animations)as [string,any][]){assertNativeBoneTimelines(clip.bones,original.animations[name].bones);for(const key of ['ik','transform','events','slots'])assert.deepEqual(clip[key],original.animations[name][key]);}assert.deepEqual(raw.ik,original.ik);assert.deepEqual(raw.transform,original.transform);
 const b=(n:string)=>raw.bones.find((b:any)=>b.name===n);
 assert.equal(b('center').y,31.5);for(const n of ['Rleg','Lleg','Rleg2','Lleg2'])assert.equal(b(n).length,13.8);
 assert.equal(b('Larm').y,8);assert.equal(b('LShoulder').y,8);assert.equal(b('Rarm').y,-3.5);
 for(const n of ['Rleg2','Lleg2','Lleg3'])assert.equal(b(n).x,13.8);assert.equal(b('Rleg3').x,13.8);
 for(const a of Object.values(raw.skins[0].attachments.body) as any[]){let i=0,count=0;while(i<a.vertices.length){const n=a.vertices[i++];let sum=0,leg=0;for(let j=0;j<n;j++){const[bone,x,y,w]=a.vertices.slice(i,i+4);i+=4;assert.ok([x,y,w].every(Number.isFinite));sum+=w;if(bone===8||bone===10)leg+=w;}assert.ok(Math.abs(sum-1)<1e-8);assert.ok(leg<=.450001);count++;}assert.equal(count,a.uvs.length/2);}
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

test('4x atlas retains normalized source regions and adds source-resolution rigid heads',()=>{
 const source='archive/rpg/hong-native-hd-source/';
 const png=fs.readFileSync(root+'hong.png');assert.equal(png.readUInt32BE(16),2048);assert.equal(png.readUInt32BE(20),1024);
 const previous=new TextureAtlas(fs.readFileSync(source+'layout-1x.atlas','utf8')),current=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));
 for(const r of previous.regions){const n=current.findRegion(r.name)!;assert.ok(n);for(const k of ['x','y','width','height']as const)assert.equal(n[k],r[k]*4);for(const k of ['u','v','u2','v2']as const)assert.equal(n[k],r[k]);}
 for(const name of ['hong_head_joined','hong_S_head_joined','hong_B_head_joined'])assert.ok(current.findRegion(name)!.width>=140);
 assert.match(fs.readFileSync(root+'hong-nearest.atlas','utf8'),/filter:Nearest,Nearest/);assert.match(fs.readFileSync(root+'hong.atlas','utf8'),/filter:Linear,Linear/);
 assert.equal(JSON.parse(fs.readFileSync(root+'manifest.json','utf8')).connections.headSourceSize[0],1254);
});

test('archived axe direction pass changed only bent arm registration before the connection pass',async()=>{
 const {createCanvas,loadImage}=await import('@napi-rs/canvas');
 const source='archive/rpg/hong-axe-arm-orientation/';assert.deepEqual(fs.readFileSync('archive/rpg/hong-native-connections-v1/before.json'),fs.readFileSync(source+'geometry.json'));assert.deepEqual(fs.readFileSync('archive/rpg/hong-native-connections-v1/before.atlas'),fs.readFileSync(source+'layout.atlas'));
 const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8')),boxes=['hong_Rarm','hong_B_Rarm'].map(n=>atlas.findRegion(n)!);
 const pixels=async(file:string)=>{const im=await loadImage(file),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,im.width,im.height).data;};
 const before=await pixels(source+'before.png'),after=await pixels('archive/rpg/hong-native-connections-v1/hong.png');assert.equal(before.length,after.length);let changed=0;
 for(let i=0;i<before.length;i+=4){const x=i/4%2048,y=Math.floor(i/4/2048);assert.equal(after[i+3],before[i+3],'Alpha silhouette/width must be identical');
  const inside=boxes.some(b=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height);const different=before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2];if(different){assert.ok(inside,'Unrelated texture changed');changed++;}}
 assert.ok(changed>100);assert.equal(JSON.parse(fs.readFileSync(root+'manifest.json','utf8')).armOrientation.thicknessChanged,false);
});

function rows(v:number[]){let i=0,result:{bone:number;x:number;y:number;w:number}[][]=[];while(i<v.length){const n=v[i++],r=[];for(let j=0;j<n;j++){r.push({bone:v[i],x:v[i+1],y:v[i+2],w:v[i+3]});i+=4;}result.push(r);}return result;}
test('all Hong weapon views pin hip roots, isolate the chest, and connect skirt hems to legs',()=>{
 for(const weapon of ['axe','sword','dual','spear']){
  const r=JSON.parse(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.json`,'utf8')),skin=r.skins[0].attachments;let pinned=0,hem=0;
  for(const slot of ['Lleg2','Rleg'])for(const a of Object.values(skin[slot])as any[]){const rr=rows(a.vertices);for(let i=0;i<rr.length;i++)if(a.uvs[i*2+1]<=.07){assert.equal(rr[i].length,1);assert.ok([8,10].includes(rr[i][0].bone));assert.ok(rr[i][0].x>=-2.000001&&rr[i][0].x<=.500001);pinned++;}}
  for(const [name,a]of Object.entries(skin.body)as [string,any][]){const rr=rows(a.vertices);for(let i=0;i<rr.length;i++){const sum=rr[i].reduce((n,v)=>n+v.w,0);assert.ok(Math.abs(sum-1)<1e-8);const leg=rr[i].filter(v=>[8,10].includes(v.bone)).reduce((n,v)=>n+v.w,0);if(a.uvs[i*2+1]<.5||(name==='B_body'&&[0,1,17,18,19,22,23].includes(i))){assert.deepEqual(rr[i].map(v=>[v.bone,v.w]),[[2,1]]);}if(a.uvs[i*2+1]>=.75){assert.ok(Math.abs(leg-.45)<1e-8);hem++;}}}
  assert.ok(pinned>=12);assert.ok(hem>=12);
 }
});
test('hair uses native cloth bones behind the body; rigid faces never inherit cloth deformation',()=>{
 for(const weapon of ['axe','sword','dual','spear']){
  const r=JSON.parse(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.json`,'utf8')),skin=r.skins[0].attachments;
  for(const a of Object.values(skin.head)as any[]){assert.equal(a.vertices.length,a.uvs.length);assert.equal(a.hull,4);assert.match(a.name,/_joined$/);}
  const chain=['cloak1','cloak2','cloak3'].map(n=>r.bones.findIndex((b:any)=>b.name===n));
  for(const slot of ['hong-hair-under','hong-hair-over'])for(const a of Object.values(skin[slot])as any[]){assert.equal(a.uvs.length,28);const rr=rows(a.vertices);assert.ok(chain.every(b=>rr.some(row=>row.some(v=>v.bone===b&&v.w>0))));for(const row of rr){assert.ok(Math.abs(row.reduce((s,v)=>s+v.w,0)-1)<1e-8);assert.ok(row.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.w>=0));}}
  const data=(()=>{const atlas=new TextureAtlas(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.atlas`,'utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height}as HTMLImageElement));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(r);})();
  Skeleton.yDown=true;
  for(const clip of data.animations)for(const facing of [-1,1]){const s=new Skeleton(data);s.scaleX=facing;for(let f=0;f<=30;f++){clip.apply(s,Math.max(0,clip.duration*(f-1)/30),clip.duration*f/30,false,[],1,MixBlend.replace,MixDirection.mixIn);s.update(1/60);s.updateWorldTransform(Physics.update);assert.ok(s.bones.every(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(Number.isFinite)));const order=s.drawOrder.map(v=>v.data.name);for(const hair of ['hong-hair-under','hong-hair-over']){assert.ok(order.indexOf(hair)<order.indexOf('body'));const slot=s.findSlot(hair)!,mesh=slot.getAttachment()as any;if(!mesh)continue;const v=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(slot,0,v.length,v,0,2);const dx=v[2]-v[0],dy=v[3]-v[1];for(let row=1;row<7;row++){const i=row*4;assert.ok((v[i+2]-v[i])*dx+(v[i+3]-v[i+1])*dy>0,weapon+' '+clip.name+' hair cross-section folded');}}}}
 }
});

test('proportions shorten bones/arms and widen each weighted leg segment without changing weights or hip pins',()=>{
 for(const weapon of ['axe','sword','dual','spear']){
  const before=JSON.parse(fs.readFileSync(`archive/rpg/hong-native-proportions-v1/${weapon}.json`,'utf8')),after=JSON.parse(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.json`,'utf8'));
  const b=(r:any,n:string)=>r.bones.find((v:any)=>v.name===n);assert.equal(b(after,'center').y,31.5);
  for(const n of ['Rleg','Rleg2','Lleg','Lleg2'])assert.equal(b(after,n).length,13.8);
  for(const n of ['Rleg2','Lleg2','Lleg3','Rleg3'])assert.equal(b(after,n).x,13.8);
  for(const n of ['Larm','Larm2','Rarm','Rarm2'])assert.ok(Math.abs(b(after,n).length-b(before,n).length*.92)<1e-8);
  for(const n of ['Larm2','Rarm2','Rarm3','Rarm4'])assert.ok(Math.abs(b(after,n).x-b(before,n).x*.92)<1e-8);
  for(const slot of ['Larm','Rarm','Lleg2','Rleg'])for(const [name,a]of Object.entries(before.skins[0].attachments[slot])as [string,any][]){
   const aa=after.skins[0].attachments[slot][name];assert.deepEqual(aa.uvs,a.uvs);assert.deepEqual(aa.triangles,a.triangles);
   if(a.vertices.length===a.uvs.length){for(let i=0;i<a.vertices.length;i++)assert.ok(Math.abs(aa.vertices[i]-a.vertices[i]*(i%2?.85:.92))<1e-8);continue;}
   const old=rows(a.vertices),next=rows(aa.vertices);assert.equal(next.length,old.length);
   for(let i=0;i<old.length;i++)for(let j=0;j<old[i].length;j++){
    const v=old[i][j],n=next[i][j];assert.equal(n.bone,v.bone);assert.equal(n.w,v.w);
    const arm=[4,5,6,7].includes(v.bone),leg=[8,9,10,11].includes(v.bone),sy=arm?.85:[8,10].includes(v.bone)?1.32:[9,11].includes(v.bone)?1.24:[23,24].includes(v.bone)?1.08:1;
    assert.ok(Math.abs(n.x-v.x*(arm||leg?.92:1))<1e-8);assert.ok(Math.abs(n.y-v.y*sy)<1e-8);
   }
  }
  // Cosmetic heads and hair, including their weights, remain exactly the seam revision.
  for(const slot of ['head','hong-hair-under','hong-hair-over'])assert.deepEqual(after.skins[0].attachments[slot],before.skins[0].attachments[slot]);
 }
});
test('leg shaft alpha grows at least 20% inside all six cells while boot pixels and atlas layout stay fixed',async()=>{
 const {createCanvas,loadImage}=await import('@napi-rs/canvas');
 const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));assert.deepEqual(fs.readFileSync(root+'hong.atlas'),fs.readFileSync('archive/rpg/hong-native-proportions-v1/hong.atlas'));
 const pix=async(p:string)=>{const im=await loadImage(p),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,im.width,im.height).data;};
 const before=await pix('archive/rpg/hong-native-proportions-v1/hong.png'),after=await pix(root+'hong.png');
 for(const name of ['hong_Lleg1','hong_Lleg2','hong_B_Lleg1','hong_B_Lleg2','hong_Rleg','hong_B_Rleg']){
  const r=atlas.findRegion(name)!;let old=0,next=0;for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=((r.y+y)*2048+r.x+x)*4;if(y/r.height>=.15&&y/r.height<.68){if(before[i+3]>=128)old++;if(after[i+3]>=128)next++;}if(y>=Math.ceil(r.height*.78))for(let k=0;k<4;k++)assert.equal(after[i+k],before[i+k]);}assert.ok(next>=old*1.2,name+' leg shaft too narrow');
 }
});
test('all weapons keep slightly bent knees during default idle instead of locking at full IK extension',()=>{
 for(const weapon of ['axe','sword','dual','spear']){
  const atlas=new TextureAtlas(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.atlas`,'utf8'));for(const p of atlas.pages)p.setTexture(new CanvasTexture({width:p.width,height:p.height}as HTMLImageElement));const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(`public/rpg/characters/hong/native-${weapon}/hong.json`,'utf8')));
  for(const facing of [-1,1])for(const t of [0,.4,.8,1.2]){const s=new Skeleton(data);s.scaleX=facing;data.findAnimation('stay1')!.apply(s,0,t,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.pose);for(const name of ['Lleg2','Rleg2']){const knee=s.findBone(name)!;assert.ok(Math.abs(knee.arotation)>10&&Math.abs(knee.arotation)<65,weapon+' '+name+' idle knee extension');}}
 }
});
