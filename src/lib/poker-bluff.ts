// Shared by the browser game and multiplayer server.
export interface BluffAggression { seatId: number; isBluff: boolean }
export interface BluffSeat { seatId: number; inHand: boolean; folded: boolean }

// Probability per eligible weak-hand decision, after strategy rotation.
export function bluffFrequency(persona: { aggression: number; bluffFreq: number }): number {
  return Math.min(1, Math.max(0, persona.bluffFreq, persona.aggression > 0.7 ? 0.20 : 0));
}

export function successfulBluff(
  seats: BluffSeat[], lastAggression: BluffAggression | null, isShowdown: boolean,
): number | null {
  const alive = seats.filter(s => s.inHand && !s.folded);
  return !isShowdown && alive.length === 1 && lastAggression?.isBluff &&
    alive[0].seatId === lastAggression.seatId ? alive[0].seatId : null;
}

export function bluffTaunt(name: string): string {
  return `🃏 ${name}: "패가 아니라 배짱으로 이겼지! 다음엔 콜해 봐."`;
}
