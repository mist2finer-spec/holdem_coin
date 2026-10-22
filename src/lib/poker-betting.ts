import type {ActionType} from './poker-engine';
/** Per-street betting rights, independent of the turn/needs-action flag. */
export class StreetBetting {
 lastFullRaise: number;
 private acted = new Map<number,{at:number;checked:boolean}>();
 constructor(readonly bigBlind=200){this.lastFullRaise=bigBlind;}
 canRaise(seatId:number,highest:number){
  const previous=this.acted.get(seatId);
  return !previous || (previous.checked&&previous.at===0) || highest-previous.at>=this.lastFullRaise;
 }
 record(seatId:number,before:number,after:number){
  const increase=after-before;
  const fullRaise=increase>=this.lastFullRaise;
  if(fullRaise)this.lastFullRaise=increase;
  this.acted.set(seatId,{at:after,checked:before===0&&after===0});
  return fullRaise;
 }
}
/** Keep transport commands backward compatible; history distinguishes opening bets. */
export function recordedAction(action:ActionType,highest:number,boardLength:number):ActionType|'bet'{
 return action==='raise'&&boardLength>=3&&highest===0?'bet':action;
}
