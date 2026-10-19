export const SEAT_POSITIONS = [
  { top: "90%", left: "50%" }, { top: "78%", left: "88%" },
  { top: "45%", left: "93%" }, { top: "14%", left: "82%" },
  { top: "7%", left: "50%" }, { top: "14%", left: "18%" },
  { top: "45%", left: "7%" }, { top: "78%", left: "12%" },
];

export function rotateSeatView<T extends { seatId: number }>(seats: T[], mySeatId: number) {
  const offset = Math.max(0, mySeatId);
  return seats.map((_, index) => ({
    ...seats[(index + offset) % seats.length],
    seatId: index,
    isMe: mySeatId >= 0 && index === 0,
    position: SEAT_POSITIONS[index],
  }));
}
