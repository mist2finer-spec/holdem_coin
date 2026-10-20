import type { Card } from './poker-engine';
import { calledActionEV, type DecisionContext } from './poker-ai';
import { hasBettingOpponent, RAKE_RATE } from './poker-rules';

interface ShortSpot {
  hole: Card[]; board: Card[]; call: number; minRaise: number; maxRaise: number;
  pot: number; stack: number; currentBet: number; raiseLevel: number;
  persona: {vpip: number; aggression: number; bluffFreq: number}; context: DecisionContext;
}

export function shortStackOptions(spot: ShortSpot) {
  const {hole,board,call,minRaise,maxRaise,pot,stack,currentBet,raiseLevel,persona,context}=spot;
  const starting=context.stack?.ownStack ?? stack + context.seats.find(s=>s.seatId===context.actorId)!.totalBet;
  const highest=currentBet+call;
  if(board.length || starting>5000 || call<=0 || call>=stack || raiseLevel!==1
      || highest<400 || highest>600 || !hasBettingOpponent(context.seats,context.actorId))return null;
  const opponents=context.seats.filter(s=>s.seatId!==context.actorId&&s.inHand&&!s.folded);
  const canMakeFold=!opponents.some(s=>s.allIn);
  // Fold equity is a bounded model assumption, not knowledge of a CPU's hand.
  const raiseEV=(target:number)=>{
    const cost=Math.min(stack,target-currentBet);
    const called=calledActionEV(hole,board,context,cost,RAKE_RATE,'jam-call');
    const foldProbability=canMakeFold ? Math.pow(Math.min(0.45,0.25+(target-highest)/Math.max(1,highest)*0.05),opponents.length) : 0;
    return foldProbability*pot*(1-RAKE_RATE)+(1-foldProbability)*called;
  };
  const callCost=Math.min(call,stack);
  const called=calledActionEV(hole,board,context,callCost,RAKE_RATE,'open');
  const realization=context.position?.isOOP ? 0.70 : 0.85;
  const callEV=(called+callCost)*realization-callCost;
  const raiseTo=Math.min(maxRaise,Math.max(minRaise,highest*3));
  const raiseCost=raiseTo-currentBet;
  const jamEV=raiseEV(maxRaise);
  const strongRaiseEV=raiseEV(raiseTo);
  const ranks=hole.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
  const [high,low]=ranks, pair=high===low, suited=hole[0].suit===hole[1].suit;
  const playable=(pair&&low>=4) || (high===12&&low>=10)
    || (suited&&high===12&&low>=9&&persona.vpip>=0.25)
    || (suited&&high===11&&low===10&&persona.aggression>=0.5)
    || (high===11&&low===10&&persona.vpip>=0.30&&persona.aggression>=0.70)
    || (suited&&high===10&&low===9&&persona.vpip>=0.40&&persona.aggression>=0.75);
  return {callEV,jamEV,strongRaiseEV,raiseTo,raiseCost,playable,starting};
}

export function decideShortStack(spot: ShortSpot): {action:number;amount:number;isBluff?:boolean} | null {
  const options=shortStackOptions(spot);
  if(!options)return null;
  // Narrow entry range first; aggression is conditional on having a suitable
  // hand. A short stack is not permission to shove arbitrary weak broadways.
  if(!options.playable)return {action:0,amount:0};
  const choices:{action:number;amount:number;ev:number}[]=[];
  if(options.jamEV>0)choices.push({action:4,amount:spot.maxRaise,ev:options.jamEV});
  // Avoid committing most of the stack with a nominal non-all-in raise.
  if(options.raiseCost<spot.stack*0.70 && options.raiseTo<spot.maxRaise && options.strongRaiseEV>0)
    choices.push({action:2,amount:options.raiseTo,ev:options.strongRaiseEV});
  choices.sort((a,b)=>b.ev-a.ev);
  const best=choices[0];
  if(best && best.ev>=Math.max(0,options.callEV)-spot.pot*0.10) {
    if(Math.random()<0.70+spot.persona.aggression*0.20) {
      // At <= 12.5BB, favor a positive-EV shove over a near-equivalent re-raise.
      const jam=choices.find(c=>c.action===4);
      const chosen=options.starting<=2500 && jam && jam.ev>=best.ev-spot.pot*0.10 ? jam : best;
      return {action:chosen.action,amount:chosen.amount,isBluff:false};
    }
  }
  const ranks=spot.hole.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
  const premium=(ranks[0]===ranks[1]&&ranks[0]>=9)||(ranks[0]===12&&ranks[1]===11);
  if(premium && best)return {action:best.action,amount:best.amount,isBluff:false};
  if(options.callEV>0 && Math.random()<0.20+spot.persona.vpip*0.35)
    return {action:1,amount:Math.min(spot.call,spot.stack)};
  return {action:0,amount:0};
}
