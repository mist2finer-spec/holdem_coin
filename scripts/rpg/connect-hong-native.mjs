/** Deterministic post-fit seam pass. Always run on freshly rebuilt source rigs. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as R from '@esotericsoftware/spine-canvas';
const weapons=process.argv.includes('--axe-only')?['axe']:['axe','sword','dual','spear'];
R.Skeleton.yDown=false;
const loader=new R.SkeletonJson({newMeshAttachment:(_,n)=>new R.MeshAttachment(n),newRegionAttachment:(_,n)=>new R.RegionAttachment(n),newBoundingBoxAttachment:()=>null,newPathAttachment:()=>null,newPointAttachment:()=>null,newClippingAttachment:()=>null});
const decode=v=>{let i=0,rows=[];while(i<v.length){const n=v[i++],row=[];for(let j=0;j<n;j++){row.push({bone:v[i],x:v[i+1],y:v[i+2],w:v[i+3]});i+=4;}rows.push(row);}return rows;};
const encode=rows=>rows.flatMap(row=>[row.length,...row.flatMap(v=>[v.bone,v.x,v.y,v.w])]);
for(const weapon of weapons){
 const root=`public/rpg/characters/hong/native-${weapon}`,raw=JSON.parse(fs.readFileSync(root+'/hong.json'));
 if(raw.skeleton.hash?.endsWith('-seams1'))throw Error('Rebuild base before connection pass');
 const sk=new R.Skeleton(loader.readSkeletonData({...raw,skins:[],animations:{}}));sk.updateWorldTransform(R.Physics.pose);
 const names=Object.fromEntries(raw.bones.map((b,i)=>[b.name,i])),skin=raw.skins[0].attachments,hipSet=new Set([names.Rleg,names.Lleg]);
 const world=row=>row.reduce((p,v)=>{const b=sk.bones[v.bone];p.x+=(b.a*v.x+b.b*v.y+b.worldX)*v.w;p.y+=(b.c*v.x+b.d*v.y+b.worldY)*v.w;return p;},{x:0,y:0});
 const weighted=(p,weights)=>weights.filter(([,w])=>w>1e-8).map(([bone,w])=>{const q=sk.bones[bone].worldToLocal({...p});return{bone,x:q.x,y:q.y,w};});
 let pinned=0,skirt=0,rigidChest=0;
 for(const slot of ['Lleg2','Rleg'])for(const a of Object.values(skin[slot])){
  const rows=decode(a.vertices);
  for(let i=0;i<rows.length;i++){
   const v=a.uvs[i*2+1];if(v>.16)continue;
   // Root rim follows the hip itself, never the knee. Fade back to original at v=.16.
   const row=rows[i],hip=slot==='Rleg'?names.Rleg:names.Lleg,p=world(row),q=sk.bones[hip].worldToLocal({...p});
   const blend=Math.max(0,Math.min(1,(.16-v)/.09));q.x=q.x*(1-blend)+Math.max(-2,Math.min(.5,q.x-3))*blend;
   const target=sk.bones[hip].localToWorld(q);
   rows[i]=weighted(target,blend>=.999?[[hip,1]]:row.map(v=>[v.bone,v.w]));pinned++;
  }
  a.vertices=encode(rows);
 }
 for(const [name,a]of Object.entries(skin.body)){
  const rows=decode(a.vertices);
  for(let i=0;i<rows.length;i++){
   const row=rows[i],uv=a.uvs.slice(i*2,i*2+2),p=world(row);
   // No leg influence anywhere in the chest, including the reported rear vertices.
   if(uv[1]<.50||(name==='B_body'&&[0,1,17,18,19,22,23].includes(i))){rows[i]=weighted(p,[[names.bone2,1]]);rigidChest++;continue;}
   if(uv[1]<.75)continue;
   const hipWeights=row.filter(v=>hipSet.has(v.bone)),sum=hipWeights.reduce((s,v)=>s+v.w,0);
   const hips=sum>0?hipWeights.map(v=>[v.bone,v.w/sum*.45]):[[uv[0]>.55?names.Rleg:names.Lleg,.45]];
   rows[i]=weighted(p,[...hips,[names.center,.4125],[names.bone2,.1375]]);skirt++;
  }
  a.vertices=encode(rows);
 }
 // Move only arm mesh shoulder rims into the torso, preserving hand/grip geometry.
 for(const slot of ['Rarm','Larm'])for(const a of Object.values(skin[slot])){
  if(a.vertices.length===a.uvs.length)continue;
  const rows=decode(a.vertices);
  for(let i=0;i<rows.length;i++){
   const amount=Math.max(0,1-a.uvs[i*2+1]/.25);if(!amount)continue;
   const p=world(rows[i]),target=sk.findBone('bone2');const dx=target.worldX-p.x,dy=target.worldY+10-p.y,len=Math.hypot(dx,dy)||1;
   p.x+=dx/len*2.5*amount;p.y+=dy/len*2.5*amount;
   rows[i]=weighted(p,rows[i].map(v=>[v.bone,v.w]));
  }a.vertices=encode(rows);
 }
 // One rigid head with its bangs; long hair alone has a segmented weighted mesh.
 for(const [key,a]of Object.entries(skin.head)){
  const hair=key==='head'?skin['hong-hair-under'].front:key==='S_head'?skin['hong-hair-under'].side:skin['hong-hair-over'].back;
  const left=hair.vertices[3],right=hair.vertices[1],top=26.54,bottom=-5.46;
  a.name=key==='head'?'hong_head_joined':key==='S_head'?'hong_S_head_joined':'hong_B_head_joined';
  a.vertices=[bottom,right,bottom,left,top,left,top,right];a.width=Math.abs(left-right);a.height=32;
 }
 for(const slot of ['hong-hair-under','hong-hair-over'])for(const [key,a]of Object.entries(skin[slot])){
  const corners=a.vertices,point=(u,v)=>({x:corners[4]+u*(corners[6]-corners[4])+v*(corners[2]-corners[4]),y:corners[5]+u*(corners[7]-corners[5])+v*(corners[3]-corners[5])});
  const levels=[0,.32,.47,.60,.73,.86,1],uv=[],verts=[],tri=[];
  for(let j=0;j<levels.length;j++)for(const u of [0,1]){
   const v=levels[j],p=sk.findBone('head').localToWorld(point(u,v));uv.push(u,v);
   let weights;
   if(v<=.47)weights=[[names.bone2,1]];
   else{const t=Math.max(0,Math.min(1,(v-.47)/.53)),chain=t*2,lo=Math.min(2,Math.floor(chain)),hi=Math.min(2,lo+1),f=chain-lo,gain=.15+.20*t;
    weights=[[names.bone2,1-gain],[names['cloak'+(lo+1)],gain*(1-f)],[names['cloak'+(hi+1)],gain*f]];
    const merged=new Map();for(const [b,w]of weights)merged.set(b,(merged.get(b)||0)+w);weights=[...merged];}
   verts.push(weighted(p,weights));
  }
  for(let j=0;j<levels.length-1;j++){const n=j*2;tri.push(n,n+2,n+1,n+1,n+2,n+3);}
  a.uvs=uv;a.vertices=encode(verts);a.triangles=tri;a.hull=levels.length*2;delete a.edges;
 }
 // Both hair slots stay behind the body in every draw order. Cat arm ordering survives.
 const slots=raw.slots.map(s=>s.name),hairs=['hong-hair-under','hong-hair-over'];
 function order(offsets){const draw=Array(slots.length).fill(null),unchanged=[];let i=0;for(const o of offsets??[]){const dest=slots.indexOf(o.slot);while(i<dest)unchanged.push(slots[i++]);draw[i+o.offset]=slots[i++];}while(i<slots.length)unchanged.push(slots[i++]);for(let j=draw.length-1;j>=0;j--)if(draw[j]===null)draw[j]=unchanged.pop();return draw;}
 for(const a of Object.values(raw.animations)){
  // No deform channels exist on rebuilt hair meshes. Face/weapon channels are untouched.
  for(const k of a.drawOrder??[]){const desired=order(k.offsets).filter(s=>!hairs.includes(s));const at=Math.min(desired.indexOf('Rarm'),desired.indexOf('body'));desired.splice(Math.max(0,at),0,...hairs);k.offsets=slots.map((slot,i)=>({slot,offset:desired.indexOf(slot)-i}));}
 }
 for(const p of raw.physics??[])if(/^cloak[123]$/.test(p.name))Object.assign(p,{mix:.30,inertia:.2,damping:.9,strength:60,limit:8});
 raw.skeleton.hash+='-seams1';fs.writeFileSync(root+'/hong.json',JSON.stringify(raw));
 const manifest=JSON.parse(fs.readFileSync(root+'/manifest.json'));manifest.connections={revision:1,pinned,skirt,rigidChest,hipRange:[-2,.5],skirtLegWeight:.45,hairBones:['head','bone2','cloak1','cloak2','cloak3'],headSource:'source-parts-1280.png cells 2/3/15; 4x direct source sampling'};manifest.hairFlutter=true;fs.writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('HONG_CONNECTIONS',weapon,{pinned,skirt,rigidChest});
}
execFileSync('python3',['scripts/rpg/connect-hong-native-textures.py',...weapons],{stdio:'inherit'});
