import {gameStorage} from '../../src/lib/game-storage';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {RpgItemsStore} from '../../src/lib/rpg-items';
/** A seat binds once, at initial seating; names/reconnections cannot redirect a prize. */
export class TournamentRewards{
 readonly id=randomUUID();private accounts=new Map<number,string|null>();private paid=false;
 constructor(readonly store:RpgItemsStore){}
 bind(seat:number,link:unknown){if(this.accounts.has(seat))return;const account=this.store.resolve(link);this.accounts.set(seat,account);}
 releaseBeforeStart(seat:number){this.accounts.delete(seat);}
 settle(winner:{seatId:number}|null,seats:{seatId:number;isBot:boolean;stack:number}[]){
  if(this.paid||!winner)return false;const seat=seats.find(s=>s.seatId===winner.seatId);if(!seat||seat.isBot||seat.stack<=0||seats.filter(s=>s.stack>0).length!==1)return false;
  const account=this.accounts.get(seat.seatId);if(!account)return false;const awarded=this.store.awardChampion(this.id,account);this.paid=true;return awarded;
 }
}
let wallet:RpgItemsStore|undefined;
export function tournamentRewardWallet(){return wallet??(wallet=gameStorage().items);}
