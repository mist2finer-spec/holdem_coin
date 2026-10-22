"use client";
import type {Card} from '@/lib/poker-engine';
import type {CSSProperties} from 'react';
import {PlayingCard} from './PlayingCard';
import {CharacterPortrait} from './CharacterPortrait';
export function IslandSeat({name,stack,holeCards,folded,isMe,portrait=4,isActive,isDealer,isSmallBlind,isBigBlind,showCards,position}:{
 name:string;stack:number;holeCards:(Card|null)[];folded:boolean;isMe:boolean;portrait?:number;
 isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;showCards:boolean;
 position:{top:string;left:string};
}) {
 const top=parseFloat(position.top),left=parseFloat(position.left);
 const side=isMe?'self':top<25?'north':left<50?'west':'east';
 const visible=isMe||(showCards&&!folded);
 return <div className={`island-seat island-seat-${side} ${isActive?'island-seat-active':''} ${folded?'island-seat-folded':''}`}
 style={{top:position.top,left:position.left} as CSSProperties} aria-label={`${name} 잔고 ${stack}`}>
  <div className="island-seat-person">
   <div className="island-avatar"><CharacterPortrait portrait={portrait} name={name}/>{folded&&<span className="island-fold">FOLD</span>}
    {(isDealer||isSmallBlind||isBigBlind)&&<span className={`island-position ${isBigBlind?'bb':isSmallBlind?'sb':''}`}>{isBigBlind?'BB':isSmallBlind?'SB':'D'}</span>}
   </div>
   <div className="island-seat-info"><div className="island-seat-name">{name}</div>
   <div className="island-seat-stack">◈ {stack.toLocaleString()}</div></div>
  </div>
  <div className="island-hole-cards">
   {holeCards.length>0&&(!folded||isMe)&&holeCards.map((c,i)=><PlayingCard key={i} card={visible&&c?c:undefined} hidden={!visible||!c} size="xs"/>)}
  </div>
 </div>;
}
