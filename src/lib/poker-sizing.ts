// Table house rule: every full raise is at least twice the current highest
// street total. A shorter all-in is legal, but cannot exceed the player's stack.
export function minimumRaiseTo(highest:number,bigBlind=200) {
  return highest>0 ? highest*2 : bigBlind;
}
export function clampRaiseTo(min:number,max:number,target:number) {
  return Math.min(max,Math.max(min,Math.floor(target)));
}
export function raiseSizing(currentBet:number,call:number,stack:number,minRaise:number,maxRaise:number,tenths=30,bigBlind=200) {
  const highest=currentBet+call,base=highest>0?highest:bigBlind;
  const cap=Math.min(maxRaise,currentBet+stack);
  const canRaise=stack>call&&cap>highest;
  const maxTenths=Math.max(30,Math.ceil(cap/base*10));
  const selected=Math.max(30,Math.min(maxTenths,Math.round(tenths)));
  const target=clampRaiseTo(minRaise,cap,Math.ceil(base*selected/10));
  return {target,base,selected,maxTenths,canRaise,allIn:canRaise&&target>=currentBet+stack,
    label:`${selected%10===0?selected/10:(selected/10).toFixed(1)}X`};
}
