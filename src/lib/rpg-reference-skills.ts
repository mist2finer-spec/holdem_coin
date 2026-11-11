// Local training presentation skills. World units: 100 = one Unity metre.
// The equipped gem chooses the skill, independently of its hotbar position/camera.
export type SkillPoint={x:number;y:number};
export const REFERENCE_SKILLS={
 cleave:{id:'sun-cleave',duration:.82,hitAt:.36,cooldown:4,mana:50,radius:240,reach:340,damage:150},
 stormcall:{id:'storm-call',duration:.94,hitAt:.48,cooldown:6,mana:65,radius:240,reach:600,damage:180},
} as const;
export function referenceSkill(activeId:string){return ['stormcall','arc','spark','lightningstrike'].includes(activeId)?REFERENCE_SKILLS.stormcall:REFERENCE_SKILLS.cleave;}
export function skillAim(hero:SkillPoint&{direction:SkillPoint},targets:ReadonlyArray<SkillPoint&{hp:number}>,skill:ReturnType<typeof referenceSkill>){
 const target=targets.filter(t=>t.hp>0&&Math.hypot(t.x-hero.x,t.y-hero.y)<=skill.reach).sort((a,b)=>Math.hypot(a.x-hero.x,a.y-hero.y)-Math.hypot(b.x-hero.x,b.y-hero.y))[0];
 // Lock the ground target at cast start: movement during the wind-up can evade it.
 if(skill.id==='storm-call'&&target)return {x:target.x,y:target.y};
 const d=target?Math.hypot(target.x-hero.x,target.y-hero.y):0;
 const direction=target&&d>.001?{x:(target.x-hero.x)/d,y:(target.y-hero.y)/d}:hero.direction;
 return {x:hero.x+direction.x*130,y:hero.y+direction.y*130};
}
export function skillContains(target:SkillPoint&{radius?:number;elevation?:number},center:SkillPoint,radius:number){return Math.hypot(target.x-center.x,target.y-center.y)<=radius+(target.radius??0);}
// A visible, low horizontal sword crescent supplements the imported narrow blade
// trajectory. Evaluate its moving edge, never apply a screen-space damage radius.
export function packSwordContact(phase:number,from:number,to:number,hero:SkillPoint&{facing:number;elevation:number;airHeight:number},target:SkillPoint&{radius:number;elevation:number;bodyHeight?:number}){
 if(phase<from||phase>to||Math.abs(target.elevation-hero.elevation-hero.airHeight)>65)return null;
 const a=(-100+200*(phase-from)/(to-from))*Math.PI/180;
 const dx=target.x-hero.x,dy=target.y-hero.y,ux=Math.cos(a)*hero.facing,uy=Math.sin(a);
 const along=Math.max(20,Math.min(105,dx*ux+dy*uy));
 return Math.hypot(dx-ux*along,dy-uy*along)<=target.radius+9?{point:{x:target.x,y:target.elevation+20,z:target.y},part:'crescent'}:null;
}
