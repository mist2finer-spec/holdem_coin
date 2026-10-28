import fs from 'node:fs';import {createCanvas,loadImage} from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;const root='public/rpg/characters/hong/native-axe',json=JSON.parse(fs.readFileSync(root+'/hong.json'));
async function load(atlasFile,png){const a=new R.TextureAtlas(fs.readFileSync(atlasFile,'utf8'));for(const p of a.pages)p.setTexture(new R.CanvasTexture(await loadImage(png)));return new R.SkeletonJson(new R.AtlasAttachmentLoader(a)).readSkeletonData(json);}
const old=await load('archive/rpg/hong-native-hd-source/layout-1x.atlas','archive/rpg/hong-native-hd-source/atlas-1x.png'),hd=await load(root+'/hong.atlas',root+'/hong.png');
function draw(ctx,data,clip,t,x,y,scale,smooth){const s=new R.Skeleton(data);data.findAnimation(clip).apply(s,0,t,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.x=x;s.y=y;s.scaleX=s.scaleY=scale;s.updateWorldTransform(R.Physics.pose);const r=new R.SkeletonRenderer(ctx);r.triangleRendering=true;ctx.save();ctx.imageSmoothingEnabled=smooth;ctx.imageSmoothingQuality='high';r.draw(s);ctx.restore();}
const c=createCanvas(1080,600),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,1080,600);
for(const [i,label]of ['PREVIOUS 1x / NEAREST','SOURCE 4x / NEAREST','SOURCE 4x / LINEAR'].entries()){
 ctx.fillStyle='#eeddbc';ctx.font='17px sans-serif';ctx.fillText(label,18+i*360,30);
 const data=i?hd:old;for(const [j,[clip,t]]of [['stay1',0],['attack1',.22]].entries())draw(ctx,data,clip,t,80+i*360+j*170,365,2.4,i===2);
 ctx.fillStyle='#b7c5c6';ctx.font='14px sans-serif';ctx.fillText('Mobile-scale motion samples',18+i*360,415);
 for(const [j,[clip,t]]of [['stay1',0],['run1',.1],['attack2',.25]].entries())draw(ctx,data,clip,t,70+i*360+j*105,560,.85,i===2);
}
fs.writeFileSync('docs/rpg/hong-native-hd-comparison.png',c.toBuffer('image/png'));
console.log('HD_FILTER_COMPARISON_WRITTEN');
