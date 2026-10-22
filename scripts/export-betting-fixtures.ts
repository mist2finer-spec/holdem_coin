import {StreetBetting} from '../src/lib/poker-betting';
import {minimumRaiseTo} from '../src/lib/poker-sizing';
import {applyLiveAction,normalizeLiveAction,postBlind} from '../src/lib/poker-live';
const cases=[{name:'single short all-in does not reopen',stacks:[5000,750,5000],actions:[[2,600],[0,600],[1,750],[2,750],[0,750]]},
 {name:'cumulative short all-ins reopen',stacks:[5000,5000,5000,750,1000],actions:[[2,600],[3,750],[4,1000],[0,1000],[1,1000],[2,1400]]}];
const output=cases.map(c=>{
 let seats=c.stacks.map((stack,seatId)=>({seatId,stack,currentBet:0,totalBet:0,inHand:true,folded:false,allIn:false,hasActed:false}));
 seats[0]=postBlind(seats[0],100);seats[1]=postBlind(seats[1],200);const round=new StreetBetting();
 const events=c.actions.map(([actor,target])=>{
  const s=seats[actor],highest=Math.max(200,...seats.map(s=>s.currentBet)),canRaise=round.canRaise(actor,highest)&&s.currentBet+s.stack>highest;
  const event={actor,target,call:Math.min(highest-s.currentBet,s.stack),canRaise,minTo:canRaise?Math.min(minimumRaiseTo(highest,200,round.lastFullRaise),s.currentBet+s.stack):null};
  const input=target>highest?{action:'raise',amount:target}:{action:'call',amount:0};
  const act=normalizeLiveAction(seats,actor,input,round.lastFullRaise,canRaise,200);if(!act)throw Error('Invalid fixture action');
  seats[actor]=applyLiveAction(s,act);round.record(actor,highest,Math.max(highest,seats[actor].currentBet));return event;
 });return {...c,events};
});console.log(JSON.stringify(output));
