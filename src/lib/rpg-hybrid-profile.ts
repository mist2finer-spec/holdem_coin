import type {HuntProgress} from '../components/rpg/hunt-progression';
import {advanceIdleLevel} from '../components/rpg/idle-progression';
import {HYBRID_BALANCE} from '../components/rpg/hybrid-balance';
export type HybridProgress={version:1;dungeonLevel:number;rewardDay:number;dailyXp:number;dailyGold:number};
const dayOf=(now:number)=>{if(!Number.isSafeInteger(now)||now<0)throw Error('잘못된 보상 시각입니다.');return Math.floor(now/86400000);};
export function validateHybridProgress(raw:unknown):asserts raw is HybridProgress{
 const h=raw as HybridProgress;if(!h||h.version!==1||!Number.isSafeInteger(h.dungeonLevel)||h.dungeonLevel<1||h.dungeonLevel>HYBRID_BALANCE.maxDifficulty||!Number.isSafeInteger(h.rewardDay)||h.rewardDay<0||!Number.isSafeInteger(h.dailyXp)||h.dailyXp<0||h.dailyXp>HYBRID_BALANCE.dailyXpCap||!Number.isSafeInteger(h.dailyGold)||h.dailyGold<0||h.dailyGold>HYBRID_BALANCE.dailyGoldCap)throw Error('잘못된 미궁 성장 저장값입니다.');
}
/** Existing character levels/equipment are retained; only a missing dungeon track starts at one. */
export function initializeHybridProgress(p:HuntProgress,now:number){const day=dayOf(now);p.hybrid??={version:1,dungeonLevel:1,rewardDay:day,dailyXp:0,dailyGold:0};validateHybridProgress(p.hybrid);if(day>p.hybrid.rewardDay){p.hybrid.rewardDay=day;p.hybrid.dailyXp=0;p.hybrid.dailyGold=0;}return p.hybrid;}
export function creditHybridRewards(p:HuntProgress,reward:{xp:number;gold:number},now:number){
 if(![reward.xp,reward.gold].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('잘못된 전투 보상입니다.');const h=initializeHybridProgress(p,now),xp=Math.min(reward.xp,HYBRID_BALANCE.dailyXpCap-h.dailyXp),gold=Math.min(reward.gold,HYBRID_BALANCE.dailyGoldCap-h.dailyGold),level=p.level;
 h.dailyXp+=xp;h.dailyGold+=gold;p.xp=Math.min(Number.MAX_SAFE_INTEGER,p.xp+xp);p.gold=Math.min(1e12,p.gold+gold);advanceIdleLevel(p);return {xp,gold,levels:p.level-level,xpCapped:xp<reward.xp,goldCapped:gold<reward.gold};
}
