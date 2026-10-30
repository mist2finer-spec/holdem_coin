/** Offline visual QA using the same world-to-screen map/foot alignment as HuntRenderer. */
import fs from 'node:fs';import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
import spriteModule from '../../src/components/rpg/combat-sprite.ts';
import layoutModule from '../../src/components/rpg/hunt-layout.ts';
const {COMBAT_SPRITE_SCALE}=spriteModule,{huntViewport,HUNT_ACTOR_RENDER_GAIN}=layoutModule;
const out=process.argv[2];if(!out)throw Error('Provide a temporary frame directory');fs.mkdirSync(out,{recursive:true});
const root='public/rpg/maps/candle-dungeon/',layout=JSON.parse(fs.readFileSync(root+'layout.json','utf8')),bg=await loadImage(root+layout.background),front=await loadImage(root+layout.foreground),fire=await loadImage(root+layout.flames[0].texture);
R.Skeleton.yDown=true;const heroRoot='public/rpg/characters/hong/native-axe/',atlas=new R.TextureAtlas(fs.readFileSync(heroRoot+'hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new R.CanvasTexture(await loadImage(heroRoot+p.name)));
const data=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(heroRoot+'hong.json','utf8'))),s=new R.Skeleton(data),state=new R.AnimationState(new R.AnimationStateData(data));state.setAnimation(0,'run1',true);
const w=480,h=420,{zoom}=huntViewport(w,620),floor=h*.84,scale=5200*zoom/(layout.endPixel-layout.startPixel);
for(let fi=0;fi<80;fi++){
 const elapsed=fi/20,hero=620+fi/79*3800,c=createCanvas(w,h),ctx=c.getContext('2d'),x=w/2-hero*zoom-layout.startPixel*scale,y=floor-layout.groundY*scale;ctx.fillStyle='#09080c';ctx.fillRect(0,0,w,h);ctx.drawImage(bg,x,y,layout.size[0]*scale,layout.size[1]*scale);
 ctx.save();ctx.globalCompositeOperation='lighter';layout.flames.forEach((f,i)=>{const frame=Math.floor((elapsed+i*.137)/Math.max(.1,f.duration)*16)%16,side=Math.max(6,Math.min(100,f.size*f.scale*layout.size[1]/14))*scale;ctx.drawImage(fire,frame%4*64,(3-Math.floor(frame/4))*64,64,64,x+f.pixel[0]*scale-side/2,y+f.pixel[1]*scale-side/2,side,side);});ctx.restore();
 state.update(1/20);state.apply(s);s.x=w/2;s.y=floor;s.scaleX=s.scaleY=COMBAT_SPRITE_SCALE*zoom*HUNT_ACTOR_RENDER_GAIN*1.75;s.update(1/20);s.updateWorldTransform(R.Physics.update);let bottom=-Infinity;
 for(const name of ['Rleg','Lleg2']){const slot=s.findSlot(name),a=slot?.getAttachment();if(!a)continue;const v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,v.length,v,0,2);for(let i=1;i<v.length;i+=2)bottom=Math.max(bottom,v[i]);}s.y+=floor-bottom;s.updateWorldTransform(R.Physics.pose);const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;renderer.draw(s);
 ctx.drawImage(front,x,y,layout.size[0]*scale,layout.size[1]*scale);ctx.fillStyle='#0d0b12dd';ctx.fillRect(0,0,w,36);ctx.fillStyle='#e8d3a8';ctx.font='15px sans-serif';ctx.fillText('Map002_001 / ORIGINAL MESH ASSEMBLY',14,23);
 fs.writeFileSync(out+'/'+String(fi).padStart(3,'0')+'.png',c.toBuffer('image/png'));
}console.log('DUNGEON_PREVIEW_FRAMES_WRITTEN');
