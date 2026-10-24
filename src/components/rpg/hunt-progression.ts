/** Web adaptation. Native curve arithmetic recovered; reward/stat balance is provisional. */
export type Curve={min:number;max:number;base:number;inc:number;rate:number;scaler:number};
export type HuntBalance={version:1;source:string;maxLevel:number;team:Curve[];weapon:Curve[];armor:Curve[];reward:{gold:number;xp:number;soulGem:number}};
export const DEFAULT_HUNT_BALANCE:HuntBalance={version:1,source:'web-adapter-with-recovered-first-curve',maxLevel:50,
 team:[{min:1,max:50,base:1000,inc:100,rate:7000,scaler:1000}],
 weapon:[{min:1,max:50,base:40,inc:2,rate:420,scaler:1000}],
 armor:[{min:1,max:50,base:400,inc:5,rate:70,scaler:1000}],reward:{gold:25,xp:12,soulGem:2}};
export type HuntProgress={level:number;xp:number;gold:number;soulGem:number;kills:number;weaponLevel:number;armorLevel:number;potions:number;questTier:number};
export const newHuntProgress=():HuntProgress=>({level:1,xp:0,gold:0,soulGem:0,kills:0,weaponLevel:1,armorLevel:1,potions:3,questTier:0});
export const HUNT_QUESTS=[{name:'숲의 첫걸음',kills:5,gold:50,soulGem:10},{name:'슬라임 정리',kills:20,gold:150,soulGem:20},{name:'숲의 수호자',kills:50,gold:400,soulGem:40}] as const;
export const POTION_PRICE=50;
/** Prototype item economy: distinct from the recovered native cost curve. */
export function buyHuntPotion(p:HuntProgress){if(p.potions>=99)throw Error('물약은 최대 99개까지 보관할 수 있습니다.');if(p.gold<POTION_PRICE)throw Error('골드가 부족합니다.');p.gold-=POTION_PRICE;p.potions++;}
export function claimHuntQuest(p:HuntProgress){const q=HUNT_QUESTS[p.questTier];if(!q)throw Error('모든 사냥 의뢰를 완료했습니다.');if(p.kills<q.kills)throw Error('사냥 의뢰 목표를 먼저 달성해 주세요.');
 p.gold=Math.min(1e12,p.gold+q.gold);p.soulGem=Math.min(1e12,p.soulGem+q.soulGem);p.questTier++;}
export function curveValue(curves:readonly Curve[],level:number){
 if(!Number.isInteger(level))throw Error('Invalid level');
 const c=curves.find(c=>level>=c.min&&level<c.max);if(!c||!c.scaler)return 0;
 const floor=Math.floor,n=Math.fround(level-c.min);
 const q=floor(floor(floor(floor(c.rate*n)*n)+floor(c.scaler*.5))/c.scaler);
 const value=floor(floor(c.inc*n)+floor(c.base+q));
 if(!Number.isSafeInteger(value)||value<0)throw Error('Unsafe curve value');return value;
}
export function awardHuntKill(p:HuntProgress,balance:HuntBalance){
 const {gold,xp,soulGem}=balance.reward;
 p.gold=Math.min(1e12,p.gold+gold);p.soulGem=Math.min(1e12,p.soulGem+soulGem);p.kills=Math.min(1e12,p.kills+1);
 p.xp=Math.min(1e12,p.xp+xp);
 while(p.level<balance.maxLevel){const required=curveValue(balance.team,p.level);if(required<=0||p.xp<required)break;p.xp-=required;p.level++;}
 if(p.level>=balance.maxLevel)p.xp=0;
}
export function upgradeHunt(p:HuntProgress,balance:HuntBalance,slot:'weapon'|'armor'){
 const key=slot==='weapon'?'weaponLevel':'armorLevel',cost=curveValue(balance[slot],p[key]);
 if(cost<=0)throw Error('최대 강화 단계이거나 비용 설정이 없습니다.');
 if(p.soulGem<cost)throw Error('영혼석이 부족합니다.');
 p.soulGem-=cost;p[key]++;return cost;
}
export function heroStats(p:HuntProgress){return {maxHP:10_000,
 attack:20+(p.level-1)*1.5+(p.weaponLevel-1)*2,defense:2+(p.armorLevel-1)*1.5,crit:.1,critMultiplier:1.5};}
