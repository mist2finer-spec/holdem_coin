"use client";
import type {SeatState} from '@/lib/poker-engine';
import {IslandSeat} from './IslandSeat';
interface Props {seat:SeatState;isActive:boolean;isDealer:boolean;isSmallBlind:boolean;isBigBlind:boolean;
 showCards:boolean;position:{top:string;left:string};}
export function PlayerSeat({seat,...props}:Props) {
 return <IslandSeat {...props} name={seat.name} stack={seat.stack} holeCards={seat.holeCards}
 folded={seat.folded} isMe={seat.isUser} portrait={seat.isUser?4:seat.persona?.portrait}/>;
}
