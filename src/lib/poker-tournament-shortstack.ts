import type {Card} from './poker-engine';
import type {LiveAction} from './poker-live';
import {estimateEquity} from './poker-ai';
import {pricedCallEquity} from './poker-priced-call';
import {contributionLayers,hasBettingOpponent,type BettingSeat} from './poker-rules';

type Spot={actor:BettingSeat&{holeCards:Card[]};seats:BettingSeat[];board:Card[];
 bigBlind:number;minRaise:number;maxRaise:number;raiseLevel:number};
/** Tournament chip-EV policy. No persona, private opponent cards or cash-stack thresholds. */
export function tournamentShortStack(spot:Spot,fallback?:LiveAction){
 const {actor,seats,board,bigBlind,minRaise,maxRaise,raiseLevel}=spot;
 if(!Number.isFinite(bigBlind)||bigBlind<=0||actor.stack<=0||actor.allIn||actor.folded||!actor.inHand||actor.holeCards.length!==2)return null;
 const stackBB=(actor.stack+actor.totalBet)/bigBlind;
 if(stackBB>10)return null;
 const opponents=seats.filter(s=>s.seatId!==actor.seatId&&s.inHand&&!s.folded);
 if(!opponents.length)return null;
 const remaining=seats.filter(s=>s.stack+s.totalBet>0).length;
 const highest=Math.max(actor.currentBet,...opponents.map(s=>s.currentBet));
 const cost=Math.min(actor.stack,Math.max(0,highest-actor.currentBet));
 const band=stackBB<=3?3:stackBB<=5?5:10;
 const projected=seats.map(s=>({...s,totalBet:s.totalBet+(s.seatId===actor.seatId?cost:0)}));
 const eligiblePot=contributionLayers(projected).filter(p=>p.eligibleSeatIds.includes(actor.seatId)).reduce((n,p)=>n+p.amount,0);
 const required=cost/Math.max(1,eligiblePot);
 const audit={band,stackBB,remaining,costBB:cost/bigBlind,requiredEquity:required,eligiblePot};
 const result=(action:LiveAction,path:string,equity?:number)=>({action,audit:{...audit,path,equity}});
 const call=():LiveAction=>({action:cost>=actor.stack?'allin':'call',amount:cost});
 // Postflop only rescues a fold. Never replace a profitable value raise.
 if(board.length){
  if(fallback?.action!=='fold')return null;
  if(cost===0)return result({action:'check',amount:0},'tournament-free-check');
  if(cost>bigBlind*.5||required>.15)return null;
  const equity=pricedCallEquity(actor.holeCards,board,opponents.length);
  return equity>=required+.02?result(call(),'tournament-priced-postflop-call',equity):null;
 }
 const ranks=actor.holeCards.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
 const [hi,lo]=ranks,pair=hi===lo,suited=actor.holeCards[0].suit===actor.holeCards[1].suit;
 const connector=suited&&hi-lo<=2&&lo>=2,ace=hi===12;
 const hu=remaining===2,short=remaining<=4;
 const playable=band===3 ? hu||pair||ace||(hi===11&&(short||lo>=6))||(hi>=9&&lo>=7)||(suited&&short)
  :band===5 ? pair||ace||(hi===11&&(hu||lo>=(short?4:7)))||(hi===10&&lo>=(hu?2:6))||(hi>=8&&lo>=6)||connector
  :pair||(ace&&(short||suited||lo>=6))||(hi===11&&lo>=(hu?0:7))||(hi>=9&&lo>=(hu?5:7))||connector;
 const canRaise=maxRaise>highest&&actor.stack>cost&&hasBettingOpponent(seats,actor.seatId);
 const jam=():LiveAction=>({action:'allin',amount:actor.stack});
 const unopened=raiseLevel===0&&highest<=bigBlind;
 if(unopened&&playable&&canRaise){
  if(band<=5)return result(jam(),'tournament-short-open-jam');
  const to=Math.min(maxRaise,Math.max(minRaise,Math.round(bigBlind*2.5)));
  return result(to>=actor.currentBet+actor.stack?jam():{action:'raise',amount:to},'tournament-short-open-raise');
 }
 if(cost===0)return result({action:'check',amount:0},'tournament-free-check');
 // Actual chip prices, not rounded 200-BB cash proxies. Tiny calls cannot be
 // rejected by persona/range gates. Large side pots cannot inflate these odds.
 if(cost<=bigBlind*.1||(cost<=bigBlind*.5&&required<=.12))return result(call(),'tournament-tiny-call');
 const range=short?'wide-three-bet':raiseLevel>=2?'three-bet':'open';
 const equity=estimateEquity(actor.holeCards,[],opponents.length,256,range);
 const locked=cost===actor.stack||opponents.every(s=>s.allIn||s.stack===0);
 const realized=equity*(locked?1:.93);
 if(realized>=required+.01){
  const premium=(pair&&lo>=8)||(ace&&lo>=10);
  if(canRaise&&playable&&(band<=5||premium)&&realized>=required+.08)return result(jam(),'tournament-short-reshove',equity);
  return result(call(),'tournament-short-priced-call',equity);
 }
 return result({action:'fold',amount:0},'tournament-short-price-fold',equity);
}
