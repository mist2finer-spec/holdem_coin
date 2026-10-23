// Optional local proof renderer: npm install --no-save --package-lock=false --legacy-peer-deps @napi-rs/canvas
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,SkeletonRenderer,TextureAtlas} from '@esotericsoftware/spine-canvas';
const roster=JSON.parse(fs.readFileSync('public/rpg/characters/roster.json','utf8'));
Skeleton.yDown=true;
const canvas=createCanvas(960,960),ctx=canvas.getContext('2d');ctx.fillStyle='#10272b';ctx.fillRect(0,0,960,960);
for(let i=0;i<roster.length;i++){
 const c=roster[i],folder=`archive/rpg/spine-characters/${c.id}`;
 if(!fs.existsSync(`${folder}/character.json`))continue;
 const atlas=new TextureAtlas(fs.readFileSync(`${folder}/character.atlas`,'utf8'));
 for(const page of atlas.pages)page.setTexture(new CanvasTexture(await loadImage(path.resolve(folder,page.name))));
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(`${folder}/character.json`,'utf8')));
 const skeleton=new Skeleton(data);skeleton.setSkin(data.skins[0]);skeleton.setSlotsToSetupPose();
 const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,process.argv[2]||'stay1',false);state.update(Number(process.argv[3]||.2));state.apply(skeleton);
 skeleton.x=(i%3)*320+150;skeleton.y=Math.floor(i/3)*320+240;skeleton.scaleX=skeleton.scaleY=1.25;skeleton.updateWorldTransform(Physics.update);
 const renderer=new SkeletonRenderer(ctx);renderer.draw(skeleton);
 ctx.fillStyle='#e7d5a5';ctx.font='14px sans-serif';ctx.fillText(c.id,(i%3)*320+35,Math.floor(i/3)*320+285);
 if((process.argv[2]||'stay1')==='stay1'){
  const single=createCanvas(256,256),singleCtx=single.getContext('2d');
  skeleton.x=128;skeleton.y=224;skeleton.scaleX=skeleton.scaleY=1.25;skeleton.updateWorldTransform(Physics.update);
  new SkeletonRenderer(singleCtx).draw(skeleton);fs.writeFileSync(`${folder}/preview.png`,single.toBuffer('image/png'));
 }
}
const out=process.argv[4]||'/workspace/scratch/e4f685f7b562/spine-rig-preview.png';fs.writeFileSync(out,canvas.toBuffer('image/png'));console.log(out);
