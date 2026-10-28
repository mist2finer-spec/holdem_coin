import * as R from '@esotericsoftware/spine-canvas';
/** Shared bind-pose correction; native weapon-specific bones and timelines survive. */
export function fitHongNativeGeometry(raw){
const original=structuredClone(raw);
function data(r){return new R.SkeletonJson({newMeshAttachment:(skin,name)=>new R.MeshAttachment(name),newRegionAttachment:(skin,name)=>new R.RegionAttachment(name),newBoundingBoxAttachment:()=>null,newPathAttachment:()=>null,newPointAttachment:()=>null,newClippingAttachment:()=>null}).readSkeletonData({...r,skins:[],animations:{}});}
R.Skeleton.yDown=false;const oldSk=new R.Skeleton(data(original));oldSk.updateWorldTransform(R.Physics.pose);
const bone=n=>raw.bones.find(b=>b.name===n);
bone('center').y=34;for(const n of ['Rleg','Lleg','Rleg2','Lleg2'])bone(n).length=15;
for(const n of ['Rleg2','Lleg2','Lleg3'])bone(n).x=15;bone('Rleg3').x=15.5;
for(const n of ['Rleg3','Lleg3'])bone(n).length*=1.22;
bone('Larm').y=8;bone('LShoulder').y=8;bone('Rarm').y=-3.5;
const newSk=new R.Skeleton(data(raw));newSk.updateWorldTransform(R.Physics.pose);
const skin=raw.skins[0].attachments,legBones=new Set([8,9,10,11,23,24]),notes={skirtVertices:0,maxCombinedLegWeight:0};
function decode(v){const rows=[];let i=0;while(i<v.length){const n=v[i++],r=[];for(let j=0;j<n;j++){r.push({bone:v[i],x:v[i+1],y:v[i+2],w:v[i+3]});i+=4;}rows.push(r);}return rows;}
const encode=rows=>rows.flatMap(r=>[r.length,...r.flatMap(v=>[v.bone,v.x,v.y,v.w])]);
for(const [slot,atts]of Object.entries(skin))for(const a of Object.values(atts)){
 if(a.type!=='mesh'||a.vertices.length===a.uvs.length)continue;
 const rows=decode(a.vertices);
 if(slot==='body'){
  for(let i=0;i<rows.length;i++){
   const row=rows[i],p={x:0,y:0};for(const v of row){const b=oldSk.bones[v.bone];p.x+=(b.a*v.x+b.b*v.y+b.worldX)*v.w;p.y+=(b.c*v.x+b.d*v.y+b.worldY)*v.w;}
   const t=Math.max(0,Math.min(1,(a.uvs[i*2+1]-.40)/.60)),lift=7*t*t*(3-2*t),b=oldSk.findBone('bone2'),length=Math.hypot(b.a,b.c);p.x+=b.a/length*lift;p.y+=5.14+b.c/length*lift;
   const weights=new Map(row.map(v=>[v.bone,v.w])),leg=[8,10].reduce((n,b)=>n+(weights.get(b)||0),0),cap=Math.min(.2499,leg),released=leg-cap;
   if(leg)for(const b of [8,10])if(weights.has(b))weights.set(b,weights.get(b)*cap/leg);
   weights.set(1,(weights.get(1)||0)+released*.75);weights.set(2,(weights.get(2)||0)+released*.25);
   const total=[...weights.values()].reduce((n,w)=>n+w,0);rows[i]=[...weights].filter(([,w])=>w>1e-8).map(([bone,w])=>{const local=newSk.bones[bone].worldToLocal({...p});return{bone,x:local.x,y:local.y,w:w/total};});
   notes.maxCombinedLegWeight=Math.max(notes.maxCombinedLegWeight,rows[i].filter(v=>[8,10].includes(v.bone)).reduce((n,v)=>n+v.w,0));if(lift>0)notes.skirtVertices++;
  }
 }else if(['Lleg2','Rleg'].includes(slot))for(const row of rows)for(const v of row)if(legBones.has(v.bone))v.x*=1.22;
 a.vertices=encode(rows);
}
return {raw,notes};
}
