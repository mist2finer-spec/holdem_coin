import {huntLoadout} from './hunt-loadouts';
export const WEAPON_TYPES=['unarmed','sword','axe','dual','spear'] as const;
export type WeaponType=typeof WEAPON_TYPES[number];
export const WEAPONS={
 unarmed:{name:'맨손',icon:'✊',speed:1.12,power:.85,range:46,stages:5,description:'맨손 5연격'},
 sword:{name:'칼',icon:'⚔',speed:1.08,power:1,range:62,stages:4,description:'균형 잡힌 4연격'},
 axe:{name:'도끼',icon:'🪓',speed:.95,power:1.35,range:58,stages:3,description:'묵직한 3연격'},
 dual:{name:'쌍칼',icon:'⚔',speed:1.28,power:.76,range:48,stages:5,description:'빠른 5연격'},
 spear:{name:'창',icon:'♜',speed:1,power:1.12,range:105,stages:4,description:'긴 사거리의 4연격'},
} as const;
export const isWeaponType=(v:unknown):v is WeaponType=>typeof v==='string'&&(WEAPON_TYPES as readonly string[]).includes(v);
/** Character traits and selected weapon combine; appearance assets remain untouched. */
export function weaponLoadout(character:string,weapon:WeaponType){
 const traits=huntLoadout(character),w=WEAPONS[weapon];
 // Reuse the verified clip names, but weapon-specific schedules are explicit web adaptations.
 const base=huntLoadout('hong').combo;
 return {name:w.name,range:w.range,crit:traits.crit,tempo:1.35*w.speed,
  combo:base.slice(0,w.stages).map(s=>({...s,damage:Math.max(1,Math.round(s.damage*w.power*traits.power))}))};
}
