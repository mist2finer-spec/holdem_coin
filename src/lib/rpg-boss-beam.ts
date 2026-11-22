// Kit boss fight rune beams (2026-11-22, maintenance/boss-beam-camera-20261122). Shown with the RuneBeam package
// (Assets/RuneBeam, shader RuneGeometry.cginc); this file is the judgement and the one timeline both sides read.
// A beam charges (rune seals + orb = the warning, no hit), fires (hit from fireAt to stopAt), then fades (no hit).
// Kernel plane: x right, y depth (Unity z = y - lane). Angles are atan2(dy, dx) in that plane; Unity draws the beam
// along (cos a, 0, sin a). Seen from the battle camera (above the ground, not mirrored) a falling angle turns clockwise.
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smoothstep=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Rule table (design will tune these; defaults from the brief). Distances in cm, times in s.
export const BOSS_BEAM_RULES=Object.freeze({
 // RuneBeam package timeline: clip 3.6 s, charge fraction .36 -> the beam leaves 1.296 s after the seals appear.
 clip:3.6,charge:.36,
 // Single beam: the hit ends at phase .84 (the package fades the beam from .77 to .91; .84 = half bright).
 stopPhase:.84,
 // Damage = blastDamage x damageScale, with the blast knockback.
 damageScale:2,
 // Geometry: length from the pivot, RuneBeam beamWidth and Size, pivot height above the boss feet, pivot ahead of the boss centre.
 length:1800,width:1.4,size:.8,height:100,forward:90,
 // A hero higher than this over the ground clears the beam (same as the blast rule).
 jumpClear:120,
 // Single straight beam: every third kit boss attack (hook pair, throw + disc, beam).
 cycle:3,
 // Last stand: the first time the boss HP is at or under hpFraction of max, once: count beams (360/count apart) charge,
 // fire and turn clockwise on screen at turnDegPerSecond for sustain seconds. A hit gives the hero invulnerable seconds.
 ring:{count:8,hpFraction:.25,sustain:6,turnDegPerSecond:20,invulnerable:.6},
 // Boss rest after a beam (as after the throw).
 rest:1.6,
});
export type BossBeam={id:number;attackId:number;kind:'line'|'ring';index:number;x:number;y:number;elevation:number;forward:number;height:number;
 angle:number;turn:number;chargeAt:number;fireAt:number;stopAt:number;endAt:number;length:number;width:number;size:number;clip:number;charge:number;hit:boolean};
type BeamSpec={id:number;attackId:number;kind:'line'|'ring';index:number;x:number;y:number;elevation:number;angle:number;at:number;sustain?:number;turn?:number};
// One beam starting now (at). Line: package timing (fire at charge x clip, stop at stopPhase x clip, end at clip).
// Ring: fire at the same time, then sustain seconds of fire (turning), then the package fade (1 - stopPhase of the clip).
export function makeBeam(s:BeamSpec,R=BOSS_BEAM_RULES):BossBeam{
 const fireAt=s.at+R.charge*R.clip,stopAt=s.sustain!==undefined?fireAt+s.sustain:s.at+R.stopPhase*R.clip;
 return {id:s.id,attackId:s.attackId,kind:s.kind,index:s.index,x:s.x,y:s.y,elevation:s.elevation,forward:R.forward,height:R.height,angle:s.angle,turn:s.turn??0,
  chargeAt:s.at,fireAt,stopAt,endAt:stopAt+(1-R.stopPhase)*R.clip,length:R.length,width:R.width,size:R.size,clip:R.clip,charge:R.charge,hit:false};
}
// Shader phase at time t (Unity BossBeamPresentation.Phase is the same function). Package speed (1/clip) up to charge+.1
// (fire and the beam front), then the rest of the full-bright part (.46 -> .70) stretched over the sustain, then package
// speed again through the fade (.84 at stopAt, 1 at endAt). The line beam has no stretch: phase = age / clip.
export function beamPhase(b:BossBeam,t:number){
 const a=b.fireAt+.1*b.clip,pa=b.charge+.1,bb=b.stopAt-.14*b.clip;
 if(t<=a)return clamp((t-b.chargeAt)/b.clip,0,1);
 if(bb<=a)return clamp(pa+(t-a)/b.clip,0,1);
 if(t<=bb)return pa+(.7-pa)*(t-a)/(bb-a);
 return clamp(.7+(t-bb)/b.clip,0,1);
}
export function beamAngle(b:BossBeam,t:number){return b.angle+b.turn*clamp(t-b.fireAt,0,b.stopAt-b.fireAt);}
// The beam front (shader runeFront): 0 before the fire, 1 about .27 s after it.
export function beamFront(b:BossBeam,t:number){return smoothstep(b.charge-.003,b.charge+.072,beamPhase(b,t));}
export const beamFiring=(b:BossBeam,t:number)=>t>=b.fireAt&&t<b.stopAt;
// Beam half width (cm) at distance d (cm) from the pivot along the beam, front f: the painted core of the shader
// (spread(s) = (.044 + .225 smoothstep(0,.33,s) + .27 s) x width, Size), x .8 = its full-bright edge (.8 of the strip)
// with the mean of the .88-1 width wobble.
export function beamHalfWidth(b:BossBeam,d:number,f=1){
 const unit=100*b.size,len=b.length/unit,z=d/unit,s=clamp((z+.24)/Math.max(1e-6,(len+.24)*f),0,1);
 return .8*(.044+.225*smoothstep(0,.33,s)+.27*s)*b.width*unit;
}
export function beamPivot(b:BossBeam,t:number){const a=beamAngle(b,t);return {x:b.x+Math.cos(a)*b.forward,y:b.y+Math.sin(a)*b.forward,a};}
// Segment-circle test against a hero of radius r (cm) at time t. null outside the fire window or when the hero misses.
export function beamContact(b:BossBeam,t:number,hero:{x:number;y:number},r:number){
 if(!beamFiring(b,t))return null;const f=beamFront(b,t);if(f<=0)return null;
 const p=beamPivot(b,t),ux=Math.cos(p.a),uy=Math.sin(p.a),dx=hero.x-p.x,dy=hero.y-p.y,along=dx*ux+dy*uy,unit=100*b.size;
 const reach=-.24*unit+(b.length+.24*unit)*f;if(along<-.24*unit-r||along>reach+r)return null;
 const across=Math.abs(dx*uy-dy*ux),d=clamp(along,-.24*unit,reach);if(across>beamHalfWidth(b,d,f)+r)return null;
 return {x:p.x+ux*d,y:p.y+uy*d,along:d,across};
}
// The view entry (Unity reads these; originZ = y - lane like the warning disc).
export function beamView(b:BossBeam,lane:number){return {id:b.id,attackId:b.attackId,kind:b.kind,index:b.index,originX:b.x,originZ:b.y-lane,elevation:b.elevation,forward:b.forward,height:b.height,
 angle:b.angle,turn:b.turn,chargeAt:b.chargeAt,fireAt:b.fireAt,stopAt:b.stopAt,endAt:b.endAt,length:b.length,width:b.width,size:b.size,clip:b.clip,charge:b.charge};}
