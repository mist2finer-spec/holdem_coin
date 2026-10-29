'use client';
import type {SeatState} from '@/lib/poker-engine';
import {PlayingCard} from './PlayingCard';
export const SALON_EIGHT_POSITIONS=[{top:'89%',left:'50%'},{top:'72%',left:'90%'},{top:'46%',left:'90%'},{top:'21%',left:'90%'},{top:'9%',left:'50%'},{top:'21%',left:'10%'},{top:'46%',left:'10%'},{top:'72%',left:'10%'}];
// Six guests: two on each side, one at either end. Presentation only.
export const SALON_SIX_POSITIONS=[{top:'89%',left:'50%'},{top:'65%',left:'89%'},{top:'27%',left:'90%'},{top:'9%',left:'50%'},{top:'27%',left:'10%'},{top:'65%',left:'11%'}];
export function SalonSeat({seat,isActive,isDealer,isSmallBlind,isBigBlind,showCards,position}:{seat:SeatState;isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;showCards:boolean;position:{top:string;left:string}}){
 const top=parseFloat(position.top),left=parseFloat(position.left),side=seat.isUser?'self':top<12?'north':left<50?'west':'east',pose=side==='self'?'back':side==='north'?'front':side==='west'?'right':'left';
 const visible=seat.isUser||(showCards&&!seat.folded);
 return <section className={`salon-seat salon-seat-${side}${isActive?' salon-seat-active':''}${seat.folded?' salon-seat-folded':''}`} style={position} aria-label={`${seat.name} 잔고 ${seat.stack}`}>
  <div className="salon-guest"><img src={`/poker/hong-table/${pose}.png`} alt="" draggable={false}/>{seat.folded&&<span className="salon-fold">FOLD</span>}
   {(isDealer||isSmallBlind||isBigBlind)&&<b className={`salon-position ${isBigBlind?'bb':isSmallBlind?'sb':''}`}>{isBigBlind?'BB':isSmallBlind?'SB':'D'}</b>}
  </div>
  <div className="salon-seat-info"><strong>{seat.name}</strong><span>◈ {seat.stack.toLocaleString()}</span></div>
  <div className="salon-cards">{seat.isUser&&seat.holeCards.length>0&&(!seat.folded||seat.isUser)&&seat.holeCards.map((c,i)=><PlayingCard key={i} card={visible?c:undefined} hidden={!visible} size={seat.isUser?'md':'xs'}/>)}</div>
 </section>;
}
export function salonWagerPosition(p:{top:string;left:string}){
 const top=parseFloat(p.top),left=parseFloat(p.left);
 return top>85?{top:'65%',left:'50%'}:top<12?{top:'14%',left:'50%'}:{top:`${top}%`,left:left<50?'25%':'75%'};
}
