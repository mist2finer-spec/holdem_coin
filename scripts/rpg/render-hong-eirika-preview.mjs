import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import * as R from '@esotericsoftware/spine-canvas';
const root='public/rpg/characters/hong/spine/',out=process.argv[2];
if(!out)throw Error('Supply a preview output directory');
fs.mkdirSync(out,{recursive:true});
const atlas=new R.TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));
for(const p of atlas.pages)p.setTexture(new R.CanvasTexture(await loadImage(root+p.name)));
const data=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(root+'hong.json')));
R.Skeleton.yDown=true;
function draw(ctx,name,t,x){
 const s=new R.Skeleton(data);s.setSkinByName('sword');s.setSlotsToSetupPose();const a=data.findAnimation(name);
 a.apply(s,0,Math.min(a.duration,t),false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);
 s.x=x;s.y=288;s.scaleX=s.scaleY=1.65;s.updateWorldTransform(R.Physics.pose);
 let bottom=-Infinity;for(const name of ['near-foot','far-foot']){const slot=s.findSlot(name),a=slot.getAttachment(),v=[];a.computeWorldVertices(slot,v,0,2);for(let i=1;i<v.length;i+=2)bottom=Math.max(bottom,v[i]);}
 s.y+=292-bottom;s.updateWorldTransform(R.Physics.pose);new R.SkeletonRenderer(ctx).draw(s);
}
const attacks=Array.from({length:4},(_,i)=>data.findAnimation('sword-attack'+(i+1))),comboDuration=attacks.reduce((v,a)=>v+a.duration,0);
for(let frame=0;frame<360;frame++){
 const t=frame/60,c=createCanvas(1080,360),ctx=c.getContext('2d');ctx.fillStyle='#142a30';ctx.fillRect(0,0,1080,360);ctx.fillStyle='#344536';ctx.fillRect(0,292,1080,68);
 let age=t%comboDuration,stage=1;while(stage<4&&age>attacks[stage-1].duration){age-=attacks[stage-1].duration;stage++;}
 const moving=t%3<1.2,name=moving?'sword-run1':'sword-skill1',other=moving?(t%1.2)%data.findAnimation(name).duration:Math.min(data.findAnimation(name).duration,(t%3-1.2));
 const panels=[['SWORD IDLE / EIRIKA','sword-stay1',t%2],['SWORD COMBO / HIT '+stage,'sword-attack'+stage,age],[moving?'REAR CARRY / RUN':'FREE-HAND CAST',name,other]];
 for(let i=0;i<panels.length;i++){
  const [label,clip,time]=panels[i];ctx.font='bold 16px sans-serif';ctx.fillStyle='#eedab0';ctx.fillText(label,i*360+14,27);draw(ctx,clip,time,i*360+180);
 }
 fs.writeFileSync(out+'/'+String(frame).padStart(4,'0')+'.png',c.toBuffer('image/png'));
}
console.log('EIRIKA_HONG_PREVIEW',out);
