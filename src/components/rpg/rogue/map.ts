import {RNG} from 'rot-js';
import {TRAVERSAL,type Passage,type TraversalPoint} from './traversal';
export const ROGUE_TILE=48,ROGUE_RADIUS=12;
export type Point={x:number;y:number};
export type RogueRoom={id:number;x1:number;y1:number;x2:number;y2:number;center:Point;elevation:number};
export type RogueGate={id:number;kind:'jump'|'slide';passage:Passage;from:TraversalPoint;to:TraversalPoint;ledges:TraversalPoint[];nextRoom:number};
export type RogueMap={seed:number;width:number;height:number;tiles:number[];rooms:RogueRoom[];links:[number,number][];gates:RogueGate[];start:Point;exit:Point};
export const cell=(x:number)=>Math.floor(x/ROGUE_TILE);
export const tileCenter=(n:number)=>(n+.5)*ROGUE_TILE;
/** Seeded multi-level belt arenas. Corridors are traversable only through the engine's clear/action gate. */
export function generateRogueMap(seed:number):RogueMap{
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid dungeon seed');
 const state=RNG.getState(),oldSeed=RNG.getSeed();RNG.setSeed(seed||1);
 try{
  const passages:Passage[]=['jump-gap','slide','jump-down','jump-climb','jump-up','slide','jump-gap','jump-down','jump-climb'];
  const rises:Record<Passage,number>={'jump-gap':0,slide:0,'jump-down':-8,'jump-climb':8,'jump-up':4};
  const height=16;let cursor=3,elevation=0;const bounds:number[][]=[];
  for(let id=0;id<10;id++){const length=9+Math.floor(RNG.getUniform()*3),y1=4+Math.floor(RNG.getUniform()*2),y2=10+Math.floor(RNG.getUniform()*2);bounds.push([cursor,y1,cursor+length-1,y2]);cursor+=length+(passages[id]==='jump-climb'?4:2);}
  const width=cursor+2;
  const rooms=bounds.map(([x1,y1,x2,y2],id)=>{if(id)elevation+=rises[passages[id-1]]*TRAVERSAL.unit;return {id,x1,y1,x2,y2,elevation,center:{x:tileCenter(Math.floor((x1+x2)/2)),y:tileCenter(Math.floor((y1+y2)/2))}};});
  const tiles=new Array(width*height).fill(1),links:[number,number][]=[];
  const dig=(x:number,y:number)=>{if(x>0&&y>0&&x<width-1&&y<height-1)tiles[y*width+x]=0;};
  for(const r of rooms)for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++)dig(x,y);
  const gates:RogueGate[]=[];
  for(let id=0;id<9;id++){
   const a=rooms[id],b=rooms[id+1];links.push([id,id+1]);
   const passage=passages[id],kind=passage==='slide'?'slide':'jump';
   // Chasms and climbing shafts are not walkable floor. Only server-owned traversal crosses them.
   if(kind==='slide')for(let y=6;y<=8;y++)for(let x=a.x2;x<=b.x1;x++)dig(x,y);
   const from={x:tileCenter(a.x2),y:tileCenter(7),elevation:a.elevation},to={x:tileCenter(b.x1),y:tileCenter(7),elevation:b.elevation};
   const count=passage==='jump-climb'?Math.ceil((to.elevation-from.elevation)/(TRAVERSAL.climbStep*TRAVERSAL.unit)):1;
   const ledges=Array.from({length:count-1},(_,i)=>{const t=(i+1)/count;return {x:from.x+(to.x-from.x)*t,y:from.y,elevation:from.elevation+(to.elevation-from.elevation)*t};});
   gates.push({id,kind,passage,from,to,ledges,nextRoom:id+1});
  }
  return {seed,width,height,tiles,rooms,links,gates,start:{x:tileCenter(rooms[0].x1+1),y:tileCenter(7)},exit:{x:tileCenter(rooms[9].x2),y:tileCenter(7)}};
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
export function terrainElevation(map:RogueMap,x:number){
 const room=map.rooms.find(r=>x>=(r.x1-1)*ROGUE_TILE&&x<(r.x2+1)*ROGUE_TILE);
 if(room)return room.elevation;
 const gate=map.gates.find(g=>x>=g.from.x&&x<=g.to.x);
 return gate?gate.from.elevation+(gate.to.elevation-gate.from.elevation)*(x-gate.from.x)/(gate.to.x-gate.from.x):0;
}
