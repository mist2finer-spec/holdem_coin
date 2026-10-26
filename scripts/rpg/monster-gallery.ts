/** Local reference viewer: original monster clips, no combat/pose generation. */
import {CanvasTexture,SkeletonRenderer} from '@esotericsoftware/spine-canvas';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,Physics,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-core';
type Asset={name:string;skeleton:string;atlas:string;pages:string[]};
const canvas=document.querySelector('canvas')!,context=canvas.getContext('2d')!,renderer=new SkeletonRenderer(context);
const select=document.querySelector<HTMLSelectElement>('#monster')!,clips=document.querySelector<HTMLSelectElement>('#clip')!,status=document.querySelector('#status')!;
let current:{skeleton:Skeleton;state:AnimationState;atlas:TextureAtlas;bounds:{x:number;y:number;width:number;height:number}}|null=null,generation=0;
let unsafe:{asset:string;clip:string}[]=[];
async function load(asset:Asset){
 const serial=++generation;status.textContent='불러오는 중…';
 const base=`monsters/${asset.name}/`;
 const [json,txt]=await Promise.all([fetch(base+asset.skeleton).then(r=>{if(!r.ok)throw Error('Skeleton missing');return r.json();}),fetch(base+asset.atlas).then(r=>r.text())]);
 const atlas=new TextureAtlas(txt);
 for(const page of atlas.pages){const img=new Image();img.src=base+page.name;await img.decode();page.setTexture(new CanvasTexture(img));}
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json),skeleton=new Skeleton(data);
 Skeleton.yDown=true;if(data.skins.length)skeleton.setSkin(data.skins[0]);skeleton.setSlotsToSetupPose();skeleton.updateWorldTransform(Physics.pose);
 const state=new AnimationState(new AnimationStateData(data));state.data.defaultMix=.12;
 const animations=data.animations.filter(a=>!unsafe.some(i=>i.asset===asset.name&&i.clip===a.name));
 const idle=animations.find(a=>/^(stay1|idle)$/i.test(a.name))??animations[0];if(idle){state.setAnimation(0,idle.name,true);state.apply(skeleton);skeleton.updateWorldTransform(Physics.pose);}
 if(serial!==generation){atlas.dispose();return;}
 current?.atlas.dispose();current={skeleton,state,atlas,bounds:skeleton.getBoundsRect()};
 clips.replaceChildren(...animations.map(a=>new Option(`${a.name} (${a.duration.toFixed(2)}s)`,a.name)));if(idle)clips.value=idle.name;
 status.textContent=`${asset.name} · ${animations.length}개 재생 후보 · 제외 ${data.animations.length-animations.length}개 · 에셋 확인용`;
}
let assets:Asset[]=[];
Promise.all([fetch('monster-assets.json').then(r=>r.json()),fetch('asset-verification.json').then(r=>{if(!r.ok)throw Error('검증 보고서가 필요합니다');return r.json();})]).then(([data,report])=>{unsafe=report.issues;assets=data;select.replaceChildren(...assets.map((a,i)=>new Option(a.name,String(i))));return load(assets[0]);}).catch(e=>{status.textContent=String(e);});
select.onchange=()=>void load(assets[Number(select.value)]).catch(e=>{status.textContent=String(e);});
clips.onchange=()=>{current?.state.setAnimation(0,clips.value,true);};
document.querySelector<HTMLButtonElement>('#replay')!.onclick=()=>{current?.state.setAnimation(0,clips.value,false);};
let last=0;
function draw(now:number){const dt=last?Math.min((now-last)/1000,.05):0;last=now;const w=canvas.width,h=canvas.height;context.clearRect(0,0,w,h);context.fillStyle='#101e27';context.fillRect(0,0,w,h);context.strokeStyle='#6f866e';context.beginPath();context.moveTo(0,h*.82);context.lineTo(w,h*.82);context.stroke();
 if(current){const {skeleton,state,bounds}=current;state.update(dt);state.apply(skeleton);skeleton.update(dt);skeleton.updateWorldTransform(Physics.update);
 const scale=Math.min((w*.7)/Math.max(1,bounds.width),(h*.65)/Math.max(1,bounds.height));context.save();context.translate(w/2,h*.82);context.scale(scale,scale);context.translate(-bounds.x-bounds.width/2,-bounds.y-bounds.height);renderer.draw(skeleton);context.restore();}
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
