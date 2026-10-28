/** Same physics/update/ground sequence as the game, rendered offline for review. */
import fs from 'node:fs';import {createCanvas,loadImage}from '@napi-rs/canvas';import * as R from '@esotericsoftware/spine-canvas';
R.Skeleton.yDown=true;const dir=process.argv[2];if(!dir)throw Error('Pass a temporary frame output directory');fs.mkdirSync(dir,{recursive:true});
const actors=[];for(const weapon of ['axe','sword','dual','spear']){const root=`public/rpg/characters/hong/native-${weapon}`,atlas=new R.TextureAtlas(fs.readFileSync(root+'/hong.atlas','utf8'));for(const p of atlas.pages)p.setTexture(new R.CanvasTexture(await loadImage(root+'/'+p.name)));const data=new R.SkeletonJson(new R.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(root+'/hong.json'))),s=new R.Skeleton(data),state=new R.AnimationState(new R.AnimationStateData(data));state.data.defaultMix=.1;actors.push({weapon,s,state,clip:''});}
const sequence=[['stay1',24],['run1',24],['attack1',12],['attack2',12],['attack3',12],['attack4',12],['attack5',20],['skill1',20],['sliding2',16]];
for(let frame=0;frame<sequence.reduce((s,v)=>s+v[1],0);frame++){
 let cursor=frame;const clip=sequence.find(v=>{if(cursor<v[1])return true;cursor-=v[1];return false;})[0];
 const c=createCanvas(1120,310),ctx=c.getContext('2d');ctx.fillStyle='#243238';ctx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<actors.length;i++){const a=actors[i],s=a.s;ctx.fillStyle='#efdfb7';ctx.font='18px sans-serif';ctx.fillText(a.weapon.toUpperCase()+' / '+clip,i*280+12,25);if(a.clip!==clip){a.state.setAnimation(0,clip,/stay|run/.test(clip));a.clip=clip;}
  a.state.update(1/30);a.state.apply(s);s.x=i*280+140;s.y=280;s.scaleX=s.scaleY=2.1;s.update(1/30);s.updateWorldTransform(R.Physics.update);
  let bottom=-Infinity;for(const n of ['Rleg','Lleg2']){const slot=s.findSlot(n),mesh=slot.getAttachment();if(!mesh)continue;const v=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(slot,0,v.length,v,0,2);for(let j=1;j<v.length;j+=2)bottom=Math.max(bottom,v[j]);}s.y+=280-bottom;s.updateWorldTransform(R.Physics.pose);
  const renderer=new R.SkeletonRenderer(ctx);renderer.triangleRendering=true;renderer.draw(s);
 }
 fs.writeFileSync(dir+'/'+String(frame).padStart(4,'0')+'.png',c.toBuffer('image/png'));
}
console.log('CLOTH_PHYSICS_FRAMES_WRITTEN');
