import type { Card } from './poker-engine';
import { HandTier } from './equity-engine';

export function boardIsWet(board:Card[]) {
  const ranks=[...new Set(board.map(c=>'23456789TJQKA'.indexOf(c.rank)))].sort((a,b)=>a-b);
  return board.some(c=>board.filter(x=>x.suit===c.suit).length>=3)
    || ranks.some((rank,i)=>i>=2&&rank-ranks[i-2]<=4);
}

export function continuationBetFrequency(persona:{aggression:number;bluffFreq:number},board:Card[],tier:number,opponents:number) {
  let rate=0.55+(persona.aggression-0.55)*0.5-Math.max(0,opponents-1)*0.10;
  rate+=boardIsWet(board)?-0.15:0.10;
  if(tier>=HandTier.TOP_PAIR)rate+=0.12;
  if(board.length===4&&tier<HandTier.TOP_PAIR)rate+=persona.aggression>=0.70?0.05:persona.aggression<0.40?-0.25:-0.10;
  if(board.length===5&&tier>=HandTier.TWO_PAIR_PLUS&&persona.bluffFreq>=0.20&&persona.aggression>=0.55)rate-=0.10;
  return Math.max(0.15,Math.min(0.85,rate));
}

export function checkCallEquityRequired(persona:{vpip:number},odds:number) {
  return Math.max(0,Math.min(1,odds+(0.45-persona.vpip)*0.15));
}
