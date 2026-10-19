import {settleHand} from '../src/lib/poker-rules';
import {Card} from '../src/lib/poker-engine';
const holes=['AsAh','KsKh','QsQh'];
const suits:Record<string,Card['suit']>={s:'♠',h:'♥',d:'♦',c:'♣'};
const cards=(s:string):Card[]=>s.match(/../g)!.map(c=>({rank:c[0] as Card['rank'],suit:suits[c[1]]}));
const fixtures=[[5000,20000,20000],[20000,20000,20000],[5000,10000,20000],[15000,20000]].map((startingStacks,index)=>{
 const contributions=startingStacks;
 const seats=contributions.map((totalBet,seatId)=>({seatId,name:'P'+seatId,totalBet,currentBet:totalBet,
  stack:0,allIn:true,inHand:true,folded:false,holeCards:cards(holes[seatId])}));
 const result=settleHand(seats,cards('2c3d4c8h9d'),0);
 return {name:'all-in fixture '+index,startingStacks,holes:holes.slice(0,seats.length),streets:['2c3d4c','8h','9d'],
  expectedStacks:result.results.map(r=>r.payout),expectedProfits:result.results.map(r=>r.netProfit)};
});
console.log(JSON.stringify(fixtures));
