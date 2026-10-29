'use client';
import type {Card, SeatState} from '@/lib/poker-engine';
import {PlayingCard} from './PlayingCard';
export const SALON_EIGHT_POSITIONS=[{top:'89%',left:'50%'},{top:'72%',left:'90%'},{top:'46%',left:'90%'},{top:'21%',left:'90%'},{top:'9%',left:'50%'},{top:'21%',left:'10%'},{top:'46%',left:'10%'},{top:'72%',left:'10%'}];
// Six guests: two on each side, one at either end. Presentation only.
export const SALON_SIX_POSITIONS=[{top:'89%',left:'50%'},{top:'65%',left:'89%'},{top:'27%',left:'90%'},{top:'9%',left:'50%'},{top:'27%',left:'10%'},{top:'65%',left:'11%'}];
// Portrait identity remains independent of AI playing style.
export function salonCharacter(portrait?:number){return portrait===8?'pink-glasses':portrait===6?'teal-twins':'hong';}
type SalonSeatView=Pick<SeatState,'name'|'stack'|'isUser'|'folded'|'persona'>&{holeCards:(Card|null)[]};
export function SalonSeat({seat,portrait,stackLabel,isActive,isDealer,isSmallBlind,isBigBlind,showCards,position}:{seat:SalonSeatView;portrait?:number;stackLabel?:string;isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;showCards:boolean;position:{top:string;left:string}}){
 const top=parseFloat(position.top),left=parseFloat(position.left),side=top>85?'self':top<12?'north':left<50?'west':'east',pose=side==='self'?'back':side==='north'?'front':side==='west'?'right':'left';
 const visible=seat.isUser||(showCards&&!seat.folded);
 return <section className={`salon-seat salon-seat-${side}${isActive?' salon-seat-active':''}${seat.folded?' salon-seat-folded':''}`} style={position} aria-label={`${seat.name} 잔고 ${stackLabel??seat.stack}`}>
  <div className="salon-guest"><img src={`/poker/${salonCharacter(portrait??seat.persona?.portrait)}-table/${pose}.png`} alt="" draggable={false}/>{seat.folded&&<span className="salon-fold">FOLD</span>}
   {(isDealer||isSmallBlind||isBigBlind)&&<b className={`salon-position ${isBigBlind?'bb':isSmallBlind?'sb':''}`}>{isBigBlind?'BB':isSmallBlind?'SB':'D'}</b>}
  </div>
  <div className="salon-seat-info"><strong>{seat.name}</strong><span>◈ {stackLabel??seat.stack.toLocaleString()}</span></div>
  <div className="salon-cards">{seat.isUser&&seat.holeCards.length>0&&(!seat.folded||seat.isUser)&&seat.holeCards.map((c,i)=><PlayingCard key={i} card={visible&&c?c:undefined} hidden={!visible||!c} size={seat.isUser?'md':'xs'}/>)}</div>
 </section>;
}
export function salonWagerPosition(p:{top:string;left:string}){
 const top=parseFloat(p.top),left=parseFloat(p.left);
 return top>85?{top:'65%',left:'50%'}:top<12?{top:'14%',left:'50%'}:{top:`${top}%`,left:left<50?'25%':'75%'};
}
