import fs from 'node:fs';import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';R.Skeleton.yDown=true;
async function load(root,name,png){const a=new R.TextureAtlas(fs.readFileSync(root+'/'+name+'.atlas','utf8'));for(const p of a.pages)p.setTexture(new R.CanvasTexture(await loadImage(png??root+'/'+p.name)));return new R.SkeletonJson(new R.AtlasAttachmentLoader(a)).readSkeletonData(JSON.parse(fs.readFileSync(root+'/'+name+'.json')));}
const root='public/rpg/characters/hong/native-axe';const data=[await load('public/rpg','Hero_Axe01'),await load(root,'hong','archive/rpg/hong-axe-arm-orientation/before.png'),await load(root,'hong')];
const c=createCanvas(1000,900),ctx=c.getContext('2d');ctx.fillStyle='#34444b';ctx.fillRect(0,0,1000,900);
for(let row=0;row<3;row++)for(const [col,[name,t]]of [['attack1',.10],['attack1',.20],['attack2',.30]].entries()){
 const s=new R.Skeleton(data[row]);if(!row){const skin=new R.Skin('cat');for(const n of ['cos/cos15','weapon/grade7'])skin.addSkin(s.data.findSkin(n));s.setSkin(skin);s.setSlotsToSetupPose();}
 s.data.findAnimation(name).apply(s,0,t,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.x=col*330+160;s.y=row*300+260;s.scaleX=s.scaleY=2.1;s.updateWorldTransform(R.Physics.pose);const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';renderer.draw(s);
 ctx.fillStyle='#fff';ctx.font='15px sans-serif';ctx.fillText(['ORIGINAL CAT','HONG BEFORE','HONG ALIGNED'][row]+' / '+name+' '+t,col*330+10,row*300+25);
}
fs.writeFileSync('docs/rpg/hong-axe-arm-direction.png',c.toBuffer('image/png'));console.log('AXE_ARM_COMPARISON_WRITTEN');
