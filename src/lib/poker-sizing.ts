// Table house rule: every full raise is at least twice the current highest
// street total. A shorter all-in is legal, but cannot exceed the player's stack.
export function minimumRaiseTo(highest:number,bigBlind=200) {
  return highest>0 ? highest*2 : bigBlind;
}
export function clampRaiseTo(min:number,max:number,target:number) {
  return Math.min(max,Math.max(min,Math.floor(target)));
}
export function raiseSizing(currentBet:number,call:number,stack:number,minRaise:number,maxRaise:number,tenths=20,bigBlind=200) {
  const highest=currentBet+call,base=highest>0?highest:bigBlind;
  const cap=Math.min(maxRaise,currentBet+stack);
  const canRaise=stack>call&&cap>highest;
  const maxTenths=Math.max(20,Math.ceil(cap/base*10));
  const selected=Math.max(20,Math.min(maxTenths,Math.round(tenths)));
  const target=clampRaiseTo(minRaise,cap,Math.ceil(base*selected/10));
  return {target,base,selected,maxTenths,canRaise,allIn:canRaise&&target>=currentBet+stack,
    label:`${selected%10===0?selected/10:(selected/10).toFixed(1)}X`};
}

// Fractions refer strictly to the displayed pot and produce STREET TOTALS.
// Never silently turn a fraction below the house minimum into a larger raise.
export function potFractionSizing(currentBet:number,call:number,stack:number,minRaise:number,maxRaise:number,pot:number,fraction:number) {
  const highest=currentBet+call,cap=Math.min(maxRaise,currentBet+stack);
  const requested=Math.floor(pot*fraction),target=Math.min(cap,requested);
  const allIn=stack>call&&cap>highest&&target>=currentBet+stack;
  const belowMinimum=target<minRaise&&!allIn;
  const canRaise=stack>call&&cap>highest&&target>highest&&!belowMinimum;
  return {target,requested,canRaise,allIn:canRaise&&allIn,belowMinimum};
}
