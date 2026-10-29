import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SalonSeat,SALON_EIGHT_POSITIONS,SALON_SIX_POSITIONS,salonWagerPosition} from '../src/components/poker/SalonSeat';
// The standalone tsx loader uses classic JSX for the Next.js preserve setting.
Object.assign(globalThis,{React});
const holeCards=[{rank:'A',suit:'♠'},{rank:'K',suit:'♥'}] as const;
function render(index:number,portrait:number,isUser=false,showCards=false,stackLabel?:string){
 return renderToStaticMarkup(React.createElement(SalonSeat,{seat:{name:'Test',stack:1200,isUser,folded:false,holeCards:[...holeCards]},portrait,stackLabel,isActive:false,isDealer:true,isSmallBlind:false,isBigBlind:false,showCards,position:SALON_EIGHT_POSITIONS[index]}));
}
test('portrait identity chooses new art without changing seat name or stack',()=>{
 assert.match(render(1,8),/pink-glasses-table\/left.png/);
 assert.match(render(7,6),/teal-twins-table\/right.png/);
 assert.match(render(4,7),/hong-table\/front.png/);
 assert.match(render(0,8,true),/pink-glasses-table\/back.png/);
 assert.match(render(1,8),/Test/);
});
test('only local hole cards enter the salon card DOM, even on showdown',()=>{
 assert.match(render(0,7,true),/class="salon-cards"><div/);
 assert.doesNotMatch(render(1,8,false,true),/class="salon-cards"><div/);
 assert.doesNotMatch(render(0,8,false,true),/class="salon-cards"><div/); // spectator
});
test('tournament BB labels survive shared seat rendering',()=>{
 assert.match(render(0,7,true,false,'6 BB'),/6 BB/);
 assert.doesNotMatch(render(0,7,true,false,'6 BB'),/1,200/);
});
test('six/eight presentation retains one north/south and inward wager lanes',()=>{
 for(const positions of [SALON_SIX_POSITIONS,SALON_EIGHT_POSITIONS]){
  assert.equal(positions.filter(p=>parseFloat(p.top)<12).length,1);
  assert.equal(positions.filter(p=>parseFloat(p.top)>85).length,1);
  for(const p of positions){const lane=salonWagerPosition(p);assert.ok(parseFloat(lane.left)>=25&&parseFloat(lane.left)<=75);}
 }
});
