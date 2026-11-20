// Three-way forks on the mount route (K2-K4; maintenance/run-structure-20261119/TECH_FEASIBILITY_KO.md A).
// Opt-in: the boot `forks:{enabled:true,seed}` turns it on; without it the engine never reads this file's tables.
// Flow: zone 1 -> zone 2 -> fork A -> chosen branch -> zone 3 -> 4 -> 5 -> fork B -> chosen branch -> 6 -> 7 -> 8 -> 9 -> boss.
// A branch re-uses an existing scene (`scene`, the kernel `room`): same terrain, obstacles and spawn rules (MOUNT_RULES).
// World units: 100 = one Unity metre. Branch paths are cm offsets from the fork point (x, the lane centre there); +y = into
// the screen (inner), -y = toward the camera (outer).
export type ForkId='A'|'B';
export type BranchId='inner'|'middle'|'outer';
export const BRANCH_IDS:ReadonlyArray<BranchId>=Object.freeze(['inner','middle','outer'] as BranchId[]);
export type Segment={kind:'zone';zone:number}|{kind:'branch';fork:ForkId;id:BranchId;scene:number;after:number};
type Branch={scene:number;name:string;event:string|null;path:ReadonlyArray<readonly [number,number]>};
export type ForkDef={id:ForkId;after:number;rejoin:number;back:number;branches:Readonly<Record<BranchId,Branch>>};
function deepFreeze<T>(o:T):T{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o as any))deepFreeze(v);Object.freeze(o);}return o;}

// after = the common zone (room) whose end holds the fork; rejoin = the common zone after the branch.
// back = the fork point's distance before the zone's maxX (cm). The hero is held at the fork there until a branch is chosen.
// TEMPORARY (design decides): the scenes each branch re-uses (A = 7/6/5, B = 1/2/8; the plan's example, order mine) and the
// names. Change them here only. No two consecutive segments may use the same scene (the test checks it).
// Paths (about 6 m, ~1.6 s at 385.5 cm/s): fork A, end of zone 2 (room 1, flat, no obstacle near the exit) is a plain fan.
// Fork B, end of zone 5 (room 4, the bridge): a road comes in from the front at x ~2090 and ends at (2100, centre), so the outer
// branch first runs right past it and then turns toward the camera; the inner branch keeps 4 m+ from the tree at (1856, +650).
export const MOUNT_FORKS:ReadonlyArray<ForkDef>=deepFreeze([
 {id:'A',after:1,rejoin:2,back:350,branches:{
  // ISLAND-FORK-HOOK(EVENT): `event` is where a branch kind (reward / event) will be attached. null = a plain combat branch.
  inner:{scene:7,name:'갈림길 · 안쪽 길',event:null,path:[[300,175],[600,350]]},
  middle:{scene:6,name:'갈림길 · 가운데 길',event:null,path:[[300,0],[600,0]]},
  outer:{scene:5,name:'갈림길 · 바깥쪽 길',event:null,path:[[300,-175],[600,-350]]}}},
 {id:'B',after:4,rejoin:5,back:350,branches:{
  // ISLAND-FORK-HOOK(EVENT)
  inner:{scene:1,name:'갈림길 · 안쪽 길',event:null,path:[[300,175],[550,350]]},
  middle:{scene:2,name:'갈림길 · 가운데 길',event:null,path:[[300,0],[600,0]]},
  outer:{scene:8,name:'갈림길 · 바깥쪽 길',event:null,path:[[410,-30],[610,-330]]}}},
] as ForkDef[]);

export function forkAfter(zone:number){return MOUNT_FORKS.find(f=>f.after===zone);}
export function forkById(id:ForkId){return MOUNT_FORKS.find(f=>f.id===id)!;}
export function sceneOf(s:Segment){return s.kind==='zone'?s.zone:s.scene;}
// The segment after `s`. null = a fork waits for its choice. zone 8 -> zone 9 (the boss).
export function nextSegment(s:Segment,picks:Partial<Record<ForkId,BranchId>>):Segment|null{
 if(s.kind==='branch')return {kind:'zone',zone:forkById(s.fork).rejoin};
 const f=forkAfter(s.zone);if(!f)return {kind:'zone',zone:Math.min(9,s.zone+1)};
 const id=picks[f.id];return id?{kind:'branch',fork:f.id,id,scene:f.branches[id].scene,after:f.after}:null;
}
// Fork choice stream, separate from the spawn random (same LCG, own seed).
// The stream moves one step only when AUTO picks; a button pick draws nothing, so picking A by button changes B's AUTO pick.
// The boot seed is mixed first (murmur3 fmix32): the LCG's first value from small seeds is almost the same (~0.236).
export function forkSeedState(seed:number){let h=(seed^0x9e3779b9)>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b)>>>0;h=Math.imul(h^(h>>>13),0xc2b2ae35)>>>0;return (h^(h>>>16))>>>0;}
export function forkRandom(state:number){const next=(Math.imul(state,1664525)+1013904223)>>>0;return {state:next,value:next/4294967296};}
// Absolute polyline (start = the fork point) of one branch.
export function branchPoints(f:ForkDef,id:BranchId,start:{x:number;y:number}){return [{x:start.x,y:start.y},...f.branches[id].path.map(([dx,dy])=>({x:start.x+dx,y:start.y+dy}))];}
