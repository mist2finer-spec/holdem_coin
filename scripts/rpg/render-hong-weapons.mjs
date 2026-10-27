/** Visual QA only; needs @napi-rs/canvas in addition to the app's Spine runtime. */
import fs from 'node:fs';import {createCanvas,loadImage} from '@napi-rs/canvas';
import {TextureAtlas,CanvasTexture,SkeletonJson,AtlasAttachmentLoader,Skeleton,AnimationState,AnimationStateData,Physics,SkeletonRenderer} from '@esotericsoftware/spine-canvas';
const root='public/rpg/characters/hong/spine/',out=process.argv[2]||'/tmp/hong-weapons-review.png';
const atlas=new TextureAtlas(fs.readFileSync(root+'hong.atlas','utf8'));for(const page of atlas.pages)page.setTexture(new CanvasTexture(await loadImage(root+page.name)));
const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(root+'hong.json')));Skeleton.yDown=true;
const canvas=createCanvas(1920,1680),ctx=canvas.getContext('2d');ctx.fillStyle='#12232a';ctx.fillRect(0,0,1920,1680);
for(const [row,type]of ['sword','axe','dual','spear'].entries())for(const [col,[action,time]]of [['stay1',.3],['attack1',.2],['run1',.2],['avoid1',.25]].entries()){
 ctx.save();ctx.translate(col*480,row*420);ctx.fillStyle='#1d3431';ctx.fillRect(0,362,480,58);ctx.strokeStyle='#62816e';ctx.beginPath();ctx.moveTo(0,362);ctx.lineTo(480,362);ctx.stroke();ctx.fillStyle='#ebdfb7';ctx.font='18px sans-serif';ctx.fillText(type+' / '+action,15,28);
 const sk=new Skeleton(data);sk.setSkinByName(type);sk.setSlotsToSetupPose();sk.findSlot('weapon-front').setAttachment(sk.getAttachmentByName('weapon-front','held-'+type));sk.findSlot('weapon-back').setAttachment(type==='dual'?sk.getAttachmentByName('weapon-back','held-dual'):null);
 const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,type+'-'+action,false);state.update(time);state.apply(sk);sk.x=220;sk.y=385;sk.scaleX=sk.scaleY=1.3;sk.updateWorldTransform(Physics.update);
 // Match production ground correction, excluding weapons from grounding.
 const slots=/avoid|die/.test(action)?sk.slots.filter(s=>s.getAttachment()&&!s.data.name.startsWith('weapon')).map(s=>s.data.name):['front-foot','back-foot'];let bottom=-Infinity;
 for(const n of slots){const slot=sk.findSlot(n),a=slot.getAttachment(),v=new Float32Array(8);a.computeWorldVertices(slot,v,0,2);for(let i=1;i<8;i+=2)bottom=Math.max(bottom,v[i]);}sk.y+=362-bottom;sk.updateWorldTransform(Physics.pose);ctx.imageSmoothingEnabled=false;new SkeletonRenderer(ctx).draw(sk);ctx.restore();
}
fs.writeFileSync(out,canvas.toBuffer('image/png'));console.log(out);
