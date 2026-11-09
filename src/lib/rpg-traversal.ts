// Server-owned traversal and bounded, transactional landing clearance. Units: centimetres.
export type Body={x:number;y:number;radius:number;hp?:number;bodyHeight?:number;elevation?:number;unityBoss?:boolean};
export type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export const TRAVERSAL={heroRadius:20,heroHeight:130,jumpPeak:100,maxPush:85};
export function overlaps(x:number,y:number,body:Body,radius=20){return Math.hypot(x-body.x,y-body.y)<radius+body.radius;}
export function blocksAt(x:number,y:number,feet:number,obstacle:any,ground:(x:number,y:number)=>number){
 if(!overlaps(x,y,obstacle))return false;
 const bottom=obstacle.baseElevation??ground(obstacle.x,obstacle.y),height=obstacle.bodyHeight??obstacle.height??(obstacle.unityBoss?650:Infinity);
 return feet<bottom+height && feet+TRAVERSAL.heroHeight>bottom;
}
export function clearLanding(hero:{x:number;y:number},bodies:Body[],obstacles:any[],bounds:Bounds,ground:(x:number,y:number)=>number,planar:boolean){
 const alive=bodies.filter(b=>(b.hp??1)>0),planned=new Map<Body,{x:number;y:number}>();
 const valid=(p:{x:number;y:number},r:number,ignore?:Body)=>p.x>=bounds.minX&&p.x<=bounds.maxX&&p.y>=bounds.minY&&p.y<=bounds.maxY&&!obstacles.some(o=>overlaps(p.x,p.y,o,r))&&!alive.some(b=>b!==ignore&&Math.hypot(p.x-(planned.get(b)?.x??b.x),p.y-(planned.get(b)?.y??b.y))<r+b.radius+.01);
 if(obstacles.some(o=>overlaps(hero.x,hero.y,o)))return false;
 for(const body of alive){if(!overlaps(hero.x,hero.y,body))continue;let chosen:{x:number;y:number}|null=null,best=Infinity;
  const a=Math.atan2(body.y-hero.y,body.x-hero.x),r=body.radius+TRAVERSAL.heroRadius+.5;
  for(let i=0;i<(planar?32:2);i++){const angle=planar?a+i*Math.PI/16:i===0?(body.x>=hero.x?0:Math.PI):(body.x>=hero.x?Math.PI:0);const p={x:hero.x+Math.cos(angle)*r,y:planar?hero.y+Math.sin(angle)*r:body.y};const d=Math.hypot(p.x-body.x,p.y-body.y);if(d<=TRAVERSAL.maxPush&&d<best&&valid(p,body.radius,body)&&Array.from({length:Math.max(1,Math.ceil(d/6))},(_,n)=>{const t=(n+1)/Math.max(1,Math.ceil(d/6));return !obstacles.some(o=>overlaps(body.x+(p.x-body.x)*t,body.y+(p.y-body.y)*t,o,body.radius));}).every(Boolean)){chosen=p;best=d;}}
  if(!chosen)return false;planned.set(body,chosen);
 }
 for(const [body,p]of planned){body.x=p.x;body.y=p.y;body.elevation=ground(p.x,p.y);}return true;
}

// If a landing is fully blocked, retreat along the traversed path to a free point.
// Each attempt is transactional: failed candidates never displace monsters.
export function settleLanding(hero:{x:number;y:number},from:{x:number;y:number},bodies:Body[],obstacles:any[],bounds:Bounds,ground:(x:number,y:number)=>number,planar:boolean){
 const end={x:hero.x,y:hero.y},steps=Math.max(1,Math.ceil(Math.hypot(end.x-from.x,end.y-from.y)/6));
 for(let i=0;i<=steps;i++){const t=i/steps,p={x:end.x+(from.x-end.x)*t,y:end.y+(from.y-end.y)*t};if(p.x<bounds.minX||p.x>bounds.maxX||p.y<bounds.minY||p.y>bounds.maxY)continue;if(clearLanding(p,bodies,obstacles,bounds,ground,planar)){hero.x=p.x;hero.y=p.y;return true;}}
 return false;
}
