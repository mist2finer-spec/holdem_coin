import {WORLD_WIDTH} from './combat-rules';
/** Camera zoom is cosmetic; input, target ranges and damage stay in world units. */
export function huntViewport(width:number,heroX:number){
 const worldWidth=Math.min(WORLD_WIDTH,Math.max(900,width*1.25));
 const zoom=width/worldWidth;
 const camera=Math.max(0,Math.min(WORLD_WIDTH-worldWidth,heroX-worldWidth*.4));
 return {worldWidth,zoom,camera,screenX:(x:number)=>(x-camera)*zoom};
}
