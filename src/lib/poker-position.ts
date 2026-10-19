import type { BettingSeat } from './poker-rules';

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
