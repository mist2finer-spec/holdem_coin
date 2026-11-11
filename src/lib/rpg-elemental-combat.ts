// Deterministic combat in centimetres/seconds. Unity renders these exact records;
// it never applies a second, camera-dependent damage simulation.
export type ElementPoint={x:number;y:number;elevation:number};
export type ElementTarget=ElementPoint&{id:number;hp:number;radius:number;bodyHeight?:number;unityBoss?:boolean;wetUntil?:number};
export type ElementObstacle={x:number;y:number;radius:number;bodyHeight?:number;height?:number;baseElevation?:number};
export const ELEMENTAL_RULES=Object.freeze({swordRadius:105,dropRadius:18,dropSpeed:520,dropGravity:110,dropLife:1.5,lightningRadius:240,wetSeconds:4,wetMultiplier:1.25});
type Drop=ElementPoint&{id:number;attackId:number;vx:number;vy:number;vz:number;born:number;radius:number;bounces:number;active:boolean;damage:number;origin:ElementPoint;hit:number[]};
type Strike={attackId:number;at:number;center:ElementPoint;origin:ElementPoint;damage:number;variant:number;hit:number[]};
export type ElementWorld={targets:ElementTarget[];obstacles:ElementObstacle[];ground:(x:number,y:number)=>number;damage:(target:ElementTarget,damage:number,attackId:number,at:number,element:string,point:ElementPoint)=>void;impulse:(target:ElementTarget,dx:number,dy:number)=>void;emit:(event:any)=>void};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
// Earliest segment/circle intersection, including an initially overlapping sphere.
export function sweepCircle(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number},radius:number){
 const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y,q=ox*ox+oy*oy-radius*radius;
 if(q<=0)return 0;const aa=dx*dx+dy*dy;if(aa<1e-10)return Infinity;
 const bb=ox*dx+oy*dy,disc=bb*bb-aa*q;if(disc<0)return Infinity;const t=(-bb-Math.sqrt(disc))/aa;return t>=0&&t<=1?t:Infinity;
}
export function elementLineClear(a:ElementPoint,b:ElementPoint,obstacles:ElementObstacle[],ground:(x:number,y:number)=>number){
 return !obstacles.some(o=>{const t=sweepCircle(a,b,o,o.radius+2);if(!Number.isFinite(t))return false;return a.elevation+(b.elevation-a.elevation)*t<=ground(o.x,o.y)+(o.bodyHeight??o.height??180);});
}
export function elementalVariant(gem:string){return ['icenova','arc'].includes(gem)?2:['frostshot','spark'].includes(gem)?3:1;}
export function swordStage(combo:number){return (Math.max(1,combo)-1)%5+1;}
export function swordAction(combo:number){return ['attack1','attack2','attack3','attack2','attack1'][swordStage(combo)-1];}

export class ElementalCombat {
 private serial=0;private drops:Drop[]=[];private strikes:Strike[]=[];
 clear(){this.drops=[];this.strikes=[];}
 cast(skill:string,variant:number,origin:ElementPoint,center:ElementPoint,at:number,attackId:number,damage:number,world:ElementWorld){
  const hit:number[]=[];variant=Math.max(1,Math.min(3,variant));
  if(skill==='water-ring'){
   const count=variant===1?8:variant===2?12:16;
   for(let i=0;i<count;i++){
    const angle=2*Math.PI*i/(variant===2?6:count)+(variant===2&&i>=6?.35:0);
    const delay=variant===2&&i>=6?.18:variant===3?i*.035:0;
    this.drops.push({...origin,elevation:origin.elevation+34,id:++this.serial,attackId,vx:Math.cos(angle)*ELEMENTAL_RULES.dropSpeed,vy:Math.sin(angle)*ELEMENTAL_RULES.dropSpeed,vz:65,born:at+delay,radius:ELEMENTAL_RULES.dropRadius,bounces:0,active:true,damage,origin:{...origin},hit});
   }
   this.drops=this.drops.slice(-48);
  }else{
   this.strikes.push({attackId,at,origin:{...origin},center:{...center},damage,variant,hit});
   if(variant===2){const others=world.targets.filter(t=>t.hp>0&&distance(t,center)>25&&distance(t,center)<=450).sort((a,b)=>distance(a,center)-distance(b,center)).slice(0,2);others.forEach((t,i)=>this.strikes.push({attackId,at:at+(i+1)*.12,origin:{...center,elevation:center.elevation+35},center:{...t},damage,variant,hit}));}
   if(variant===3)for(let i=0;i<4;i++){const angle=i*Math.PI/2,p={x:center.x+Math.cos(angle)*145,y:center.y+Math.sin(angle)*145,elevation:0};p.elevation=world.ground(p.x,p.y);this.strikes.push({attackId,at:at+(i+1)*.12,origin:{...origin},center:p,damage,variant,hit});}
   this.strikes=this.strikes.slice(-20);
  }
 }
 private contact(target:ElementTarget,damage:number,attackId:number,at:number,element:string,origin:ElementPoint,hit:number[],world:ElementWorld){
  if(target.hp<=0||hit.includes(target.id))return;hit.push(target.id);
  if(element==='water')target.wetUntil=at+ELEMENTAL_RULES.wetSeconds;
  if(element==='lightning'&&(target.wetUntil??0)>at)damage*=ELEMENTAL_RULES.wetMultiplier;
  const p={x:target.x,y:target.y,elevation:target.elevation+30};world.damage(target,damage,attackId,at,element,p);
  const d=distance(target,origin)||1,k=target.unityBoss?3:element==='water'?18:25;world.impulse(target,(target.x-origin.x)/d*k,(target.y-origin.y)/d*k);
 }
 step(now:number,dt:number,world:ElementWorld){
  for(const s of this.strikes){if(s.at>now)continue;
   // Trunks/overhangs occupying the locked ground point block a strike.
   const covered=world.obstacles.some(o=>distance(o,s.center)<o.radius);
   world.emit({kind:'elemental-strike',element:'lightning',attackId:s.attackId,born:s.at,x:s.center.x,z:s.center.y,elevation:s.center.elevation,radius:ELEMENTAL_RULES.lightningRadius,variant:s.variant,blocked:covered});
   if(!covered)for(const t of world.targets)if(distance(t,s.center)<=ELEMENTAL_RULES.lightningRadius+t.radius&&elementLineClear({...s.center,elevation:s.center.elevation+35},{...t,elevation:t.elevation+35},world.obstacles,world.ground))this.contact(t,s.damage,s.attackId,s.at,'lightning',s.origin,s.hit,world);
  }
  this.strikes=this.strikes.filter(s=>s.at>now);
  for(const d of this.drops){if(!d.active||now<d.born)continue;const step=Math.min(dt,now-d.born);if(step<=0)continue;
   if(now-d.born>ELEMENTAL_RULES.dropLife){d.active=false;continue;}
   const next={x:d.x+d.vx*step,y:d.y+d.vy*step,elevation:d.elevation+d.vz*step-.5*ELEMENTAL_RULES.dropGravity*step*step};d.vz-=ELEMENTAL_RULES.dropGravity*step;
   let fraction=Infinity,target:ElementTarget|undefined,wall:ElementObstacle|undefined;
   for(const o of world.obstacles){const f=sweepCircle(d,next,o,o.radius+d.radius);if(f<fraction&&d.elevation+(next.elevation-d.elevation)*f-d.radius<=world.ground(o.x,o.y)+(o.bodyHeight??o.height??180)){fraction=f;wall=o;target=undefined;}}
   for(const t of world.targets){if(t.hp<=0||d.hit.includes(t.id))continue;const f=sweepCircle(d,next,t,t.radius+d.radius),height=d.elevation+(next.elevation-d.elevation)*f;if(f<fraction&&height+d.radius>=t.elevation&&height-d.radius<=t.elevation+(t.unityBoss?650:t.bodyHeight??62)){fraction=f;target=t;wall=undefined;}}
   if(Number.isFinite(fraction)){
    d.x+=(next.x-d.x)*fraction;d.y+=(next.y-d.y)*fraction;d.elevation+=(next.elevation-d.elevation)*fraction;
    world.emit({kind:'elemental-splash',element:'water',attackId:d.attackId,born:now,x:d.x,z:d.y,elevation:d.elevation,radius:55,blocked:!!wall});
    if(target){this.contact(target,d.damage,d.attackId,now,'water',d.origin,d.hit,world);d.active=false;}
    else if(wall&&d.bounces++===0){let nx=d.x-wall.x,ny=d.y-wall.y;const len=Math.hypot(nx,ny)||1;nx/=len;ny/=len;const dot=d.vx*nx+d.vy*ny;d.vx=(d.vx-2*dot*nx)*.7;d.vy=(d.vy-2*dot*ny)*.7;d.x=wall.x+nx*(wall.radius+d.radius+1);d.y=wall.y+ny*(wall.radius+d.radius+1);}
    else d.active=false;
   }else{d.x=next.x;d.y=next.y;d.elevation=next.elevation;if(d.elevation-d.radius<=world.ground(d.x,d.y)){world.emit({kind:'elemental-splash',element:'water',attackId:d.attackId,born:now,x:d.x,z:d.y,elevation:world.ground(d.x,d.y),radius:65});d.active=false;}}
  }
  this.drops=this.drops.filter(d=>d.active);
 }
 view(now:number){return this.drops.filter(d=>d.born<=now).map(d=>({id:d.id,attackId:d.attackId,x:d.x,y:d.y,elevation:d.elevation,vx:d.vx,vy:d.vy,vz:d.vz,radius:d.radius,born:d.born,bounces:d.bounces}));}
}
