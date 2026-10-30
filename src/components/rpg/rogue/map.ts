import {Map as RotMap,RNG} from 'rot-js';
export const ROGUE_TILE=48,ROGUE_RADIUS=12;
export type Point={x:number;y:number};
export type RogueRoom={id:number;x1:number;y1:number;x2:number;y2:number;center:Point};
export type RogueMap={seed:number;width:number;height:number;tiles:number[];rooms:RogueRoom[];links:[number,number][];start:Point;exit:Point};
export const cell=(x:number)=>Math.floor(x/ROGUE_TILE);
export const tileCenter=(n:number)=>(n+.5)*ROGUE_TILE;
/** Uniform proposes independent rooms. Exactly ten are retained and reconnected with an MST + loops. */
export function generateRogueMap(seed:number):RogueMap{
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid dungeon seed');
 const state=RNG.getState(),oldSeed=RNG.getSeed();RNG.setSeed(seed||1);
 try{
  const width=92,height=68;let bounds:number[][]=[];
  for(let attempt=0;attempt<3&&bounds.length<10;attempt++){
   const d=new RotMap.Uniform(width,height,{roomWidth:[9,12],roomHeight:[7,10],roomDugPercentage:.28,timeLimit:70});
   if(d.create())bounds=d.getRooms().map(r=>[r.getLeft(),r.getTop(),r.getRight(),r.getBottom()]);
  }
  // Bounded seeded fallback: no unbounded generator retry on a slow host.
  if(bounds.length<10)bounds=Array.from({length:10},(_,i)=>{const x=4+(i%5)*17+Math.floor(RNG.getUniform()*3),y=6+Math.floor(i/5)*30+Math.floor(RNG.getUniform()*5);return [x,y,x+9,y+8];});
  bounds=RNG.shuffle(bounds).slice(0,10);
  const rooms=bounds.map(([x1,y1,x2,y2],id)=>({id,x1,y1,x2,y2,center:{x:tileCenter(Math.floor((x1+x2)/2)),y:tileCenter(Math.floor((y1+y2)/2))}}));
  const tiles=new Array(width*height).fill(1),links:[number,number][]=[];
  const dig=(x:number,y:number)=>{if(x>0&&y>0&&x<width-1&&y<height-1)tiles[y*width+x]=0;};
  for(const r of rooms)for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++)dig(x,y);
  const connect=(a:number,b:number)=>{links.push([a,b]);let x=cell(rooms[a].center.x),y=cell(rooms[a].center.y);const tx=cell(rooms[b].center.x),ty=cell(rooms[b].center.y);
   const carve=()=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)dig(x+dx,y+dy);};carve();
   const horizontal=()=>{while(x!==tx){x+=Math.sign(tx-x);carve();}},vertical=()=>{while(y!==ty){y+=Math.sign(ty-y);carve();}};
   if(RNG.getUniform()<.5){horizontal();vertical();}else{vertical();horizontal();}
  };
  const connected=new Set([0]);while(connected.size<10){let best:[number,number]=[0,1],distance=Infinity;
   for(const a of connected)for(let b=0;b<10;b++)if(!connected.has(b)){const d=Math.hypot(rooms[a].center.x-rooms[b].center.x,rooms[a].center.y-rooms[b].center.y);if(d<distance){distance=d;best=[a,b];}}
   connect(...best);connected.add(best[1]);
  }
  const extra:[number,number][]=[];for(let a=0;a<10;a++)for(let b=a+1;b<10;b++)if(!links.some(([u,v])=>u===a&&v===b||u===b&&v===a))extra.push([a,b]);
  for(const [a,b] of RNG.shuffle(extra).slice(0,2))connect(a,b);
  const start={...rooms[0].center},distance=new Int32Array(width*height).fill(-1),queue=[cell(start.y)*width+cell(start.x)];distance[queue[0]]=0;
  for(let i=0;i<queue.length;i++){const n=queue[i];for(const next of [n-1,n+1,n-width,n+width])if(next>=0&&next<tiles.length&&tiles[next]===0&&distance[next]<0){distance[next]=distance[n]+1;queue.push(next);}}
  const far=rooms.reduce((a,b)=>distance[cell(a.center.y)*width+cell(a.center.x)]>distance[cell(b.center.y)*width+cell(b.center.x)]?a:b);
  return {seed,width,height,tiles,rooms,links,start,exit:{...far.center}};
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
