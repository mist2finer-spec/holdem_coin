/** Legacy analysis interface, now strictly a public-range estimator.
 * Actual opponent hole cards never affect the result. Gameplay uses the shared
 * trainer/three-bet policy, not a private-card boolean override.
 */
import {estimateEquity,calledActionEV} from './poker-ai';
import type {BettingSeat} from './poker-rules';
import type {Card} from './poker-engine';
type Seat=BettingSeat & {isBot:boolean;holeCards:Card[]};
export const HUMAN_DEFENSE_THRESHOLD=.46;
export function humanDefenseEstimate(seats:Seat[],actorId:number,humanId:number){
 const actor=seats.find(s=>s.seatId===actorId),opponent=seats.find(s=>s.seatId===humanId);
 if(!actor?.isBot||!opponent||actor.holeCards.length!==2||actor.folded||!actor.inHand||actor.allIn||!opponent.inHand||opponent.folded)return null;
 const highest=Math.max(0,...seats.filter(s=>s.inHand&&!s.folded).map(s=>s.currentBet));
 const cost=Math.min(actor.stack,Math.max(0,highest-actor.currentBet));if(cost<=0||opponent.currentBet!==highest)return null;
 const publicSeats=seats.map(({seatId,stack,currentBet,totalBet,inHand,folded,allIn})=>({seatId,stack,currentBet,totalBet,inHand,folded,allIn}));
 const opponents=publicSeats.filter(s=>s.seatId!==actorId&&s.inHand&&!s.folded).length;
 return {equity:estimateEquity(actor.holeCards,[],opponents,384,'three-bet'),
  callEV:calledActionEV(actor.holeCards,[],{seats:publicSeats,actorId},cost,.05,'three-bet',384)};
}
export function allowHumanDefense(options:{seats:Seat[];actorId:number;humanId?:number;board:Card[];raiseLevel:number}){
 if(options.board.length||options.raiseLevel<1||options.humanId===undefined)return false;
 const result=humanDefenseEstimate(options.seats,options.actorId,options.humanId);
 return !!result&&result.equity>=HUMAN_DEFENSE_THRESHOLD&&result.callEV>0;
}
