import type { Card } from './poker-engine';
import { calledActionEV, type DecisionContext } from './poker-ai';
import { hasBettingOpponent, RAKE_RATE } from './poker-rules';
import { connectorAllowed } from './poker-preflop';

interface ShortSpot {
  hole: Card[]; board: Card[]; call: number; minRaise: number; maxRaise: number;
  pot: number; stack: number; currentBet: number; raiseLevel: number;
  persona: {vpip: number; aggression: number; bluffFreq: number}; context: DecisionContext;
}

export function shortStackOptions(spot: ShortSpot) {
  const {hole,board,call,minRaise,maxRaise,pot,stack,currentBet,raiseLevel,persona,context}=spot;
  const starting=context.stack?.ownStack ?? stack + context.seats.find(s=>s.seatId===context.actorId)!.totalBet;
  const highest=currentBet+call;
  const threeBet=raiseLevel===2&&context.openedPreflop===true;
  const canRaise=hasBettingOpponent(context.seats,context.actorId)&&maxRaise>highest&&stack>call;
  if(board.length || starting>(threeBet?10000:5000) || call<=0 || (!threeBet && (call>=stack || raiseLevel!==1
      || highest<400 || highest>600 || !canRaise)))return null;
  const ranks=hole.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
  const [high,low]=ranks, pair=high===low, suited=hole[0].suit===hole[1].suit;
  const opponents=context.seats.filter(s=>s.seatId!==context.actorId&&s.inHand&&!s.folded);
  const canMakeFold=!opponents.some(s=>s.allIn);
  // Fold equity is a bounded model assumption, not knowledge of a CPU's hand.
  const raiseEV=(target:number)=>{
    if(!canRaise)return Number.NEGATIVE_INFINITY;
    const cost=Math.min(stack,target-currentBet);
    const called=calledActionEV(hole,board,context,cost,RAKE_RATE,threeBet&&starting>5000?'four-bet-call':'jam-call',threeBet?768:192);
    const perOpponent=threeBet ? Math.min(0.20,0.08+(target-highest)/Math.max(1,highest)*0.04)
      : Math.min(0.45,0.25+(target-highest)/Math.max(1,highest)*0.05);
    const committed=opponents.some(s=>s.currentBet/Math.max(1,s.stack+s.totalBet)>=0.40);
    const foldProbability=canMakeFold ? Math.pow(threeBet&&committed?Math.min(0.10,perOpponent):perOpponent,opponents.length) : 0;
    return foldProbability*pot*(1-RAKE_RATE)+(1-foldProbability)*called;
  };
  const callCost=Math.min(call,stack);
  const called=calledActionEV(hole,board,context,callCost,RAKE_RATE,threeBet?(opponents.some(s=>s.allIn)?'jam-call':'three-bet'):'open',threeBet?768:192);
  const spr=Math.max(0,stack-callCost)/Math.max(1,pot+callCost);
  const realization=callCost===stack?1:threeBet
    ? (context.position?.isOOP ? (spr<=1?0.96:0.86) : (spr<=1?0.99:0.94))
    : context.isBlind&&pair&&low<4 ? (context.position?.isOOP ? 0.85 : 0.92)
    : context.position?.isOOP ? 0.70 : 0.85;
  const riskPremium=threeBet ? ((context.stack?.equityPremium||0)*0.25
    +(context.position?.preflopEquityPremium||0)*0.30)*(pot+callCost)*(1-RAKE_RATE) : 0;
  const callEV=(called+callCost)*realization-callCost-riskPremium;
  const raiseTo=Math.min(maxRaise,Math.max(minRaise,Math.floor(highest*(threeBet?2.2:3))));
  const raiseCost=raiseTo-currentBet;
  const jamEV=raiseEV(maxRaise);
  const strongRaiseEV=raiseEV(raiseTo);
  // Small pairs may defend an actual blind at an affordable price; they do
  // not acquire the ordinary non-blind reshove range simply by being pairs.
  const blindPairDefense=!threeBet&&context.isBlind===true&&pair&&low<4
    &&callCost<=starting*0.20;
  let playable=blindPairDefense||(pair&&low>=4) || (high===12&&low>=10)
    || (suited&&high===12&&low>=9&&persona.vpip>=0.25)
    || (suited&&high===11&&low===10&&persona.aggression>=0.5)
    || (high===11&&low===10&&persona.vpip>=0.30&&persona.aggression>=0.70)
    || (suited&&high===10&&low===9&&persona.vpip>=0.40&&persona.aggression>=0.75);
  if(threeBet) {
    const affordable=callCost<=starting*0.30;
    playable=(pair&&low>=6)||(high===12&&low>=10)
      ||(pair&&low>=4&&(persona.vpip>=0.30||starting<=2500))
      ||(pair&&persona.vpip>=0.48&&callCost<=starting*0.12)
      ||(suited&&high===12&&low>=7&&persona.vpip>=0.28)
      ||(suited&&high===12&&low===3&&persona.aggression>=0.75&&persona.bluffFreq>=0.20&&affordable)
      ||(suited&&high>=10&&low>=9&&persona.vpip>=0.28)
      ||(high===11&&low===10&&persona.vpip>=0.38&&persona.aggression>=0.50&&affordable)
      ||(starting>2500&&affordable&&connectorAllowed(hole,persona));
  }
  return {callEV,jamEV,strongRaiseEV,raiseTo,raiseCost,playable,starting,threeBet,canRaise,spr,blindPairDefense};
}

export function decideShortStack(spot: ShortSpot): {action:number;amount:number;isBluff?:boolean} | null {
  const options=shortStackOptions(spot);
  if(!options)return null;
  // Narrow entry range first; aggression is conditional on having a suitable
  // hand. A short stack is not permission to shove arbitrary weak broadways.
  if(!options.playable)return {action:0,amount:0};
  if(options.threeBet) {
    const candidates:{action:number;amount:number;ev:number}[]=[];
    if(options.callEV>0)candidates.push({action:1,amount:Math.min(spot.call,spot.stack),ev:options.callEV});
    const raiseMargin=(cost:number)=>Math.max(spot.pot*0.03,cost*0.04);
    if(options.jamEV>raiseMargin(spot.stack)&&options.canRaise)candidates.push({action:4,amount:spot.maxRaise,ev:options.jamEV});
    if(options.canRaise&&options.raiseTo<spot.maxRaise&&options.raiseCost<spot.stack*0.70&&options.strongRaiseEV>raiseMargin(options.raiseCost))
      candidates.push({action:2,amount:options.raiseTo,ev:options.strongRaiseEV});
    candidates.sort((a,b)=>b.ev-a.ev);
    const best=candidates[0];
    if(!best)return {action:0,amount:0};
    const ranks=spot.hole.map(c=>'23456789TJQKA'.indexOf(c.rank)).sort((a,b)=>b-a);
    const premium=(ranks[0]===ranks[1]&&ranks[0]>=9)||(ranks[0]===12&&ranks[1]===11);
    const continueRate=premium||best.ev>=spot.pot*0.25?1:Math.max(0.65,Math.min(0.99,0.65+best.ev/Math.max(1,spot.pot)*1.5
      +spot.persona.vpip*0.15-spot.persona.aggression*0.06+(spot.context.position?.isOOP?0:0.08)));
    if(Math.random()>=continueRate)return {action:0,amount:0};
    const near=candidates.filter(c=>c.ev>=best.ev-spot.pot*0.08);
    const weight=(action:number)=>action===1?1.5-spot.persona.aggression*0.5+spot.persona.vpip*0.6
      :action===4?0.4+spot.persona.aggression+(options.starting<=2000?0.7:0):0.4+spot.persona.aggression*0.8;
    let roll=Math.random()*near.reduce((sum,c)=>sum+weight(c.action),0);
    for(const c of near){roll-=weight(c.action);if(roll<=0)return {action:c.action,amount:c.amount,isBluff:false};}
    return {action:best.action,amount:best.amount,isBluff:false};
  }
  if(options.blindPairDefense) {
    return options.callEV>0&&Math.random()<Math.min(0.85,0.45+spot.persona.vpip*0.60)
      ? {action:1,amount:Math.min(spot.call,spot.stack)} : {action:0,amount:0};
  }
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
