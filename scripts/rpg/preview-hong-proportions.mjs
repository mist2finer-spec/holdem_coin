import fs from 'node:fs';import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;
async function load(root,name,jsonName=name){const a=new R.TextureAtlas(fs.readFileSync(root+'/'+name+'.atlas','utf8'));for(const p of a.pages)p.setTexture(new R.CanvasTexture(await loadImage(root+'/'+p.name)));return new R.SkeletonJson(new R.AtlasAttachmentLoader(a)).readSkeletonData(JSON.parse(fs.readFileSync(root+'/'+jsonName+'.json')));}
const before=await load('archive/rpg/hong-native-proportions-v1','hong','axe'),after=await load('public/rpg/characters/hong/native-axe','hong');
const poses=[['stay1',0],['run1',.15],['attack2',.10],['attack2',.22],['skill1',.25],['skill3',.85]];
function draw(ctx,data,clip,t,x,y){const s=new R.Skeleton(data);data.findAnimation(clip).apply(s,0,t,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.x=x;s.y=y;s.scaleX=s.scaleY=2.3;s.updateWorldTransform(R.Physics.pose);const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;renderer.draw(s);}
const c=createCanvas(1440,620),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#efdfb7';ctx.font='20px sans-serif';ctx.fillText('BEFORE / CONNECTIONS v1',12,28);ctx.fillText('PROPORTIONS / THICKER LEGS + SLIMMER ARMS',12,338);
for(let i=0;i<poses.length;i++){const [clip,t]=poses[i];ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(`${clip} / ${t}s`,i*240+12,55);draw(ctx,before,clip,t,i*240+120,230);draw(ctx,after,clip,t,i*240+120,540);}
fs.writeFileSync('docs/rpg/hong-proportions.png',c.toBuffer('image/png'));console.log('CONNECTION_PREVIEW_WRITTEN');
