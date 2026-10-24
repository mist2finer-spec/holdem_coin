/** Four actual body poses, timed against authoritative impact rather than UI FPS. */
export const ATTACK_CELL={width:512,height:384,footX:256,footY:352,frames:4} as const;
export function attackSpriteFrame(age:number,duration:number,hitAt:number,impactFrame=2){
 if(!Number.isFinite(age)||!Number.isFinite(duration)||!Number.isFinite(hitAt)||duration<=0)return 0;
 const hit=Math.max(0,Math.min(duration,hitAt));
 if(age<hit)return impactFrame===2&&age>=hit*.5?1:0;
 if(age<hit+(duration-hit)*.25)return impactFrame;
 if(age<hit+(duration-hit)*.65)return 2;
 return 3;
}
export function attackSpritePlacement(frame:number,x:number,floor:number,scale:number,facing:number){
 if(!Number.isInteger(frame)||frame<0||frame>3)throw Error('Invalid attack frame');
 return {source:[frame*ATTACK_CELL.width,0,ATTACK_CELL.width,ATTACK_CELL.height] as const,
  x,y:floor,scaleX:scale*(facing<0?-1:1),scaleY:scale,
  target:[-ATTACK_CELL.footX,-ATTACK_CELL.footY,ATTACK_CELL.width,ATTACK_CELL.height] as const};
}
