import {RNG} from 'rot-js';
import {TRAVERSAL,type Passage,type TraversalPoint} from './traversal';
export const ROGUE_TILE=48,ROGUE_RADIUS=12;
export type Point={x:number;y:number};
export type SceneryStyle='crypt'|'moss'|'prison'|'cathedral';
export type RogueDecor={x:number;kind:'pillar'|'candle'|'statue'|'rubble'};
export type RogueRoom={id:number;x1:number;y1:number;x2:number;y2:number;center:Point;elevation:number;column:number;branch:'upper'|'lower'|'common';theme:string;scenery:SceneryStyle;decor:RogueDecor[]};
export type RogueGate={id:number;fromRoom:number;kind:'jump'|'slide';passage:Passage;from:TraversalPoint;to:TraversalPoint;ledges:TraversalPoint[];nextRoom:number};
export type RogueMap={seed:number;width:number;height:number;tiles:number[];rooms:RogueRoom[];links:[number,number][];gates:RogueGate[];start:Point;exit:Point};
export const cell=(x:number)=>Math.floor(x/ROGUE_TILE);
export const tileCenter=(n:number)=>(n+.5)*ROGUE_TILE;
export const UPPER_ROUTE=[0,1,3,4,6,7,9] as const;
export const LOWER_ROUTE=[0,2,3,5,6,8,9] as const;
export function roomGates(map:RogueMap,room:number){return map.gates.filter(g=>g.fromRoom===room);}
export function routeFrom(map:RogueMap,room:number,branch:'upper'|'lower'='upper'){
 const gates=roomGates(map,room);return gates.find(g=>map.rooms[g.nextRoom].branch===branch)??gates[0];
}
/** Ten arenas, three upper/lower forks and a common boss. x is movement; elevation is platform height. */
export function generateRogueMap(seed:number):RogueMap{
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid dungeon seed');
 const state=RNG.getState(),oldSeed=RNG.getSeed();RNG.setSeed(seed||1);
 try{
  const pickHeight=()=>96+Math.floor(RNG.getUniform()*3)*24;
  const first=pickHeight(),common=first+Math.floor(RNG.getUniform()*3)*24,upper=common+pickHeight();
  const columns=[0,1,1,2,3,3,4,5,5,6],elevations=[0,first,-pickHeight(),first,first+pickHeight(),first-pickHeight(),common,upper,common-pickHeight(),upper];
  const branches=['common','upper','lower','common','upper','lower','common','upper','lower','common'] as const;
  const themes=['red','green','blue','goblin','skeleton','spider','ember','goblin','skeleton','boss'];
  let cursor=3;const bounds=Array.from({length:7},()=>{const length=44+Math.floor(RNG.getUniform()*11),from=cursor;cursor+=length+4+Math.floor(RNG.getUniform()*2);return [from,from+length-1];});
  const styleOffset=Math.floor(RNG.getUniform()*4);
  const width=cursor+2,height=16,rooms=columns.map((column,id)=>{const [x1,x2]=bounds[column];return {id,x1,y1:5,x2,y2:10,center:{x:tileCenter(Math.floor((x1+x2)/2)),y:tileCenter(7)},elevation:elevations[id],column,branch:branches[id],theme:themes[id],scenery:(['crypt','moss','prison','cathedral'] as const)[(id+styleOffset)%4],decor:Array.from({length:Math.floor((x2-x1)/4)},(_,i)=>({x:tileCenter(x1+3+i*4)+Math.floor(RNG.getUniform()*48),kind:(['pillar','candle','statue','rubble'] as const)[Math.floor(RNG.getUniform()*4)]}))};});
  const tiles=new Array(width*height).fill(1),links:[number,number][]=[[0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],[6,7],[6,8],[7,9],[8,9]];
  const dig=(x:number,y:number)=>{if(x>0&&y>0&&x<width-1&&y<height-1)tiles[y*width+x]=0;};
  for(const r of rooms)for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++)dig(x,y);
  const passages:Passage[]=['jump-up','jump-down','slide','jump-climb','jump-climb','jump-down','jump-down','jump-up','jump-up','jump-down','jump-gap','jump-climb'];
  const gates=links.map(([fromRoom,nextRoom],id)=>{
   const a=rooms[fromRoom],b=rooms[nextRoom],passage=passages[id],kind=passage==='slide'?'slide' as const:'jump' as const;
   if(kind==='slide')for(let y=6;y<=8;y++)for(let x=a.x2;x<=b.x1;x++)dig(x,y);
   const from={x:tileCenter(a.x2),y:tileCenter(7),elevation:a.elevation},to={x:tileCenter(b.x1),y:tileCenter(7),elevation:b.elevation};
   const count=passage==='jump-climb'?Math.ceil(Math.abs(to.elevation-from.elevation)/(TRAVERSAL.climbStep*TRAVERSAL.unit)):1;
   const ledges=Array.from({length:count-1},(_,i)=>{const t=(i+1)/count;return {x:from.x+(to.x-from.x)*t,y:from.y,elevation:from.elevation+(to.elevation-from.elevation)*t};});
   return {id,fromRoom,nextRoom,kind,passage,from,to,ledges};
  });
  return {seed,width,height,tiles,rooms,links,gates,start:{x:tileCenter(rooms[0].x1+6),y:tileCenter(7)},exit:{x:tileCenter(rooms[9].x2),y:tileCenter(7)}};
 }finally{RNG.setSeed(oldSeed);RNG.setState(state);}
}

export function walkable(map:RogueMap,x:number,y:number,radius=ROGUE_RADIUS){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 for(let ty=cell(y-radius);ty<=cell(y+radius);ty++)for(let tx=cell(x-radius);tx<=cell(x+radius);tx++){
  if(tx<0||ty<0||tx>=map.width||ty>=map.height)return false;
  if(map.tiles[ty*map.width+tx]!==0){const px=Math.max(tx*ROGUE_TILE,Math.min(x,(tx+1)*ROGUE_TILE)),py=Math.max(ty*ROGUE_TILE,Math.min(y,(ty+1)*ROGUE_TILE));if(Math.hypot(x-px,y-py)<radius-1e-6)return false;}
 }return true;
}
export function moveOnMap(map:RogueMap,p:Point,dx:number,dy:number,radius=ROGUE_RADIUS){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(radius*.5)));if(!Number.isFinite(steps)||steps>200)return {...p};
 let {x,y}=p;for(let i=0;i<steps;i++){if(walkable(map,x+dx/steps,y,radius))x+=dx/steps;if(walkable(map,x,y+dy/steps,radius))y+=dy/steps;}return {x,y};
}
export function lineClear(map:RogueMap,a:Point,b:Point){const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(ROGUE_TILE*.25));for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(!walkable(map,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,1))return false;}return true;}

/** Platform height for drawing only; collision uses tiles and the engine's current zone. */
export function terrainElevation(map:RogueMap,x:number,roomId?:number){
 if(roomId!==undefined)return map.rooms[roomId].elevation;
 const room=map.rooms.find(r=>x>=(r.x1-1)*ROGUE_TILE&&x<(r.x2+1)*ROGUE_TILE);
 if(room)return room.elevation;
 const gate=map.gates.find(g=>x>=g.from.x&&x<=g.to.x);
 return gate?gate.from.elevation+(gate.to.elevation-gate.from.elevation)*(x-gate.from.x)/(gate.to.x-gate.from.x):0;
}
