/** The denominator is captured at cast time, never inferred from the current build. */
export function skillCooldown(remaining:number,total:number){
 const left=Number.isFinite(remaining)?Math.max(0,remaining):0;
 const duration=Number.isFinite(total)&&total>0?total:left;
 return {cooling:left>0,remaining:left,fraction:duration?Math.min(1,left/duration):0,label:left>0?(left<1?left.toFixed(1):String(Math.ceil(left))):''};
}
