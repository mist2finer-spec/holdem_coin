import {combatSpriteFrame,SPRITE_CELL,SPRITE_FOOT} from './combat-characters';
/** A single scale and foot anchor for every pose: never resize to a frame's bounds. */
export const COMBAT_SPRITE_SCALE=.62*.75;
export function spritePlacement(frame:number,x:number,floor:number,scale:number,facing:number){
 if(!Number.isInteger(frame)||frame<0||frame>15)throw Error('Invalid sprite frame');
 return {source:[frame%4*SPRITE_CELL,Math.floor(frame/4)*SPRITE_CELL,SPRITE_CELL,SPRITE_CELL] as const,
  x,y:floor,scaleX:scale*(facing<0?-1:1),scaleY:scale,
  target:[-SPRITE_FOOT.x,-SPRITE_FOOT.y,SPRITE_CELL,SPRITE_CELL] as const};
}
/** Reset each individual combo strike, including repeated actions, using engine serials. */
export class CombatSpriteClock{
 private action='';private serial=-1;private time=0;
 frame(action:string,serial:number,dt:number,speed=1,strikeAt=.2){
  if(action!==this.action||serial!==this.serial){this.action=action;this.serial=serial;this.time=0;}
  this.time+=Math.max(0,Number.isFinite(dt)?dt:0)*Math.max(0,Number.isFinite(speed)?speed:1);
  return combatSpriteFrame(action,this.time,strikeAt);
 }
}
