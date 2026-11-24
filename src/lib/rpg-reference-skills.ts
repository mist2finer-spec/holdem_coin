// Local training presentation skills. World units: 100 = one Unity metre.
// The equipped gem chooses the skill, independently of its hotbar position/camera.
export type SkillPoint={x:number;y:number};
export const REFERENCE_SKILLS={
 cleave:{id:'sun-cleave',duration:.82,hitAt:.36,cooldown:4,mana:50,radius:240,reach:340,damage:150},
 stormcall:{id:'storm-call',duration:.94,hitAt:.48,cooldown:6,mana:65,radius:240,reach:600,damage:180},
 water:{id:'water-ring',duration:1.05,hitAt:.48,cooldown:4.5,mana:50,radius:18,reach:600,damage:120},
 // Ertel trial skills (2026-11-23, maintenance/ertel-electric-20261123, practice slots 3/4). Numbers are temporary, for the user to tune.
 // Lightning ball: launched at hitAt from the hero toward the aim (skillAim: the nearest target in reach, else the facing), flies `speed`
 // cm/s along the ground at `height` above it and bursts on the first target or wall it touches, or at `range`; the burst hurts every
 // target within `radius` (+ its body). size scales the ball and burst radii, count launches that many balls `spread` degrees apart
 // (later nodes/traits; now 1/1). speed 880 = the VFX's own 12 m in 1.36 s flight.
 lightningball:{id:'lightning-ball',duration:.82,hitAt:.3,cooldown:3,mana:50,radius:90,reach:550,damage:150,range:550,speed:880,height:60,ballRadius:22,size:1,count:1,spread:12},
 // Arc discharge (a thrown mine): lands `throwDistance` ahead of the hero (toward the aim) `throwSeconds` after hitAt, then bursts when
 // a living target comes within `trigger` (+ its body) or `fuse` seconds after landing, hurting every target within `radius`. At most
 // `maxActive` mines (flying or placed) per caster: one more makes the oldest burst at once.
 arcdischarge:{id:'arc-discharge',duration:.82,hitAt:.3,cooldown:3,mana:55,radius:150,reach:300,damage:170,throwDistance:275,throwSeconds:.35,trigger:150,fuse:3,maxActive:2},
} as const;
export type LightningBallSpec=typeof REFERENCE_SKILLS.lightningball;
export type ArcDischargeSpec=typeof REFERENCE_SKILLS.arcdischarge;
export function referenceSkill(activeId:string){if(activeId==='lightningball')return REFERENCE_SKILLS.lightningball;if(activeId==='arcdischarge')return REFERENCE_SKILLS.arcdischarge;return ['icespear','icenova','frostshot'].includes(activeId)?REFERENCE_SKILLS.water:['stormcall','arc','spark','lightningstrike'].includes(activeId)?REFERENCE_SKILLS.stormcall:REFERENCE_SKILLS.cleave;}
// REV2-PORT-HOOK(LIGHTNING-TARGET): the trial scene picks the lightning point at the slash contact; the kernel locks it at cast start.
// `ahead` is the fallback distance in front of the hero (the pink-iai kit passes its body-scaled 88 for storm-call only).
// The nearest living target inside the skill's reach (undefined = none). skillAim and the AUTO skill pick share it.
export function skillTarget<T extends SkillPoint&{hp:number}>(hero:SkillPoint,targets:ReadonlyArray<T>,skill:{readonly reach:number}):T|undefined{
 return targets.filter(t=>t.hp>0&&Math.hypot(t.x-hero.x,t.y-hero.y)<=skill.reach).sort((a,b)=>Math.hypot(a.x-hero.x,a.y-hero.y)-Math.hypot(b.x-hero.x,b.y-hero.y))[0];
}
export function skillAim(hero:SkillPoint&{direction:SkillPoint},targets:ReadonlyArray<SkillPoint&{hp:number}>,skill:{readonly id:string;readonly reach:number},ahead=130){
 const target=skillTarget(hero,targets,skill);
 // Lock the ground target at cast start: movement during the wind-up can evade it.
 if(skill.id==='storm-call'&&target)return {x:target.x,y:target.y};
 const d=target?Math.hypot(target.x-hero.x,target.y-hero.y):0;
 const direction=target&&d>.001?{x:(target.x-hero.x)/d,y:(target.y-hero.y)/d}:hero.direction;
 return {x:hero.x+direction.x*ahead,y:hero.y+direction.y*ahead};
}
export function skillContains(target:SkillPoint&{radius?:number;elevation?:number},center:SkillPoint,radius:number){return Math.hypot(target.x-center.x,target.y-center.y)<=radius+(target.radius??0);}
// A visible, low horizontal sword crescent supplements the imported narrow blade
// trajectory. Evaluate its moving edge, never apply a screen-space damage radius.
export function packSwordContact(phase:number,from:number,to:number,hero:SkillPoint&{facing:number;elevation:number;airHeight:number;motion?:{comboStep?:number}|null},target:SkillPoint&{radius:number;elevation:number;bodyHeight?:number}){
 if(phase<from||phase>to||Math.abs(target.elevation-hero.elevation-hero.airHeight)>65)return null;
 const reverse=(hero.motion?.comboStep??1)%2===0?-1:1;
 const a=reverse*(-100+200*(phase-from)/(to-from))*Math.PI/180;
 const dx=target.x-hero.x,dy=target.y-hero.y,ux=Math.cos(a)*hero.facing,uy=Math.sin(a);
 const along=Math.max(20,Math.min(105,dx*ux+dy*uy));
 return Math.hypot(dx-ux*along,dy-uy*along)<=target.radius+9?{point:{x:target.x,y:target.elevation+20,z:target.y},part:'crescent'}:null;
}
