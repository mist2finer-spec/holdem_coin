import {HUNT_BODIES} from './hunt-collision';
import motions from './motion-profile.json';
import combatProfile from './combat-profile.json';
export const WORLD_WIDTH=6000;
export const SKILL_COOLDOWNS=[5,8,7,9,6,12];
export type ComboStage={animation:keyof typeof motions.durations;hitAt:number;damage:number;duration?:number};
// Native time values are recovered; pixel distances/damage and enum-to-clip names
// are explicit web adapter choices (see combat-profile.json limitations).
const PIXELS_PER_NATIVE_UNIT=100;
export const HUNT_RULES={
 moveSpeed:175,attackRange:HUNT_BODIES.slimeRadius*4,stopRange:40,
 useRush:Boolean(combatProfile.native.useRush),
 rushMin:combatProfile.native.rushMin*PIXELS_PER_NATIVE_UNIT,
 rushMax:combatProfile.native.rushMax*PIXELS_PER_NATIVE_UNIT,
 rushSpeed:combatProfile.native.rushSpeed*PIXELS_PER_NATIVE_UNIT,
 dodgeDistance:125,dodgeCooldown:combatProfile.native.avoidCooldown,
 comboReset:combatProfile.native.comboDelay,minAttackDelay:combatProfile.native.minAttackDelay,inputBuffer:.18,
 combo:combatProfile.combo.map(stage=>({animation:stage.animation as ComboStage['animation'],
  hitAt:stage.hitAt,damage:stage.damage,duration:stage.duration})),
};
export {motions,combatProfile};
