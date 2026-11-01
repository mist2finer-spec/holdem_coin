import growth from './data/recovered-growth.json';
/** Custom pacing atop the recovered native level-cost curve; server clock grants idle XP; capped hybrid kill XP is credited separately. */
export const IDLE_BALANCE={version:1,source:'custom-web-idle-v1',xpPerMinute:5,goldPerMinute:30,soulGemPerMinute:1,offlineCapMs:24*60*60*1000,buildBasePoints:12,buildMaxPoints:90} as const;
export type IdleProgress={version:1;lastAccruedAt:number;totalAccruedMs:number;xpRemainder:number;goldRemainder:number;soulGemRemainder:number};
export type IdleProgressHost={level:number;xp:number;gold:number;soulGem:number;idle?:IdleProgress};
export function createIdleProgress(now:number):IdleProgress{if(!Number.isSafeInteger(now)||now<0)throw Error('잘못된 서버 시간입니다.');return {version:1,lastAccruedAt:now,totalAccruedMs:0,xpRemainder:0,goldRemainder:0,soulGemRemainder:0};}
export function validateIdleProgress(raw:unknown):asserts raw is IdleProgress{
 const idle=raw as IdleProgress;if(!idle||idle.version!==1||![idle.lastAccruedAt,idle.totalAccruedMs].every(v=>Number.isSafeInteger(v)&&v>=0)||![idle.xpRemainder,idle.goldRemainder,idle.soulGemRemainder].every(v=>Number.isSafeInteger(v)&&v>=0&&v<60000))throw Error('잘못된 방치 성장 상태입니다.');
}
/** Same intermediate floors and float32 delta as the recovered QuadFunc evaluator. */
export function idleLevelCost(level:number){
 if(!Number.isSafeInteger(level)||level<1)throw Error('잘못된 레벨입니다.');const c=growth.teamCurves.find(c=>level>=c.min&&level<c.max);if(!c||!c.scaler)return 0;
 const n=Math.fround(level-c.min),q=Math.floor(Math.floor(Math.floor(Math.floor(c.rate*n)*n)+Math.floor(c.scaler*.5))/c.scaler),result=Math.floor(Math.floor(c.inc*n)+Math.floor(c.base+q));
 if(!Number.isSafeInteger(result)||result<0)throw Error('안전한 레벨 비용 범위를 벗어났습니다.');return result;
}
export function idleBuildBudget(level:number){return Math.min(IDLE_BALANCE.buildMaxPoints,IDLE_BALANCE.buildBasePoints+Math.max(0,Math.floor(Number.isFinite(level)?level:1)-1));}
export function advanceIdleLevel(p:Pick<IdleProgressHost,'level'|'xp'>){while(p.level<growth.teamMaxLevel){const required=idleLevelCost(p.level);if(!required||p.xp<required)break;p.xp-=required;p.level++;}if(p.level>=growth.teamMaxLevel)p.xp=0;}
export function accrueIdleProgress(p:IdleProgressHost,now:number){
 if(!Number.isSafeInteger(now)||now<0)throw Error('잘못된 서버 시간입니다.');
 if(!p.idle){p.idle=createIdleProgress(now);return {elapsedMs:0,discardedMs:0,xp:0,gold:0,soulGem:0,levels:0};}
 validateIdleProgress(p.idle);const idle=p.idle;if(now<=idle.lastAccruedAt)return {elapsedMs:0,discardedMs:0,xp:0,gold:0,soulGem:0,levels:0};
 const age=now-idle.lastAccruedAt,elapsedMs=Math.min(age,IDLE_BALANCE.offlineCapMs),before=p.level;
 const credit=(rate:number,remainder:number)=>{const units=elapsedMs*rate+remainder;return {amount:Math.floor(units/60000),remainder:units%60000};};
 const xp=credit(IDLE_BALANCE.xpPerMinute,idle.xpRemainder),gold=credit(IDLE_BALANCE.goldPerMinute,idle.goldRemainder),soulGem=credit(IDLE_BALANCE.soulGemPerMinute,idle.soulGemRemainder);
 p.xp=Math.min(Number.MAX_SAFE_INTEGER,p.xp+xp.amount);p.gold=Math.min(1e12,p.gold+gold.amount);p.soulGem=Math.min(1e12,p.soulGem+soulGem.amount);
 p.idle={version:1,lastAccruedAt:now,totalAccruedMs:Math.min(Number.MAX_SAFE_INTEGER,idle.totalAccruedMs+elapsedMs),xpRemainder:xp.remainder,goldRemainder:gold.remainder,soulGemRemainder:soulGem.remainder};advanceIdleLevel(p);
 return {elapsedMs,discardedMs:age-elapsedMs,xp:xp.amount,gold:gold.amount,soulGem:soulGem.amount,levels:p.level-before};
}
