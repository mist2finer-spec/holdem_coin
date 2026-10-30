/** Server-owned jump envelope. Visual poses do not grant damage or invulnerability. */
export const HUNT_JUMP={duration:.86,height:140,distance:210,cooldown:1.05} as const;
export type HuntJump={startedAt:number;duration:number;origin:number;destination:number};
export function jumpVisual(jump:HuntJump|null,elapsed:number){
 if(!jump)return {height:0,pose:''};
 const t=Math.max(0,Math.min(1,(elapsed-jump.startedAt)/jump.duration));
 // Finite ballistic arc, zero at both contacts. Native jump clips are short pose keys.
 return {height:4*HUNT_JUMP.height*t*(1-t),pose:t<.12?'jump1':t<.35?'jump2':t<.65?'jump3':t<.9?'jump4':'jump5'};
}
