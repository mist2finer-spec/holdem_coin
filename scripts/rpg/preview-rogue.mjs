/** Offline visual QA: render the production Canvas renderer with original textures/Spine rigs. */
import fs from 'node:fs';import path from 'node:path';import {createCanvas,Image} from '@napi-rs/canvas';
import engineModule from '../../src/components/rpg/rogue/engine.ts';
import renderModule from '../../src/components/rpg/rogue/renderer.ts';
const {RogueEngine}=engineModule,{createRogueRenderer}=renderModule;
const root=process.cwd(),nativeFetch=globalThis.fetch;
class LocalImage extends Image{set src(value){super.src=value?path.join(root,'public',value):'';}get src(){return super.src;}}
globalThis.Image=LocalImage;globalThis.devicePixelRatio=1;
globalThis.fetch=async(url)=>new Response(fs.readFileSync(path.join(root,'public',String(url))));
const output=process.argv[2]||'public/rpg/maps/rogue-test';fs.mkdirSync(output,{recursive:true});
try{
 const game=new RogueEngine(33129),canvas=createCanvas(400,350);canvas.clientWidth=400;canvas.clientHeight=350;canvas.dataset={};
 const renderer=await createRogueRenderer(canvas,game.map,new AbortController().signal);
 for(let i=0;i<12;i++)renderer.draw(game.view(),1/60);
 fs.writeFileSync(output+'/entrance.png',canvas.toBuffer('image/png'));
 // Drive the real server engine; do not synthesize impossible room/monster snapshots.
 let foundJump=false,foundSlide=false;
 for(let i=0;i<12000&&(!foundJump||!foundSlide);i++){
  game.step(.02,{x:0,y:0,auto:true});const view=game.view();
  if(view.phase==='traversing'&&((view.gate?.kind==='jump'&&!foundJump)||(view.gate?.kind==='slide'&&!foundSlide))){
   const kind=view.gate.kind;
   for(let j=0;j<120;j++)renderer.draw(view,1/60);
   fs.writeFileSync(output+'/'+kind+'-passage.png',canvas.toBuffer('image/png'));
   if(kind==='jump')foundJump=true;else foundSlide=true;
  }
 }
 const c=createCanvas(1200,200),ctx=c.getContext('2d'),scale=Math.min(1200/game.map.width,200/game.map.height);ctx.fillStyle='#080d10';ctx.fillRect(0,0,1200,200);
 for(let y=0;y<game.map.height;y++)for(let x=0;x<game.map.width;x++)if(game.map.tiles[y*game.map.width+x]===0){ctx.fillStyle='#716755';ctx.fillRect(x*scale,y*scale,scale,scale);}
 ctx.textAlign='center';ctx.font='bold 16px sans-serif';
 for(const r of game.map.rooms){ctx.fillStyle='#d9c488';ctx.fillText(String(r.id+1),r.center.x/48*scale,r.center.y/48*scale+5);}
 for(const g of game.map.gates){ctx.fillStyle=g.kind==='jump'?'#8cceeb':'#efcc83';ctx.fillText(g.kind==='jump'?'J':'S',(g.from.x+g.to.x)/2/48*scale,g.from.y/48*scale+5);}
 fs.writeFileSync(output+'/overview.png',c.toBuffer('image/png'));renderer.dispose();console.log('ROGUE_VISUAL_QA_READY',canvas.dataset);
}finally{globalThis.fetch=nativeFetch;}
