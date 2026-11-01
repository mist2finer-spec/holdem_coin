import {big, Decimal, type BigSource} from './combat-big';

/** Custom web balance. Native tanh contests are retained; these dungeon rates are not native/PoE data. */
export const HYBRID_BALANCE={
 version:1,source:'custom-vardian-poe-hybrid-v1',maxDifficulty:1_000_000,
 dailyXpCap:720,dailyGoldCap:8640,zoneXp:36,zoneGold:432,
 resistanceCap:.75,resistanceFloor:-.6,physicalCap:.75,
 hpPerDifficulty:1.004,attackPerDifficulty:1.002,
} as const;

export type HybridTraits={valor:number;mental:number;focus:number;tenacity:number};
export type HybridDefense=Partial<HybridTraits>&{
 traits?:Partial<HybridTraits>;physicalReduction?:number;elementalResistance?:number;chaosResistance?:number;
};
export type HybridMonster={
 hp:Decimal;attack:Decimal;traits:HybridTraits;physicalReduction:number;elementalResistance:number;
 chaosResistance:number;penetration:number;haste:number;mechanicTier:number;
};

/** All floating-point factors are bounded before they touch a Decimal combat amount. */
function finite(value:number|undefined,min:number,max:number,fallback=0){
 if(value===undefined||Number.isNaN(value))return fallback;
 return Math.max(min,Math.min(max,value));
}
export function dungeonDifficulty(value:number){
 if(!Number.isSafeInteger(value))throw Error('Invalid dungeon difficulty');
 return Math.max(1,Math.min(HYBRID_BALANCE.maxDifficulty,value));
}
const PACKS=[50,67,84,100,117,134,150,167,184,200] as const;

/** Difficulty belongs to the dungeon save, independently of account level (native max 7,800). */
export function dungeonProfile(value:number){
 const difficulty=dungeonDifficulty(value),n=difficulty-1,band=Math.min(9,Math.floor(n/100)),packMax=PACKS[band];
 return {
  difficulty,band:band+1,packMin:packMax,packMax,
  // Decimal exponentiation never projects an absolute combat value to Number.
  hpScale:Decimal.pow(HYBRID_BALANCE.hpPerDifficulty,n).mul(Math.pow(1+n/150,.6)),
  attackScale:Decimal.pow(HYBRID_BALANCE.attackPerDifficulty,n).mul(Math.pow(1+n/500,.35)),
  mechanicTier:Math.min(10,Math.floor(Math.log2(1+difficulty/1000))),
  haste:1+.35*(1-Math.exp(-n/3000)),penetration:.2*(1-Math.exp(-n/2000)),
 };
}

/** Exact zone target includes the boss; the client never adds a 201st monster. */
export function dungeonEncounter(value:number){
 const p=dungeonProfile(value),density=(p.packMax-50)/150;
 return {initial:Math.round(12+12*density),min:p.packMin,max:p.packMax,seconds:24+31*density,batch:Math.round(4+4*density)};
}

export function monsterProfile(value:number,species:number,boss=false,room=0):HybridMonster{
 const p=dungeonProfile(value),n=p.difficulty-1,zone=finite(room,0,9),heavy=[1102,1152,1153,1301].includes(species),
  magic=[1103,1153,1253].includes(species)||species>=1301&&species<=1323,
  physical=[1102,1152,1105,1155].includes(species),base=3*(Math.sqrt(p.difficulty)-1)+.06*n,
  traitScale=boss?1.2:1,traits={
   valor:base*traitScale*(physical?1.15:1),mental:base*traitScale*(magic?1.15:1),
   focus:base*traitScale,tenacity:base*traitScale*(boss?1.15:1),
  },roomScale=1+.015*zone;
 return {
  hp:p.hpScale.mul(boss?4000:heavy?130:100).mul(roomScale),
  attack:p.attackScale.mul(boss?350:65).mul(1+.01*zone),traits,
  physicalReduction:.6-(.6-(physical?.08:0))*Math.exp(-n/1000),
  elementalResistance:.75-(.75-(magic?.08:0))*Math.exp(-n/1400),
  chaosResistance:.75*(1-Math.exp(-n/2200)),
  penetration:p.penetration,haste:p.haste,mechanicTier:p.mechanicTier,
 };
}

function relative(attacker:number|undefined,defender:number|undefined,limit:number){
 return Math.tanh((finite(attacker,-1e9,1e9)-finite(defender,-1e9,1e9))/300*1.2)*limit;
}
/** Recovered native curve: Focus can reduce hit chance to 80%, never above 100%. */
export function hybridHitChance(attackerFocus=0,defenderFocus=0){return finite(1+relative(attackerFocus,defenderFocus,.2),.8,1,1);}
/** Recovered native Tenacity contest: duration is bounded to 50–150% of the base. */
export function hybridControlDuration(seconds:number,attackerTenacity=0,defenderTenacity=0){
 return finite(seconds,0,3600)*(1+relative(attackerTenacity,defenderTenacity,.5));
}
/** Physical Valor and magical Mental each affect both outgoing and incoming damage, ±20%. */
export function hybridTraitMultiplier(element:string,attacker:Partial<HybridTraits>={},defender:Partial<HybridTraits>={}){
 const key=element==='physical'?'valor':'mental';return 1+relative(attacker[key],defender[key],.2);
}
/** Cap the target's resistance first, then subtract penetration; a zero resist target can become vulnerable. */
export function hybridResistance(resistance=0,penetration=0){
 return finite(finite(resistance,HYBRID_BALANCE.resistanceFloor,HYBRID_BALANCE.resistanceCap)-finite(penetration,0,1),HYBRID_BALANCE.resistanceFloor,HYBRID_BALANCE.resistanceCap);
}
/** Player damage already includes tree increased/more modifiers. Apply this exactly once before settlement. */
export function hybridOutgoing(amount:BigSource,element:string,attacker:Partial<HybridTraits>,defender:HybridDefense,penetration=0){
 const value=big(amount);if(value.lt(0))throw Error('Negative hybrid damage');
 const traits=defender.traits??defender,
  reduction=element==='physical'?finite(defender.physicalReduction,0,HYBRID_BALANCE.physicalCap):
   hybridResistance(element==='chaos'?defender.chaosResistance:defender.elementalResistance,penetration);
 return big(value.mul(hybridTraitMultiplier(element,attacker,traits)).mul(1-reduction));
}
/** Incoming helper adds only the native contest: existing passive mitigation must still run exactly once. */
export function hybridIncoming(amount:BigSource,element:string,attacker:Partial<HybridTraits>,defender:Partial<HybridTraits>){
 const value=big(amount);if(value.lt(0))throw Error('Negative hybrid damage');
 return big(value.mul(hybridTraitMultiplier(element,attacker,defender)));
}

export function zoneRewardBudget(value:number){
 const difficulty=dungeonDifficulty(value),depthReward=Math.min(3,Math.log10(difficulty));
 // Distribute the factor before flooring: 36 * (1 + 2/3) rounds just below 60 in binary floats.
 const scaled=(base:number)=>Math.floor(base+base/3*depthReward);
 return {xp:scaled(HYBRID_BALANCE.zoneXp),gold:scaled(HYBRID_BALANCE.zoneGold)};
}
/** A cumulative difference distributes one fixed zone budget across actual kill transitions, without rounding loss. */
export function rewardForKill(value:number,killOrdinal:number,zoneTarget:number){
 if(!Number.isSafeInteger(zoneTarget)||zoneTarget<1||zoneTarget>200||!Number.isSafeInteger(killOrdinal)||killOrdinal<1||killOrdinal>zoneTarget)throw Error('Invalid hybrid kill ordinal');
 const budget=zoneRewardBudget(value),share=(amount:number)=>Math.floor(killOrdinal*amount/zoneTarget)-Math.floor((killOrdinal-1)*amount/zoneTarget);
 return {xp:share(budget.xp),gold:share(budget.gold)};
}
