import type {SceneryStyle} from './map';

/** Visual depth only. Actors keep the existing center-lane foot/collision anchor. */
export const FLOOR_SURFACE={back:52,front:52,bevel:12,tileWidth:72,tileDepth:24} as const;
const palettes:Record<SceneryStyle,readonly string[]>={
 crypt:['#34373c','#383a3e','#303338','#3b3d40'],
 moss:['#303a35','#343d37','#2e3632','#39413a'],
 prison:['#2c333e','#303846','#29313c','#353b47'],
 cathedral:['#3d3935','#413d38','#353430','#45403a'],
};

/** World-anchored diamond paving: camera movement never re-seeds the tile pattern. */
export function drawDungeonFloor(ctx:CanvasRenderingContext2D,style:SceneryStyle,left:number,right:number,footY:number,zoom:number,viewportWidth:number,viewportHeight:number){
 const back=footY-FLOOR_SURFACE.back*zoom,front=Math.max(footY+FLOOR_SURFACE.front*zoom,viewportHeight+1);
 const tw=FLOOR_SURFACE.tileWidth*zoom,th=FLOOR_SURFACE.tileDepth*zoom;
 const x0=Math.max(left,-tw),x1=Math.min(right,viewportWidth+tw);
 if(x1<=x0)return;
 ctx.save();ctx.beginPath();ctx.rect(left,back,right-left,front-back);ctx.clip();
 ctx.fillStyle='#151d22';ctx.fillRect(x0,back,x1-x0,front-back);
 const palette=palettes[style],rows=Math.ceil((front-back)/(th/2))+1;
 for(let row=-1;row<=rows;row++){
  const cy=back+row*th/2,offset=(row&1)*tw/2;
  const first=Math.floor((x0-left-offset)/tw)-1,last=Math.ceil((x1-left-offset)/tw)+1;
  for(let column=first;column<=last;column++){
   const cx=left+column*tw+offset;
   const key=(Math.imul(column,73856093)^Math.imul(row,19349663))>>>0;
   ctx.fillStyle=palette[key%palette.length];ctx.strokeStyle='#10181dcc';ctx.lineWidth=Math.max(.65,1.3*zoom);
   ctx.beginPath();ctx.moveTo(cx,cy-th/2);ctx.lineTo(cx+tw/2,cy);ctx.lineTo(cx,cy+th/2);ctx.lineTo(cx-tw/2,cy);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.strokeStyle='#c2c1ad16';ctx.lineWidth=Math.max(.4,.7*zoom);
   ctx.beginPath();ctx.moveTo(cx-tw/2+2*zoom,cy);ctx.lineTo(cx,cy-th/2+1.5*zoom);ctx.lineTo(cx+tw/2-2*zoom,cy);ctx.stroke();
   if(key%9===0){ctx.strokeStyle='#111a1e88';ctx.beginPath();ctx.moveTo(cx-8*zoom,cy-2*zoom);ctx.lineTo(cx+3*zoom,cy+2*zoom);ctx.lineTo(cx+8*zoom,cy+th/2-2*zoom);ctx.stroke();}
  }
 }
 const depth=ctx.createLinearGradient(0,back,0,front);depth.addColorStop(0,'#02070c99');depth.addColorStop(.4,'#060b120d');depth.addColorStop(1,'#050b1838');ctx.fillStyle=depth;ctx.fillRect(x0,back,x1-x0,front-back);
 ctx.restore();
 // A short stone side face, rather than the former bright one-pixel ground line.
 const side=ctx.createLinearGradient(0,front,0,front+FLOOR_SURFACE.bevel*zoom);side.addColorStop(0,'#333636');side.addColorStop(.28,'#171e24');side.addColorStop(1,'#070d13');ctx.fillStyle=side;ctx.fillRect(Math.max(0,left),front,Math.max(0,Math.min(viewportWidth,right)-Math.max(0,left)),FLOOR_SURFACE.bevel*zoom);
 ctx.fillStyle='#b2b4a52c';ctx.fillRect(Math.max(0,left),front,Math.max(0,Math.min(viewportWidth,right)-Math.max(0,left)),1.2*zoom);
}
