// View-only seat order: own seat remains index zero; game/action IDs are unchanged.
export const SEAT_POSITIONS = [
 {top:'92%',left:'12%'},{top:'83%',left:'80%'},
 {top:'59%',left:'88%'},{top:'32%',left:'88%'},
 {top:'9%',left:'68%'},{top:'9%',left:'32%'},
 {top:'32%',left:'12%'},{top:'59%',left:'12%'},
];
export const SIX_SEAT_POSITIONS=[
 {top:'92%',left:'12%'},{top:'86%',left:'78%'},{top:'46%',left:'88%'},
 {top:'10%',left:'68%'},{top:'10%',left:'32%'},{top:'46%',left:'12%'},
];
export function rotateSeatView<T extends { seatId: number }>(seats: T[], mySeatId: number) {
  const offset = Math.max(0, mySeatId);
  return seats.map((_, index) => ({
    ...seats[(index + offset) % seats.length],
    originalSeatId: seats[(index + offset) % seats.length].seatId,
    seatId: index,
    isMe: mySeatId >= 0 && index === 0,
    position: (seats.length===6?SIX_SEAT_POSITIONS:SEAT_POSITIONS)[index],
  }));
}
