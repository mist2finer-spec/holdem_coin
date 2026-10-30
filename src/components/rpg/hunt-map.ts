export type HuntMapId='forest'|'candle-dungeon'|'rogue-dungeon';
export const HUNT_MAPS=[{id:'rogue-dungeon' as const,label:'10개 방 · 로그라이크 테스트'},{id:'forest' as const,label:'시작의 숲'},{id:'candle-dungeon' as const,label:'촛불 지하 회랑 · 복원 테스트'}];
export type DungeonLayout={size:[number,number];groundY:number;startPixel:number;endPixel:number;image:string;background:string;foreground:string;flames:{pixel:number[];texture:string;tilesX:number;tilesY:number;duration:number;size:number;scale:number}[]};
export function dungeonPlacement(layout:DungeonLayout,floor:number,zoom:number,worldWidth:number,screenX:(x:number)=>number){
 const span=layout.endPixel-layout.startPixel;
 if(!Number.isFinite(span)||span<=0||!Number.isFinite(zoom)||zoom<=0)throw Error('Invalid dungeon projection');
 const scale=worldWidth*zoom/span;
 return {x:screenX(0)-layout.startPixel*scale,y:floor-layout.groundY*scale,width:layout.size[0]*scale,height:layout.size[1]*scale,scale};
}
export async function loadDungeonMap(signal:AbortSignal,loadImage:(url:string,signal:AbortSignal)=>Promise<HTMLImageElement>){
 const root='/rpg/maps/candle-dungeon/';const response=await fetch(root+'layout.json',{signal});if(!response.ok)throw Error('던전 배치 데이터를 읽지 못했습니다.');const layout=await response.json() as DungeonLayout;
 dungeonPlacement(layout,0,1,1,x=>x);
 const occluder=document.createElement('canvas'),mask=occluder.getContext('2d')!;
 const [background,foreground]=await Promise.all([loadImage(root+layout.background,signal),loadImage(root+layout.foreground,signal)]);const flames=new Map<string,HTMLImageElement>();
 await Promise.all([...new Set(layout.flames.map(f=>f.texture))].map(async file=>{flames.set(file,await loadImage(root+file,signal));}));
 return {draw(ctx:CanvasRenderingContext2D,width:number,height:number,floor:number,zoom:number,worldWidth:number,screenX:(x:number)=>number,elapsed:number){
  const p=dungeonPlacement(layout,floor,zoom,worldWidth,screenX);ctx.fillStyle='#09080c';ctx.fillRect(0,0,width,height);ctx.drawImage(background,p.x,p.y,p.width,p.height);
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const [i,f] of layout.flames.entries()){
   const texture=flames.get(f.texture)!;const frame=Math.floor((Math.max(0,elapsed)+i*.137)/Math.max(.1,f.duration)*f.tilesX*f.tilesY)%(f.tilesX*f.tilesY);
   const x=p.x+f.pixel[0]*p.scale,y=p.y+f.pixel[1]*p.scale;const side=Math.max(6,Math.min(100,f.size*f.scale*layout.size[1]/14))*p.scale;
   if(x+side<0||x-side>width)continue;const sw=texture.width/f.tilesX,sh=texture.height/f.tilesY;
   // Unity flipbook rows start at the lower texture row. World placement comes from the real particle Transform.
   ctx.drawImage(texture,(frame%f.tilesX)*sw,(f.tilesY-1-Math.floor(frame/f.tilesX))*sh,sw,sh,x-side/2,y-side/2,side,side);
  }ctx.restore();
 },drawForeground(ctx:CanvasRenderingContext2D,floor:number,zoom:number,worldWidth:number,screenX:(x:number)=>number,width:number,height:number,actors:{x:number;y:number;radius:number}[]){
  const p=dungeonPlacement(layout,floor,zoom,worldWidth,screenX);
  if(occluder.width!==Math.ceil(width)||occluder.height!==Math.ceil(height)){occluder.width=Math.ceil(width);occluder.height=Math.ceil(height);}
  mask.clearRect(0,0,width,height);mask.globalCompositeOperation='source-over';mask.drawImage(foreground,p.x,p.y,p.width,p.height);
  // Original foreground depth is preserved except for soft visibility windows around actors.
  // A 2D projection cannot correctly depth-test a moving actor against every 3D pillar.
  mask.globalCompositeOperation='destination-out';
  for(const actor of actors){const r=actor.radius*zoom,x=screenX(actor.x),y=actor.y;if(x+r<0||x-r>width)continue;
   const gradient=mask.createRadialGradient(x,y,r*.6,x,y,r);gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');mask.fillStyle=gradient;mask.fillRect(x-r,y-r,r*2,r*2);
  }
  mask.globalCompositeOperation='source-over';ctx.drawImage(occluder,0,0,width,height);
 },layout};
}
