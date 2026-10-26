/** Recovered CalcTanH substeps; not a replacement for all CalcFinalDamage branches. */
export function relativeStat(attacker:number,defender:number,kind:'Valor'|'Mental'|'Focus'|'Tenacity'){
 const limit=kind==='Tenacity'?.5:.2;
 return Math.tanh((attacker-defender)/300*1.2)*limit;
}
export const accuracy=(attacker:number,defender:number)=>Math.max(0,Math.min(1,1+relativeStat(attacker,defender,'Focus')));
export const effectDuration=(seconds:number,attacker:number,defender:number)=>Math.max(0,seconds*(1+relativeStat(attacker,defender,'Tenacity')));
