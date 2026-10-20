import type { BettingSeat } from './poker-rules';
import type { Card } from './poker-engine';
import { HandTier } from './equity-engine';

export function oopCheckMix(persona: {aggression: number; vpip: number}, tier: number, opponents: number, board: Card[]) {
  const strong = tier >= HandTier.TOP_PAIR;
  const base = strong ? (tier === HandTier.TOP_PAIR ? 0.45 : 0.40)
    : tier === HandTier.DRAW ? 0.35 : 0.65;
  const suits = board.map(c => c.suit);
  const ranks = [...new Set(board.map(c => '23456789TJQKA'.indexOf(c.rank)))].sort((a,b) => a-b);
  const wet = suits.some(suit => suits.filter(s => s === suit).length >= 3)
    || ranks.some((rank, i) => i >= 2 && rank - ranks[i-2] <= 4);
  return Math.max(0.15, Math.min(0.85, base + (0.5 - persona.aggression) * 0.20
    + (opponents > 1 ? 0.10 : 0) - (strong && wet ? 0.08 : 0)));
}

export interface PositionContext {
  isOOP: boolean;
  relativePosition: number;
  opponents: number;
  checkedThisStreet: boolean;
  preflopEquityPremium: number;
}

// Position is relative to players still able to bet, not a fixed half of the
// table. BTN has distance zero but acts LAST postflop (also in heads-up).
export function positionContext(
  seats: BettingSeat[], actorId: number, button: number, checkedThisStreet = false,
): PositionContext {
  const ringSize = Math.max(seats.length, ...seats.map(s => s.seatId + 1));
  const order = seats.filter(s => s.inHand && !s.folded && !s.allIn && s.stack > 0)
    .sort((a, b) => ((a.seatId - button - 1 + ringSize) % ringSize)
      - ((b.seatId - button - 1 + ringSize) % ringSize));
  const index = order.findIndex(s => s.seatId === actorId);
  const relativePosition = index < 0 || order.length < 2 ? 1 : index / (order.length - 1);
  return {
    isOOP: relativePosition < 1,
    relativePosition,
    opponents: Math.max(0, order.length - 1),
    checkedThisStreet,
    preflopEquityPremium: 0.07 * (1 - relativePosition),
  };
}
