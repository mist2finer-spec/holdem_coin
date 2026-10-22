import motions from './motion-profile.json';
export const WORLD_WIDTH=2400;
export const SKILL_COOLDOWNS=[5,8,7,9,6,12];
export type ComboStage={animation:keyof typeof motions.durations;hitAt:number;damage:number};
// DESIGN_PROPOSAL: native evidence proves configurable combo/rush structure,
// not these five equipped attacks, hit offsets, damage or world-pixel values.
export const HUNT_RULES={
 moveSpeed:175,attackRange:155,stopRange:125,rushMin:180,rushMax:480,rushSpeed:720,
 dodgeDistance:125,comboReset:.55,inputBuffer:.18,
 combo:['attack1','attack2','attack3','attack4','attack5'].map((name,i)=>({
  animation:name as ComboStage['animation'],hitAt:motions.durations[name as keyof typeof motions.durations]*.55,
  damage:i===4?30:20})),
};
export {motions};
