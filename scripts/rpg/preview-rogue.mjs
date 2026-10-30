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
 const room=game.map.rooms[3];game.hero.x=room.center.x;game.hero.y=room.center.y;game.visited.add(3);
 for(let i=0;i<120;i++)renderer.draw(game.view(),1/60);
 fs.writeFileSync(output+'/encounter.png',canvas.toBuffer('image/png'));
 const c=createCanvas(920,680),ctx=c.getContext('2d');ctx.fillStyle='#080d10';ctx.fillRect(0,0,920,680);
 for(let y=0;y<game.map.height;y++)for(let x=0;x<game.map.width;x++)if(game.map.tiles[y*game.map.width+x]===0){ctx.fillStyle='#716755';ctx.fillRect(x*10,y*10,10,10);}
 ctx.textAlign='center';ctx.font='bold 16px sans-serif';
 for(const r of game.map.rooms){ctx.fillStyle=r.id===0?'#97ccb1':'#d9c488';ctx.fillText(String(r.id+1),r.center.x/48*10,r.center.y/48*10+5);}
 for(const m of game.mobs){ctx.fillStyle=m.boss?'#f7c155':'#cb756b';ctx.beginPath();ctx.arc(m.x/48*10,m.y/48*10,m.boss?4:2,0,Math.PI*2);ctx.fill();}
 fs.writeFileSync(output+'/overview.png',c.toBuffer('image/png'));renderer.dispose();console.log('ROGUE_VISUAL_QA_READY',canvas.dataset);
}finally{globalThis.fetch=nativeFetch;}
