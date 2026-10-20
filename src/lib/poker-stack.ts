import type { BettingSeat } from './poker-rules';

export const STACK_BANDS = [
  { limit: 1000, vpip: -0.16, aggression: 0, bluff: -0.05, equity: 0.10 },
  { limit: 2000, vpip: -0.12, aggression: 0, bluff: -0.04, equity: 0.08 },
  { limit: 5000, vpip: -0.08, aggression: 0, bluff: -0.03, equity: 0.06 },
  { limit: 10000, vpip: -0.04, aggression: 0, bluff: -0.02, equity: 0.04 },
  { limit: 15000, vpip: -0.02, aggression: 0, bluff: -0.01, equity: 0.02 },
  // The neutral band ends just before 25k; the aggression boost starts at 25k exactly.
  { limit: 25000, exclusive: true, vpip: 0, aggression: 0, bluff: 0, equity: 0 },
  { limit: Infinity, vpip: 0, aggression: 0.08, bluff: 0, equity: 0 },
] as const;

export function stackBand(startingChips: number) {
  return STACK_BANDS.find(band => ('exclusive' in band ? startingChips < band.limit : startingChips <= band.limit)) || STACK_BANDS[STACK_BANDS.length - 1];
}

export function applyStackTraits<T extends {vpip: number; aggression: number; bluffFreq: number}>(persona: T, startingChips: number): T {
  const band = stackBand(startingChips);
  return { ...persona,
    vpip: Math.max(0.05, Math.min(0.90, persona.vpip + band.vpip)),
    aggression: Math.max(0.05, Math.min(0.95, persona.aggression + band.aggression)),
    bluffFreq: Math.max(0.005, Math.min(0.55, persona.bluffFreq + band.bluff)),
  };
}

export function stackContext(seats: BettingSeat[], actorId: number) {
  const actor = seats.find(s => s.seatId === actorId)!;
  const ownStack = actor.stack + actor.totalBet;
  const opponentStack = Math.max(0, ...seats.filter(s => s.seatId !== actorId && s.inHand && !s.folded)
    .map(s => s.stack + s.totalBet));
  const effectiveStack = Math.min(ownStack, opponentStack);
  const deepVsDeep = effectiveStack > 15000;
  return { ownStack, effectiveStack, deepVsDeep,
    equityPremium: stackBand(ownStack).equity + (deepVsDeep ? 0.015 : 0) };
}
