export const SEAT_POSITIONS = [
  { top: "90%", left: "50%" }, { top: "78%", left: "88%" },
  { top: "45%", left: "93%" }, { top: "14%", left: "82%" },
  { top: "7%", left: "50%" }, { top: "14%", left: "18%" },
  { top: "45%", left: "7%" }, { top: "78%", left: "12%" },
];

export const SIX_SEAT_POSITIONS=[
 {top:'90%',left:'50%'},{top:'67%',left:'88%'},{top:'17%',left:'83%'},
 {top:'7%',left:'50%'},{top:'17%',left:'17%'},{top:'67%',left:'12%'},
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
