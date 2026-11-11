// Run speed comes from the existing source clip study; jump apex is authored.
// Free-fall reference: first-hand measurement, NOT official controller coefficients:
// https://www.hoyolab.com/article/259166 (20 m/s², terminal 30 m/s).
// Keep the saved profile ID/run speed; replace the old 9.81 m/s² test gravity.
export const SOURCE_TRAVERSAL = Object.freeze({id:'source-run-v2',run:578.19295*2/3,gravity:2000,jumpApex:105,maxFallSpeed:3000});
export type TraversalProfile = typeof SOURCE_TRAVERSAL;
export const jumpDuration=(p:TraversalProfile)=>2*Math.sqrt(2*p.jumpApex/p.gravity);
export const jumpVelocity=(p:TraversalProfile,age:number)=>Math.max(-p.maxFallSpeed,Math.sqrt(2*p.gravity*p.jumpApex)-p.gravity*Math.max(0,age));
export function jumpDisplacement(p:TraversalProfile,age:number){const t=Math.max(0,age),v=Math.sqrt(2*p.gravity*p.jumpApex),cap=(v+p.maxFallSpeed)/p.gravity,a=Math.min(t,cap);return v*a-.5*p.gravity*a*a-p.maxFallSpeed*Math.max(0,t-cap);}
export const jumpHeight=(p:TraversalProfile,age:number)=>Math.max(0,jumpDisplacement(p,age));
export const actionDistance=(p:TraversalProfile,kind:string,duration:number)=>p.run*duration*(kind==='dodge'?1.25:kind==='slide'?1.1:.9);
export const JUMP_LANDING_SECONDS=.1;
export function beginJump(ground:number){return {launchY:ground,worldY:ground,velocityY:0,landedAt:null as number|null};}
export function sampleJump(hero:any,m:any,p:TraversalProfile,age:number){const j=m.jump;if(j.landedAt!==null)return;j.worldY=j.launchY+jumpDisplacement(p,age);j.velocityY=jumpVelocity(p,age);hero.airHeight=Math.max(0,j.worldY-hero.elevation);}
export function landJump(hero:any,m:any,age:number,ground:number){const j=m.jump;if(j.landedAt===null&&age>0&&j.worldY<=ground){j.landedAt=age;j.worldY=ground;j.velocityY=0;}hero.airHeight=Math.max(0,j.worldY-ground);if(j.landedAt!==null){hero.airHeight=0;hero.action='jump5';}return j.landedAt!==null&&age-j.landedAt>=JUMP_LANDING_SECONDS-1e-9;}
