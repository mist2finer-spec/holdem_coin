import { Card, determineWinners } from './poker-engine';

export const RAKE_RATE = 0.05;
export interface BettingSeat {
  seatId: number; stack: number; currentBet: number; totalBet: number;
  inHand: boolean; folded: boolean; allIn: boolean;
}
export interface SettlementSeat extends BettingSeat { name: string; holeCards: Card[] }
export interface HandResult {
  seatId: number; name: string; contribution: number; payout: number;
  award: number; refund: number; netProfit: number;
}
export interface WinnerInfo {
  name: string; amount: number; hand: string; rake: number; results: HandResult[];
}
export interface PotLayer { amount: number; eligibleSeatIds: number[]; refundSeatId?: number }

export function contributionLayers(seats: Pick<BettingSeat,'seatId'|'totalBet'|'inHand'|'folded'>[]): PotLayer[] {
  for (const s of seats) if (!Number.isSafeInteger(s.totalBet) || s.totalBet < 0) throw new Error('Invalid contribution');
  const levels = [...new Set(seats.map(s => s.totalBet).filter(n => n > 0))].sort((a,b)=>a-b);
  const pots: PotLayer[] = [];
  let previous=0;
  for(const level of levels) {
    const contributors=seats.filter(s=>s.totalBet>=level);
    const amount=(level-previous)*contributors.length;
    previous=level;
    // Preserve ownership of unmatched chips; rake policy is applied separately.
    if(contributors.length===1) { pots.push({amount,eligibleSeatIds:[],refundSeatId:contributors[0].seatId});continue; }
    const eligibleSeatIds=contributors.filter(s=>s.inHand&&!s.folded).map(s=>s.seatId);
    if(!eligibleSeatIds.length) throw new Error('Contested pot has no eligible player');
    const last=pots[pots.length-1];
    if(last && last.refundSeatId===undefined && last.eligibleSeatIds.join(',')===eligibleSeatIds.join(',')) last.amount+=amount;
    else pots.push({amount,eligibleSeatIds});
  }
  return pots;
}

// House rule: tax ALL committed chips, including unmatched excess. Carry
// rounding between layers so the hand total is exactly floor(totalBet * rate).
// This is shared by settlement and expected-value projections.
export function rakedContributionLayers(seats: Parameters<typeof contributionLayers>[0], rate=RAKE_RATE) {
  if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('Invalid rake');
  let gross=0,charged=0;
  return contributionLayers(seats).map(layer=>{
    gross+=layer.amount;
    if(!Number.isSafeInteger(gross))throw new Error('Invalid total contribution');
    const cumulative=Math.floor(gross*rate),rake=cumulative-charged;
    charged=cumulative;
    return {...layer,rake};
  });
}

export function settleHand(seats: SettlementSeat[], board: Card[], buttonSeat: number, rakeRate=RAKE_RATE) {
  const results: HandResult[]=seats.map(s=>({seatId:s.seatId,name:s.name,contribution:s.totalBet,payout:0,award:0,refund:0,netProfit:0}));
  const byId=new Map(results.map(r=>[r.seatId,r]));
  let totalRake=0;
  const pots=rakedContributionLayers(seats,rakeRate).map(pot=>{
    const rake=pot.rake;
    totalRake+=rake;
    if(pot.refundSeatId!==undefined) {
      byId.get(pot.refundSeatId)!.refund+=pot.amount-rake;
      return {...pot,winnerSeatIds:[] as number[]};
    }
    const eligible=pot.eligibleSeatIds.map(id=>seats.find(s=>s.seatId===id)!);
    const winners=eligible.length===1?[eligible[0]]:determineWinners(eligible.map(s=>({holeCards:s.holeCards})),board).map(i=>eligible[i]);
    // Odd chips clockwise from the first seat after the button.
    winners.sort((a,b)=>((a.seatId-buttonSeat-1+seats.length)%seats.length)-((b.seatId-buttonSeat-1+seats.length)%seats.length));
    const net=pot.amount-rake,share=Math.floor(net/winners.length),odd=net-share*winners.length;
    winners.forEach((s,i)=>byId.get(s.seatId)!.award+=share+(i<odd?1:0));
    return {...pot,rake,winnerSeatIds:winners.map(s=>s.seatId)};
  });
  for(const r of results){r.payout=r.award+r.refund;r.netProfit=r.payout-r.contribution;}
  return {results,pots,totalRake,totalAward:results.reduce((n,r)=>n+r.award,0)};
}

export function hasBettingOpponent(seats: BettingSeat[], actorId: number) {
  return seats.some(s=>s.seatId!==actorId && s.inHand&&!s.folded&&!s.allIn&&s.stack>0);
}
export function bettingLocked(seats: BettingSeat[]) {
  const alive=seats.filter(s=>s.inHand&&!s.folded);
  if(alive.length<2)return false;
  const actors=alive.filter(s=>!s.allIn&&s.stack>0);
  const max=Math.max(0,...alive.map(s=>s.currentBet));
  return actors.length===0 || (actors.length===1 && actors[0].currentBet>=max);
}
export function dealNextStreet(board: Card[], deck: Card[]) {
  if(board.length===5)return {board:[...board],phase:'SHOWDOWN' as const};
  if(![0,3,4].includes(board.length))throw new Error('Invalid board length');
  const count=board.length===0?3:1;
  if(deck.length<count+1)throw new Error('Not enough cards');
  deck.pop();
  return {board:[...board,...Array.from({length:count},()=>deck.pop()!)],phase:(board.length===0?'FLOP':board.length===3?'TURN':'RIVER') as 'FLOP'|'TURN'|'RIVER'};
}
