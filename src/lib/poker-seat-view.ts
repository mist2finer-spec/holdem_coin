// View-only seat order: own seat remains index zero; game/action IDs are unchanged.
export const SEAT_POSITIONS = [
 {top:'92%',left:'50%'},{top:'76%',left:'88%'},
 {top:'48%',left:'90%'},{top:'21%',left:'83%'},
 {top:'8%',left:'50%'},{top:'21%',left:'17%'},
 {top:'48%',left:'10%'},{top:'76%',left:'12%'},
];
export const SIX_SEAT_POSITIONS=[
 {top:'92%',left:'50%'},{top:'68%',left:'88%'},{top:'27%',left:'86%'},
 {top:'8%',left:'50%'},{top:'27%',left:'14%'},{top:'68%',left:'12%'},
];
// Explicit inward lanes keep wagers off portraits and the central board.
export function wagerPosition(position:{top:string;left:string}) {
 const top=parseFloat(position.top),left=parseFloat(position.left);
 if(top>85)return {top:60,left:50,side:'self'};
 if(top<15)return {top:21,left:50,side:'north'};
 const west=left<50;
 return {top:top<35?28:top<73?56:76,left:top<35?(west?35:65):top<73?(west?30:70):(west?27:73),side:west?'west':'east'};
}
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
