/** Vardian action-move constants, projected into the web map at 24px / Unity unit.
 * Source tokens and qualified scene links: docs/rpg/vardian-traversal-evidence.json.
 * The ten-zone arrangement and intermediate ledges are authored web geometry.
 */
export const TRAVERSAL={unit:24,gravity:9.8,jumpHeight:3,timeScale:3,climbStep:3.5,climbStay:.1,slideSpeed:15} as const;
export type Passage='jump-gap'|'jump-down'|'jump-up'|'jump-climb'|'slide';
export const PASSAGE_LABEL:Record<Passage,string>={'jump-gap':'틈 건너기','jump-down':'아래로 점프','jump-up':'위로 점프','jump-climb':'발판 오르기',slide:'낮은 통로'};
export type TraversalPoint={x:number;y:number;elevation:number};
export type TraversalLeg={from:TraversalPoint;to:TraversalPoint;duration:number;hold:number;velocityY:number};
export function traversalLeg(from:TraversalPoint,to:TraversalPoint,slide=false,climb=false):TraversalLeg{
 if(slide)return {from,to,duration:Math.hypot(to.x-from.x,to.y-from.y)/(TRAVERSAL.slideSpeed*TRAVERSAL.unit),hold:0,velocityY:0};
 const dy=(to.elevation-from.elevation)/TRAVERSAL.unit;
 const clearance=climb?Math.max(.5,TRAVERSAL.climbStep-Math.abs(dy)):TRAVERSAL.jumpHeight;
 const apex=Math.max(0,dy)+clearance,vy=Math.sqrt(2*TRAVERSAL.gravity*apex);
 const seconds=(vy+Math.sqrt(Math.max(0,vy*vy-2*TRAVERSAL.gravity*dy)))/TRAVERSAL.gravity;
 return {from,to,duration:seconds/TRAVERSAL.timeScale,hold:0,velocityY:vy};
}
export function traversalDuration(legs:TraversalLeg[]){return legs.reduce((sum,l)=>sum+l.duration+l.hold,0);}
/** Pure evaluator shared by server movement and tests; exact landing and bounded holds. */
export function sampleTraversal(legs:TraversalLeg[],age:number){
 let elapsed=Math.max(0,age);
 for(let index=0;index<legs.length;index++){
  const l=legs[index];
  if(elapsed<=l.duration+l.hold||index===legs.length-1){
   const progress=Math.min(1,elapsed/l.duration),t=progress*l.duration*TRAVERSAL.timeScale;
   const elevation=l.from.elevation+(l.to.elevation-l.from.elevation)*progress;
   const ballistic=l.from.elevation+TRAVERSAL.unit*(l.velocityY*t-.5*TRAVERSAL.gravity*t*t);
   return {x:l.from.x+(l.to.x-l.from.x)*progress,y:l.from.y+(l.to.y-l.from.y)*progress,elevation,
    airHeight:l.velocityY&&progress<1?Math.max(0,ballistic-elevation):0,index,progress,holding:elapsed>=l.duration};
  }
  elapsed-=l.duration+l.hold;
 }
 throw Error('Traversal requires at least one leg');
}
