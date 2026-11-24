// Deterministic combat in centimetres/seconds. Unity renders these exact records;
// it never applies a second, camera-dependent damage simulation.
import {REFERENCE_SKILLS} from './rpg-reference-skills';
export type ElementPoint={x:number;y:number;elevation:number};
export type ElementTarget=ElementPoint&{id:number;hp:number;radius:number;bodyHeight?:number;unityBoss?:boolean;wetUntil?:number};
export type ElementObstacle={x:number;y:number;radius:number;bodyHeight?:number;height?:number;baseElevation?:number};
export const ELEMENTAL_RULES=Object.freeze({swordRadius:105,dropRadius:18,dropSpeed:520,dropGravity:110,dropLife:1.5,lightningRadius:240,wetSeconds:4,wetMultiplier:1.25});
type Drop=ElementPoint&{id:number;attackId:number;vx:number;vy:number;vz:number;born:number;radius:number;bounces:number;active:boolean;damage:number;origin:ElementPoint;hit:number[]};
type Strike={attackId:number;at:number;center:ElementPoint;origin:ElementPoint;damage:number;variant:number;linkedSupports:number;hit:number[];radius:number};
// Ertel trial skills (rpg-reference-skills: lightningball / arcdischarge). Element 'electric'; positions in kernel cm (y = ground plane).
type Ball=ElementPoint&{id:number;attackId:number;born:number;dx:number;dy:number;speed:number;range:number;travelled:number;radius:number;blast:number;height:number;damage:number;origin:ElementPoint;hit:number[];done?:boolean};
type Mine=ElementPoint&{id:number;attackId:number;thrownAt:number;landAt:number;fuseAt:number;from:ElementPoint;radius:number;trigger:number;damage:number;hit:number[]};
export const ELECTRIC='electric' as const;
// The element a kill is shown with (killElement): the lightning family and the ertel trial skills are 'electric', water stays 'water'.
export function killElementOf(element:string|undefined){return element==='lightning'||element===ELECTRIC?ELECTRIC:element==='water'?'water':undefined;}
// Equipped ertel (gem) of the hero: 'electric' or none. ertelOf: a boot/command value -> the ertel, undefined = not a valid value.
export type Ertel=typeof ELECTRIC|null;
export function ertelOf(v:unknown):Ertel|undefined{return v===ELECTRIC?ELECTRIC:v===null||v===false||v==='none'?null:undefined;}
// Compiled supportIds contain connected, effective supports; inventory/socket capacity do not count.
export function linkedElementSupports(skill:any){return Math.min(5,new Set((Array.isArray(skill?.supportIds)?skill.supportIds:[]).filter((id:unknown)=>typeof id==='string'&&id.length>0)).size);}
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
 private serial=0;private drops:Drop[]=[];private strikes:Strike[]=[];private balls:Ball[]=[];private mines:Mine[]=[];
 clear(){this.drops=[];this.strikes=[];this.balls=[];this.mines=[];}
 cast(skill:string,variant:number,origin:ElementPoint,center:ElementPoint,at:number,attackId:number,damage:number,world:ElementWorld,linkedSupports=0,lightningRadius:number=ELEMENTAL_RULES.lightningRadius){
  if(skill===REFERENCE_SKILLS.lightningball.id){this.lightningBall(REFERENCE_SKILLS.lightningball,origin,center,at,attackId,damage,world);return;}
  if(skill===REFERENCE_SKILLS.arcdischarge.id){this.arcMine(REFERENCE_SKILLS.arcdischarge,origin,center,at,attackId,damage,world);return;}
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
   linkedSupports=Number.isFinite(linkedSupports)?Math.max(0,Math.min(5,Math.floor(linkedSupports))):0;
   this.strikes.push({attackId,at,origin:{...origin},center:{...center},damage,variant,linkedSupports,hit,radius:lightningRadius});
   if(variant===2){const others=world.targets.filter(t=>t.hp>0&&distance(t,center)>25&&distance(t,center)<=450).sort((a,b)=>distance(a,center)-distance(b,center)).slice(0,2);others.forEach((t,i)=>this.strikes.push({attackId,at:at+(i+1)*.12,origin:{...center,elevation:center.elevation+35},center:{...t},damage,variant,linkedSupports,hit,radius:lightningRadius}));}
   if(variant===3)for(let i=0;i<4;i++){const angle=i*Math.PI/2,p={x:center.x+Math.cos(angle)*145,y:center.y+Math.sin(angle)*145,elevation:0};p.elevation=world.ground(p.x,p.y);this.strikes.push({attackId,at:at+(i+1)*.12,origin:{...origin},center:p,damage,variant,linkedSupports,hit,radius:lightningRadius});}
   this.strikes=this.strikes.slice(-20);
  }
 }
 // Lightning ball (public so a spec with other size/count can be cast, e.g. by a later node): `count` balls fanned `spread` degrees around the aim direction (origin -> center; no direction = +x).
 lightningBall(spec:{readonly range:number;readonly speed:number;readonly height:number;readonly ballRadius:number;readonly radius:number;readonly size:number;readonly count:number;readonly spread:number},origin:ElementPoint,center:{x:number;y:number},at:number,attackId:number,damage:number,world:ElementWorld){
  const d=distance(center,origin),base=d>1e-6?Math.atan2(center.y-origin.y,center.x-origin.x):0,count=Math.max(1,Math.floor(spec.count)),hit:number[]=[];
  for(let i=0;i<count;i++){const a=base+(i-(count-1)/2)*spec.spread*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),ground=world.ground(origin.x,origin.y);
   const b:Ball={id:++this.serial,attackId,born:at,x:origin.x,y:origin.y,elevation:ground+spec.height,dx,dy,speed:spec.speed,range:spec.range,travelled:0,radius:spec.ballRadius*spec.size,blast:spec.radius*spec.size,height:spec.height,damage,origin:{x:origin.x,y:origin.y,elevation:ground},hit};
   this.balls.push(b);world.emit({kind:'elemental-launch',element:ELECTRIC,skill:REFERENCE_SKILLS.lightningball.id,attackId,ballId:b.id,born:at,x:b.x,z:b.y,elevation:b.elevation,dirX:dx,dirZ:dy,speed:b.speed,range:b.range,radius:b.radius,blast:b.blast,size:spec.size});}
 }
 // Arc discharge: thrown along origin -> center; a wall on the way stops the throw just before it. Over maxActive: the oldest bursts now.
 arcMine(spec:{readonly throwDistance:number;readonly throwSeconds:number;readonly trigger:number;readonly radius:number;readonly fuse:number;readonly maxActive:number},origin:ElementPoint,center:{x:number;y:number},at:number,attackId:number,damage:number,world:ElementWorld){
  while(this.mines.length>=Math.max(1,spec.maxActive))this.burstMine(this.mines[0],at,world,'overflow');
  const d=distance(center,origin),dx=d>1e-6?(center.x-origin.x)/d:1,dy=d>1e-6?(center.y-origin.y)/d:0,end={x:origin.x+dx*spec.throwDistance,y:origin.y+dy*spec.throwDistance};
  let f=1;for(const o of world.obstacles){const t=sweepCircle(origin,end,o,o.radius+12);if(t<f)f=t;}
  const x=origin.x+(end.x-origin.x)*f,y=origin.y+(end.y-origin.y)*f,landAt=at+spec.throwSeconds;
  const m:Mine={id:++this.serial,attackId,thrownAt:at,landAt,fuseAt:landAt+spec.fuse,x,y,elevation:world.ground(x,y),from:{x:origin.x,y:origin.y,elevation:origin.elevation},radius:spec.radius,trigger:spec.trigger,damage,hit:[]};
  this.mines.push(m);world.emit({kind:'elemental-throw',element:ELECTRIC,skill:REFERENCE_SKILLS.arcdischarge.id,attackId,mineId:m.id,born:at,x:m.x,z:m.y,elevation:m.elevation,fromX:m.from.x,fromZ:m.from.y,fromElevation:m.from.elevation,landAt:m.landAt,fuseAt:m.fuseAt,radius:m.radius,trigger:m.trigger});
 }
 // One burst: every living target within radius (+ its body) and in the open from the burst point takes the damage once.
 private burst(p:ElementPoint,radius:number,damage:number,attackId:number,at:number,hit:number[],world:ElementWorld){
  for(const t of world.targets)if(t.hp>0&&distance(t,p)<=radius+t.radius&&elementLineClear({...p,elevation:p.elevation+35},{...t,elevation:t.elevation+35},world.obstacles,world.ground))this.contact(t,damage,attackId,at,ELECTRIC,p,hit,world);
 }
 // A mine burst (born = the judgement tick: the display calls Detonate at this time). overflow in the air bursts at its landing point.
 private burstMine(m:Mine,at:number,world:ElementWorld,reason:'proximity'|'fuse'|'overflow'){
  this.mines=this.mines.filter(v=>v!==m);
  world.emit({kind:'elemental-burst',element:ELECTRIC,skill:REFERENCE_SKILLS.arcdischarge.id,attackId:m.attackId,mineId:m.id,born:at,x:m.x,z:m.y,elevation:m.elevation,radius:m.radius,reason});
  this.burst(m,m.radius,m.damage,m.attackId,at,m.hit,world);
 }
 private stepBalls(now:number,dt:number,world:ElementWorld){
  for(const b of this.balls){if(now<b.born)continue;const move=Math.min(b.speed*Math.min(dt,now-b.born),b.range-b.travelled);
   const next={x:b.x+b.dx*move,y:b.y+b.dy*move};let fraction=Infinity,target:ElementTarget|undefined,wall:ElementObstacle|undefined;
   for(const o of world.obstacles){const f=sweepCircle(b,next,o,o.radius+b.radius);if(f<fraction&&b.elevation-b.radius<=world.ground(o.x,o.y)+(o.bodyHeight??o.height??180)){fraction=f;wall=o;target=undefined;}}
   for(const t of world.targets){if(t.hp<=0)continue;const f=sweepCircle(b,next,t,t.radius+b.radius);if(f<fraction){fraction=f;target=t;wall=undefined;}}
   const f=Number.isFinite(fraction)?fraction:1;b.x+=(next.x-b.x)*f;b.y+=(next.y-b.y)*f;b.travelled+=move*f;b.elevation=world.ground(b.x,b.y)+b.height;
   if(!Number.isFinite(fraction)&&b.travelled<b.range-1e-6)continue;
   b.done=true;world.emit({kind:'elemental-burst',element:ELECTRIC,skill:REFERENCE_SKILLS.lightningball.id,attackId:b.attackId,ballId:b.id,born:now,x:b.x,z:b.y,elevation:b.elevation,radius:b.blast,reason:target?'target':wall?'wall':'range',...(target?{targetId:target.id}:{})});
   this.burst({x:b.x,y:b.y,elevation:b.elevation-b.height},b.blast,b.damage,b.attackId,now,b.hit,world);
  }
  this.balls=this.balls.filter(b=>!b.done);
 }
 private stepMines(now:number,world:ElementWorld){
  for(const m of [...this.mines]){if(now+1e-9<m.landAt)continue;
   if(world.targets.some(t=>t.hp>0&&distance(t,m)<=m.trigger+t.radius))this.burstMine(m,now,world,'proximity');else if(now+1e-9>=m.fuseAt)this.burstMine(m,now,world,'fuse');}
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
   world.emit({kind:'elemental-strike',element:'lightning',attackId:s.attackId,born:s.at,x:s.center.x,z:s.center.y,elevation:s.center.elevation,radius:s.radius,variant:s.variant,linkedSupports:s.linkedSupports,blocked:covered});
   if(!covered)for(const t of world.targets)if(distance(t,s.center)<=s.radius+t.radius&&elementLineClear({...s.center,elevation:s.center.elevation+35},{...t,elevation:t.elevation+35},world.obstacles,world.ground))this.contact(t,s.damage,s.attackId,s.at,'lightning',s.origin,s.hit,world);
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
  if(this.balls.length)this.stepBalls(now,dt,world);if(this.mines.length)this.stepMines(now,world);
 }
 // Ertel trial skill state for the display (empty when none: the engines add their view keys only then).
 ballView(now:number){return this.balls.filter(b=>b.born<=now).map(b=>({id:b.id,attackId:b.attackId,x:b.x,y:b.y,elevation:b.elevation,dirX:b.dx,dirY:b.dy,speed:b.speed,range:b.range,travelled:b.travelled,radius:b.radius,blast:b.blast,born:b.born}));}
 placedMines(){return this.mines.map(m=>({id:m.id,attackId:m.attackId,x:m.x,y:m.y,elevation:m.elevation,from:{...m.from},thrownAt:m.thrownAt,landAt:m.landAt,fuseAt:m.fuseAt,radius:m.radius,trigger:m.trigger}));}
 view(now:number){return this.drops.filter(d=>d.born<=now).map(d=>({id:d.id,attackId:d.attackId,x:d.x,y:d.y,elevation:d.elevation,vx:d.vx,vy:d.vy,vz:d.vz,radius:d.radius,born:d.born,bounces:d.bounces}));}
}
