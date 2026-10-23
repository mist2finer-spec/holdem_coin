/** Browser prototype body sizes in world units, independent of viewport zoom.
 * Medium player diameter 48, small slime diameter 24. Small enemies may overlap
 * one another; only player/enemy separation is enforced. Dodge capacity remains 3 small bodies.
 */
export const HUNT_BODIES={heroRadius:24,slimeRadius:12,maxDodgeSlimes:3} as const;
export const HUNT_VISUALS={heroScale:.9*.75,slimeScale:1.2*.75} as const;
export type Body={x:number;hp:number};
const EPS=1e-6;
export const bodySeparation=HUNT_BODIES.heroRadius+HUNT_BODIES.slimeRadius;
export function isClearLanding(x:number,enemies:readonly Body[]){
 return enemies.every(e=>e.hp<=0||Math.abs(e.x-x)>=bodySeparation-EPS);
}
/** Swept interval collision, so fast Rush and large frame steps cannot tunnel. */
export function sweepHero(from:number,to:number,enemies:readonly Body[]){
 const dir=Math.sign(to-from);if(!dir)return from;
 let end=to;
 for(const e of enemies){
  if(e.hp<=0)continue;
  const left=e.x-bodySeparation,right=e.x+bodySeparation;
  if(from>left+EPS&&from<right-EPS){
   // Recovery for externally moved overlapping bodies: only move outwards.
   if(dir*(from-e.x)<0)return from;
   continue;
  }
  if(dir>0&&from<=left+EPS&&end>left)end=Math.min(end,left);
  if(dir<0&&from>=right-EPS&&end<right)end=Math.max(end,right);
 }
 return end;
}
/** Count every living body touched along the requested roll, not just centers.
 * A fourth body cancels displacement. With <=3, shorten to a free landing point.
 */
export function planDodge(from:number,to:number,enemies:readonly Body[]){
 const dir=Math.sign(to-from),low=Math.min(from,to),high=Math.max(from,to);
 const crossed=enemies.filter(e=>e.hp>0&&e.x+bodySeparation>low+EPS&&e.x-bodySeparation<high-EPS);
 if(crossed.length>HUNT_BODIES.maxDodgeSlimes)return {destination:from,crossed:crossed.length,inPlace:true};
 let destination=to;
 for(let i=0;i<enemies.length+1;i++){
  const blocked=enemies.find(e=>e.hp>0&&Math.abs(e.x-destination)<bodySeparation-EPS);
  if(!blocked)break;
  destination=blocked.x-dir*bodySeparation;
  if(dir*(destination-from)<=EPS){destination=from;break;}
 }
 if(!isClearLanding(destination,enemies))destination=from;
 return {destination,crossed:crossed.length,inPlace:Math.abs(destination-from)<EPS};
}
