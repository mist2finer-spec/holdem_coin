'use client';
import type {CSSProperties} from 'react';
import type {Card, SeatState} from '@/lib/poker-engine';
import {PlayingCard} from './PlayingCard';
export const SALON_EIGHT_POSITIONS=[{top:'89%',left:'50%'},{top:'66%',left:'90%'},{top:'49%',left:'90%'},{top:'32%',left:'90%'},{top:'9%',left:'50%'},{top:'32%',left:'10%'},{top:'49%',left:'10%'},{top:'66%',left:'10%'}];
// Six guests: two on each side, one at either end. Presentation only.
export const SALON_SIX_POSITIONS=[{top:'89%',left:'50%'},{top:'62%',left:'89%'},{top:'37%',left:'90%'},{top:'9%',left:'50%'},{top:'37%',left:'10%'},{top:'62%',left:'11%'}];
// Portrait identity remains independent of AI playing style.
export function salonCharacter(portrait?:number){return portrait===8?'pink-glasses':portrait===6?'teal-twins':'hong';}
type SalonSeatView=Pick<SeatState,'name'|'stack'|'isUser'|'folded'|'persona'>&{holeCards:(Card|null)[]};
export function SalonSeat({seat,portrait,stackLabel,isActive,isDealer,isSmallBlind,isBigBlind,showCards,position}:{seat:SalonSeatView;portrait?:number;stackLabel?:string;isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;showCards:boolean;position:{top:string;left:string}}){
 const top=parseFloat(position.top),left=parseFloat(position.left),side=top>85?'self':top<12?'north':left<50?'west':'east',pose=side==='self'?'back':side==='north'?'front':side==='west'?'right':'left';
 const visible=seat.isUser||(showCards&&!seat.folded);
 const character=salonCharacter(portrait??seat.persona?.portrait);
 // The image canvas is identical; hand height differs in preserved front/back art.
 const handLevel=side==='north'?(character==='pink-glasses'?.68:character==='teal-twins'?.60:.68):side==='self'?(character==='pink-glasses'?.68:character==='teal-twins'?.60:.62):character==='hong'?.65:.52;
 const anchorStyle={'--seat-top':position.top,'--hand-level':handLevel,'--hand-cut':`${handLevel*100}%`} as CSSProperties;
 return <section className={`salon-seat salon-seat-${side}${isActive?' salon-seat-active':''}${seat.folded?' salon-seat-folded':''}`} style={anchorStyle} aria-label={`${seat.name} 잔고 ${stackLabel??seat.stack}`}>
  <div className="salon-guest"><img src={`/poker/${character}-table/${pose}.png`} alt="" draggable={false}/>{seat.folded&&<span className="salon-fold">FOLD</span>}
  </div>
   {(isDealer||isSmallBlind||isBigBlind)&&<b className={`salon-position ${isBigBlind?'bb':isSmallBlind?'sb':''}`}>{isBigBlind?'BB':isSmallBlind?'SB':'D'}</b>}
  <div className="salon-seat-info"><strong>{seat.name}</strong><span>◈ {stackLabel??seat.stack.toLocaleString()}</span></div>
  <div className="salon-cards">{seat.isUser&&seat.holeCards.length>0&&(!seat.folded||seat.isUser)&&seat.holeCards.map((c,i)=><PlayingCard key={i} card={visible&&c?c:undefined} hidden={!visible||!c} size={seat.isUser?'md':'xs'}/>)}</div>
 </section>;
}
export function salonWagerPosition(p:{top:string;left:string}){
 const top=parseFloat(p.top),left=parseFloat(p.left);
 return top>85?{top:'62%',left:'50%'}:top<12?{top:'24%',left:'50%'}:{top:`${top}%`,left:left<50?'25%':'75%'};
}
