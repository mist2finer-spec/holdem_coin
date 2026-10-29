/** Axe-only authoring sample: runtime assets are read-only. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync}from 'node:child_process';
import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;
const root='public/rpg/characters/hong/native-axe',sample='docs/rpg/samples/hong-axe-calf',fps=30;
const production=['axe','sword','dual','spear'].flatMap(w=>['json','png','atlas'].map(ext=>`public/rpg/characters/hong/native-${w}/hong.${ext}`));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),fingerprints=production.map(sha);
const original=JSON.parse(fs.readFileSync(root+'/hong.json')),raw=structuredClone(original),shin=new Set(['Rleg2','Lleg2'].map(n=>raw.bones.findIndex(b=>b.name===n))),ratio=1.04/1.24;
let changed=0;
for(const slot of ['Rleg','Lleg2'])for(const [name,a] of Object.entries(raw.skins[0].attachments[slot])){
 const before=original.skins[0].attachments[slot][name];
 let i=0;while(i<a.vertices.length){const n=a.vertices[i++];for(let j=0;j<n;j++){if(shin.has(a.vertices[i])){a.vertices[i+2]*=ratio;changed++;}i+=4;}}
 // Every other vertex component, influence, and UV stays byte-numerically identical.
 let p=0;while(p<a.vertices.length){const n=a.vertices[p++];for(let j=0;j<n;j++){for(let k=0;k<4;k++)if(k!==2||!shin.has(a.vertices[p]))assert.equal(a.vertices[p+k],before.vertices[p+k]);p+=4;}}
}
raw.skeleton.hash+='-calf-sample1';fs.mkdirSync(sample,{recursive:true});fs.writeFileSync(sample+'/hong.json',JSON.stringify(raw));for(const ext of ['atlas','png'])fs.copyFileSync(root+'/hong.'+ext,sample+'/hong.'+ext);
fs.writeFileSync(sample+'/manifest.json',JSON.stringify({sampleOnly:true,sourceRevision:'d863179',weapon:'axe',thighGain:1.08,previousShinGain:1.24,sampleShinGain:1.04,relativeReduction:1-ratio,changedInfluences:changed,footAndKneeLengthsUnchanged:true,textureUnchanged:true},null,2)+'\n');
async function actor(folder){const atlas=new R.TextureAtlas(fs.readFileSync(folder+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new R.CanvasTexture(await loadImage(folder+'/'+p.name)));const data=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(folder+'/hong.json'))),s=new R.Skeleton(data),state=new R.AnimationState(new R.AnimationStateData(data));state.data.defaultMix=.1;return{data,s,state,clip:''};}
const before=await actor(root),after=await actor(sample);
// Validate the sample through every native clip and both facing directions.
for(const clip of after.data.animations)for(const facing of [-1,1])for(let f=0;f<=30;f++){
 const s=new R.Skeleton(after.data);clip.apply(s,0,clip.duration*f/30,false,[],1,R.MixBlend.replace,R.MixDirection.mixIn);s.scaleX=facing;s.updateWorldTransform(R.Physics.pose);assert.ok(s.bones.every(b=>[b.a,b.b,b.c,b.d,b.worldX,b.worldY].every(Number.isFinite)));
 for(const slot of s.slots){const a=slot.getAttachment();if(!a?.worldVerticesLength)continue;const v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,v.length,v,0,2);assert.ok([...v].every(Number.isFinite));}
}
function draw(ctx,a,clip,x){if(a.clip!==clip){a.state.setAnimation(0,clip,/stay|run/.test(clip));a.clip=clip;}const s=a.s;a.state.update(1/fps);a.state.apply(s);s.x=x;s.y=390;s.scaleX=s.scaleY=2.4;s.update(1/fps);s.updateWorldTransform(R.Physics.update);let bottom=-Infinity;for(const n of ['Rleg','Lleg2']){const slot=s.findSlot(n),m=slot.getAttachment();if(!m)continue;const v=new Float32Array(m.worldVerticesLength);m.computeWorldVertices(slot,0,v.length,v,0,2);for(let i=1;i<v.length;i+=2)bottom=Math.max(bottom,v[i]);}assert.ok(Number.isFinite(bottom));s.y+=390-bottom;s.updateWorldTransform(R.Physics.pose);const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';renderer.draw(s);}
const sequence=[['stay1',.9],['run1',.8],...['attack1','attack2','attack3','attack4','attack5','skill1','skill3'].map(n=>[n,after.data.findAnimation(n).duration+.10])],frames=fs.mkdtempSync(path.join(os.tmpdir(),'hong-axe-calf-'));let frame=0;
try{
 for(const [clip,duration]of sequence)for(let i=0;i<Math.ceil(duration*fps);i++){
  const c=createCanvas(1120,440),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,1120,440);ctx.fillStyle='#efdfb7';ctx.font='bold 19px sans-serif';ctx.fillText('AXE / CURRENT CALF 1.24',18,26);ctx.fillText('AXE / SAMPLE CALF 1.04',578,26);ctx.fillStyle='#c3cece';ctx.font='14px sans-serif';for(const x of [18,578])ctx.fillText('THIGH UNCHANGED 1.08 / '+clip,x,49);ctx.strokeStyle='#546261';ctx.beginPath();ctx.moveTo(560,56);ctx.lineTo(560,430);ctx.moveTo(0,392);ctx.lineTo(1120,392);ctx.stroke();
  for(const [column,a]of [before,after].entries()){ctx.save();ctx.beginPath();ctx.rect(column*560,56,560,374);ctx.clip();draw(ctx,a,clip,column*560+280);ctx.restore();}
  const file=path.join(frames,String(frame++).padStart(4,'0')+'.png');fs.writeFileSync(file,c.toBuffer('image/png'));if((clip==='stay1'&&i===10)||(clip==='attack2'&&i===3))fs.copyFileSync(file,sample+'/'+clip+'.png');
 }
 const gif='docs/rpg/hong-native-hd-comparison-axe-calf-sample.gif',r=spawnSync('ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',gif],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 assert.deepEqual(production.map(sha),fingerprints,'Production assets changed');console.log('AXE_CALF_SAMPLE_VERIFIED',{changed,clips:after.data.animations.length,frames:frame,gif,productionUnchanged:true});
}finally{fs.rmSync(frames,{recursive:true,force:true});}
