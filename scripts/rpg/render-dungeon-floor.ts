import {createCanvas,loadImage} from '@napi-rs/canvas';
import {writeFileSync} from 'node:fs';
import {generateRogueMap,type SceneryStyle} from '../../src/components/rpg/rogue/map';
import {drawModularScenery} from '../../src/components/rpg/rogue/scenery';

async function main(){
 const image=await loadImage('public/rpg/maps/modular-dungeon/atlas-v1.png');
 const result=createCanvas(960,720),ctx=result.getContext('2d');ctx.fillStyle='#0b151d';ctx.fillRect(0,0,960,720);
 const styles:SceneryStyle[]=['crypt','moss','prison','cathedral'];
 for(const [i,style] of styles.entries()){
  const map=generateRogueMap(77),room=map.rooms[0];room.scenery=style;
  const panel=createCanvas(472,320),c=panel.getContext('2d'),zoom=472/640,hx=room.center.x;
  drawModularScenery(c as unknown as CanvasRenderingContext2D,image as unknown as CanvasImageSource,map,0,[],1,{width:472,height:320,zoom,sx:x=>(x-hx)*zoom+236,sy:(y,z=0)=>235+(y-map.start.y)*zoom*.72-z*zoom});
  const x=i%2*480+4,y=Math.floor(i/2)*360+30;ctx.drawImage(panel,x,y);ctx.fillStyle='#e5d6b4';ctx.font='14px sans-serif';ctx.fillText(style,x+12,y-10);
 }
 const out=process.argv[2]??'/tmp/rpg-diamond-floor-preview.png';writeFileSync(out,result.toBuffer('image/png'));console.log(out);
}
void main();
