/** Synchronized immediate-before / updated previews, using the game's physics clock. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync}from 'node:child_process';
import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;
const fps=30,output='docs/rpg',baseline='archive/rpg/hong-native-thigh-tuning-v2';
async function actor(root,jsonPath){
 const atlas=new R.TextureAtlas(fs.readFileSync(root+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new R.CanvasTexture(await loadImage(root+'/'+p.name)));
 const data=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(jsonPath))),skeleton=new R.Skeleton(data),state=new R.AnimationState(new R.AnimationStateData(data));state.data.defaultMix=.1;
 return{data,skeleton,state,clip:''};
}
function draw(ctx,a,clip,x){
 if(a.clip!==clip){a.state.setAnimation(0,clip,/stay|run/.test(clip));a.clip=clip;}
 const s=a.skeleton;a.state.update(1/fps);a.state.apply(s);s.x=x;s.y=390;s.scaleX=s.scaleY=2.4;s.update(1/fps);s.updateWorldTransform(R.Physics.update);
 let bottom=-Infinity;for(const name of ['Rleg','Lleg2']){const slot=s.findSlot(name),mesh=slot.getAttachment();if(!mesh)continue;const v=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(slot,0,v.length,v,0,2);for(let i=1;i<v.length;i+=2)bottom=Math.max(bottom,v[i]);}
 if(!Number.isFinite(bottom))throw Error('Missing ground geometry');s.y+=390-bottom;s.updateWorldTransform(R.Physics.pose);
 const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';renderer.draw(s);
}
for(const weapon of ['axe','sword','dual','spear']){
 const root=`public/rpg/characters/hong/native-${weapon}`;
 const before=await actor(root,`${baseline}/${weapon}.json`),after=await actor(root,root+'/hong.json');
 const sequence=[['stay1',.9],['run1',.8],...['attack1','attack2','attack3','attack4','attack5','skill1','skill3'].map(n=>[n,after.data.findAnimation(n).duration+.10])];
 const frames=fs.mkdtempSync(path.join(os.tmpdir(),'hong-'+weapon+'-comparison-'));let frame=0;
 try{
  for(const [clip,duration]of sequence)for(let i=0;i<Math.ceil(duration*fps);i++){
   const c=createCanvas(1120,440),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,1120,440);ctx.font='bold 19px sans-serif';ctx.fillStyle='#efdfb7';ctx.fillText(weapon.toUpperCase()+' / PREVIOUS 1.20',18,26);ctx.fillText(weapon.toUpperCase()+' / UPDATED 1.08',578,26);ctx.font='14px sans-serif';ctx.fillStyle='#c3cece';ctx.fillText('SOURCE 4x / LINEAR / '+clip,18,49);ctx.fillText('SOURCE 4x / LINEAR / '+clip,578,49);ctx.strokeStyle='#546261';ctx.beginPath();ctx.moveTo(560,56);ctx.lineTo(560,430);ctx.moveTo(0,392);ctx.lineTo(1120,392);ctx.stroke();
   for(const [column,a]of [before,after].entries()){ctx.save();ctx.beginPath();ctx.rect(column*560,56,560,374);ctx.clip();draw(ctx,a,clip,column*560+280);ctx.restore();}
   fs.writeFileSync(path.join(frames,String(frame++).padStart(4,'0')+'.png'),c.toBuffer('image/png'));
   if(clip==='attack2'&&i===3)fs.copyFileSync(path.join(frames,String(frame-1).padStart(4,'0')+'.png'),path.join(output,`hong-native-hd-comparison-${weapon}.png`));
  }
  const dest=path.join(output,`hong-native-hd-comparison-${weapon}.gif`),result=spawnSync('ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',dest],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'ffmpeg failed');
  const bytes=fs.statSync(dest).size;if(bytes<10000)throw Error('Empty GIF');console.log('HONG_HD_COMPARISON',weapon,{frames:frame,bytes,destination:dest});
 }finally{fs.rmSync(frames,{recursive:true,force:true});}
}
