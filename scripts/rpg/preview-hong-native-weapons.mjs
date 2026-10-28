import fs from 'node:fs';import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;const weapons=['sword','axe','dual','spear'];
async function load(root,name){const a=new R.TextureAtlas(fs.readFileSync(root+'/'+name+'.atlas','utf8'));for(const p of a.pages)p.setTexture(new R.CanvasTexture(await loadImage(root+'/'+p.name)));return new R.SkeletonJson(new R.AtlasAttachmentLoader(a)).readSkeletonData(JSON.parse(fs.readFileSync(root+'/'+name+'.json')));}
const hong=await Promise.all(weapons.map(w=>load('public/rpg/characters/hong/native-'+w,'hong')));
function draw(ctx,data,clip,t,x,floor,scale){const s=new R.Skeleton(data);data.findAnimation(clip).apply(s,0,t,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.x=x;s.y=floor;s.scaleX=s.scaleY=scale;s.updateWorldTransform(R.Physics.pose);let bottom=-Infinity;for(const n of ['Rleg','Lleg2']){const slot=s.findSlot(n),a=slot.getAttachment();if(!a)continue;const v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,v.length,v,0,2);for(let i=1;i<v.length;i+=2)bottom=Math.max(bottom,v[i]);}s.y+=floor-bottom;s.updateWorldTransform(R.Physics.pose);const r=new R.SkeletonRenderer(ctx);r.triangleRendering=true;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';r.draw(s);}
const out=process.argv[2];if(out)fs.mkdirSync(out,{recursive:true});
for(let frame=0;frame<(out?150:1);frame++){
 const c=createCanvas(1120,590),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,1120,590);
 for(let i=0;i<4;i++){ctx.fillStyle='#eeddbc';ctx.font='bold 20px sans-serif';ctx.fillText(weapons[i].toUpperCase()+' / NATIVE CAT',i*280+15,30);draw(ctx,hong[i],'stay1',frame/30%hong[i].findAnimation('stay1').duration,i*280+140,275,2.1);
 const stage=Math.floor(frame/30)%5+1,clip='attack'+stage,animation=hong[i].findAnimation(clip),age=out?(frame%30)/30*animation.duration:.2;draw(ctx,hong[i],clip,age,i*280+140,550,2.1);ctx.fillStyle='#eeddbc';ctx.font='16px sans-serif';ctx.fillText('ATTACK '+stage,i*280+15,325);}
 fs.writeFileSync(out?out+'/'+String(frame).padStart(4,'0')+'.png':'docs/rpg/hong-native-four-weapons.png',c.toBuffer('image/png'));
}
console.log('NATIVE_WEAPON_PREVIEW_WRITTEN');
