import data from './data/hunt-tables.json';
export const HUNT_TABLES=data;
/** Fail at load time for dangling references or impossible numeric settings. */
export function validateHuntTables(t:typeof data){
 if(t.version!==1)throw Error('Invalid hunt table version');
 for(const rows of [t.assets,t.attacks,t.monsters,t.stages])if(!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate/empty hunt table');
 const positive=(...values:number[])=>{if(values.some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid hunt table number');};
 for(const a of t.attacks){positive(a.damage,a.reachBonus,a.impactReachBonus,a.windup,a.recovery,a.parriedRecovery);if(!Number.isFinite(a.defenseFactor)||a.defenseFactor<0)throw Error('Invalid defense factor');}
 for(const m of t.monsters){if(!t.assets.some(a=>a.id===m.assetId)||!t.attacks.some(a=>a.id===m.attackId))throw Error('Unknown monster reference');positive(m.maxHP,m.moveSpeed,m.aggroRange,m.respawnSeconds);for(const v of Object.values(m.reward))if(!Number.isSafeInteger(v)||v<0||v>10000)throw Error('Invalid monster reward');}
 for(const s of t.stages){positive(s.worldWidth,s.recycleAhead,s.recycleSpacing);if(!t.monsters.some(m=>m.id===s.monsterId)||s.maxAlive!==s.spawns.length||!Number.isInteger(s.maxAlive)||s.maxAlive<1||s.maxAlive>7||s.spawns.some(x=>!Number.isFinite(x)||x<65||x>s.worldWidth-65))throw Error('Invalid stage spawn');}
}
validateHuntTables(data);
export const HUNT_STAGE=data.stages[0];
export const HUNT_MONSTER=data.monsters.find(m=>m.id===HUNT_STAGE.monsterId)!;
export const HUNT_MONSTER_ATTACK=data.attacks.find(a=>a.id===HUNT_MONSTER.attackId)!;
export const HUNT_MONSTER_ASSET=data.assets.find(a=>a.id===HUNT_MONSTER.assetId)!;
