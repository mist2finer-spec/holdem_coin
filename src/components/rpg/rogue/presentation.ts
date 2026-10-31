import type {RogueInput,RogueSnapshot} from './engine';
import {moveOnMap,ROGUE_TILE,type RogueMap} from './map';
import {sampleTraversal} from './traversal';
import {ROGUE_PACE} from './pace';
/** Presentation only. Never advances combat, cooldowns, room state or rewards. Times are seconds. */
export class RogueVisualClock{
 private snapshot=0;private received=0;private rendered=0;private playing=false;private initialized=false;
 receive(elapsed:number,now:number,playing=true){
  if(!Number.isFinite(elapsed)||!Number.isFinite(now))return;
  if(!this.initialized||elapsed<this.snapshot){this.rendered=elapsed;this.initialized=true;}
  this.snapshot=elapsed;this.received=now;this.playing=playing;
  if(!playing)this.rendered=elapsed;
 }
 sample(now:number){
  const lead=this.playing?Math.min(ROGUE_PACE.predictionSeconds,Number.isFinite(now)?Math.max(0,now-this.received):0):0;
  this.rendered=Math.max(this.rendered,this.snapshot+lead);return this.rendered;
 }
}
/** Collision-safe manual preview, also used by Rush prediction. Never crosses a locked arena boundary. */
export function previewWalk(map:RogueMap,view:RogueSnapshot,fromX:number,dx:number){
 const room=map.rooms[view.room],steps=Math.max(1,Math.ceil(Math.abs(dx)/6));let x=fromX;
 for(let i=0;i<steps;i++){
  const p=moveOnMap(map,{x,y:view.hero.y},dx/steps,0);p.x=Math.max(room.x1*ROGUE_TILE+12,Math.min((room.x2+1)*ROGUE_TILE-12,p.x));
  if(view.mobs.some(m=>m.hp>0&&m.room===view.room&&Math.hypot(p.x-m.x,p.y-m.y)<12+m.radius-1))break;x=p.x;
 }
 return x;
}
export function projectRogueHero(view:RogueSnapshot,map:RogueMap,visualTime:number,input?:RogueInput):RogueSnapshot['hero']{
 const hero={...view.hero,direction:{...view.hero.direction}},m=hero.motion;
 if(view.status!=='playing')return hero;
 if(m){
  const age=Math.max(0,visualTime-m.start),t=Math.min(1,age/m.duration);
  if(m.kind==='jump'&&m.legs){const p=sampleTraversal(m.legs,age);Object.assign(hero,{x:p.x,y:p.y,elevation:p.elevation,airHeight:p.airHeight,action:p.holding?'jump5':p.progress<.12?'jump1':p.progress<.35?'jump2':p.progress<.65?'jump3':p.progress<.9?'jump4':'jump5'});}
  else if(m.kind==='jump'||m.kind==='dodge'||m.kind==='slide'){hero.x=m.from.x+(m.to.x-m.from.x)*t;hero.y=m.from.y+(m.to.y-m.from.y)*t;hero.airHeight=m.kind==='jump'?4*100*t*(1-t):0;if(m.kind==='jump')hero.action=t<.12?'jump1':t<.35?'jump2':t<.65?'jump3':t<.9?'jump4':'jump5';if(m.kind==='slide')hero.action=t<.7?'sliding1':'sliding2';}
  else if(m.kind==='rush'){const desired=m.from.x+(m.to.x-m.from.x)*t;hero.x=previewWalk(map,view,hero.x,desired-hero.x);}
  return hero;
 }
 if(input&&(Math.abs(input.x)>.1||!input.auto)){
  const direction=Math.max(-1,Math.min(1,input.x)),lead=Math.max(0,Math.min(ROGUE_PACE.predictionSeconds,visualTime-view.elapsed));
  if(Math.abs(direction)>.1){hero.x=previewWalk(map,view,hero.x,direction*ROGUE_PACE.moveSpeed*lead);hero.facing=Math.sign(direction);hero.direction={x:hero.facing,y:0};hero.action='run1';}
  else if(hero.action==='run1')hero.action='stay1';
 }
 return hero;
}
