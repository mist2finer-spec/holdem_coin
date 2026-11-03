'use client';
import type {CSSProperties} from 'react';
import type {Card, SeatState} from '@/lib/poker-engine';
import {PlayingCard} from './PlayingCard';
import {PokerPlayerProfile,pokerProfile} from './PokerPlayerProfile';
export const SALON_EIGHT_POSITIONS=[{top:'89%',left:'50%'},{top:'70%',left:'87%'},{top:'50%',left:'87%'},{top:'30%',left:'87%'},{top:'10%',left:'50%'},{top:'30%',left:'13%'},{top:'50%',left:'13%'},{top:'70%',left:'13%'}];
export const SALON_SIX_POSITIONS=[{top:'89%',left:'50%'},{top:'65%',left:'87%'},{top:'35%',left:'87%'},{top:'10%',left:'50%'},{top:'35%',left:'13%'},{top:'65%',left:'13%'}];
export function salonCharacter(portrait?:number){return pokerProfile(portrait).id;}
type SalonSeatView=Pick<SeatState,'name'|'stack'|'isUser'|'folded'|'persona'>&{holeCards:(Card|null)[]};
export function SalonSeat({seat,portrait,level,stackLabel,isActive,isDealer,isSmallBlind,isBigBlind,showCards,position}:{seat:SalonSeatView;portrait?:number;level?:number;stackLabel?:string;isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;showCards:boolean;position:{top:string;left:string}}){
 const top=parseFloat(position.top),left=parseFloat(position.left),side=top>85?'self':top<15?'north':left<50?'west':'east';
 const visible=seat.isUser||(showCards&&!seat.folded);
 const identity=portrait??(seat.isUser?7:seat.persona?.portrait)??7;
 const style={'--profile-top':position.top,'--profile-left':position.left} as CSSProperties;
 return <section className={`salon-seat salon-seat-${side} poker-profile-seat${isActive?' salon-seat-active':''}${seat.folded?' salon-seat-folded':''}`} style={style} aria-label={`${seat.name} 잔고 ${stackLabel??seat.stack}`}>
  <PokerPlayerProfile portrait={identity} name={seat.name} chips={stackLabel??seat.stack.toLocaleString('en-US')} level={level} dealer={isDealer} blind={isBigBlind?'BB':isSmallBlind?'SB':undefined} active={isActive} folded={seat.folded}/>
  <div className={`poker-profile-cards${seat.isUser?' is-self':''}`}>
   {seat.holeCards.length>0&&(!seat.folded||seat.isUser)&&seat.holeCards.map((c,i)=><PlayingCard key={i} card={visible&&c?c:undefined} hidden={!visible||!c} size={seat.isUser?'md':'xs'}/>)}
  </div>
 </section>;
}
export function salonWagerPosition(p:{top:string;left:string}){
 const top=parseFloat(p.top),left=parseFloat(p.left);
 return top>85?{top:'62%',left:'50%'}:top<12?{top:'24%',left:'50%'}:{top:`${top}%`,left:left<50?'25%':'75%'};
}
