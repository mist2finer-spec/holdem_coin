/** Numeric retargeting only. Eirika artwork/effects are never loaded by Hong. */
export const EIRIKA_BONE_MAP={pelvis:'bone',torso:'body01',head:'head02','near-upper-arm':'arm01','near-forearm':'arm02','far-upper-arm':'arm04','far-forearm':'bone2','weapon-front':'wep_sw017'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=x=>((x+180)%360+360)%360-180;
const mix=(a,b,t)=>a+(b-a)*t,angle=(a,b,t)=>a+wrap(b-a)*t;
export function createEirikaRetarget(reference){
 function sample(name,time){
  const clip=reference.clips[name],list=clip.samples,t=clamp(time,0,clip.duration);let lo=0,hi=list.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(list[m].time<t)lo=m;else hi=m;}
  const a=list[lo],b=list[hi],w=b.time===a.time?0:(t-a.time)/(b.time-a.time),bones={};
  for(const n of reference.source.bones)bones[n]=Object.fromEntries(['x','y','axis'].map(k=>[k,mix(a.bones[n][k],b.bones[n][k],w)]));
  return bones;
 }
 function packet(name,time){const b=sample(name,time);return{
  near:[b.arm01.axis,b.arm02.axis,0],far:[b.arm04.axis,b.bone2.axis,0],
  // Source image +Y axis is 2.31deg from its weapon bone +X; Hong blade is +Y.
  weapon:b.wep_sw017.axis+2.31-90,
  torso:b.body01.axis-90,head:b.head02.axis-90,hipY:b.bone.y,
 };}
 function blend(a,b,t,longBlade=false){return{
  near:a.near.map((v,i)=>angle(v,b.near[i],t)),far:a.far.map((v,i)=>angle(v,b.far[i],t)),
  weapon:longBlade?mix(a.weapon,b.weapon,t):angle(a.weapon,b.weapon,t),
  torso:mix(a.torso,b.torso,t),head:mix(a.head,b.head,t),hipY:mix(a.hipY,b.hipY,t),
 };}
 function idle(u){const p=packet('idle01',u*reference.clips.idle01.duration);p.torso=clamp(p.torso*.75,-6,6);p.head=clamp(p.head*.5,-4,4);return p;}
 const profiles=[['attack01',.3333,.4333,false,0],['attack01',.4333,.3333,true,8],['attack02',2.03,2.27,false,0],['attack01',.3333,.4333,false,-10],['attack02',2.03,2.27,false,8]];
 function attack(stage,phase,u){
  const [name,windTime,hitTime,reverse,offset]=profiles[stage-1],guard=idle(0),wind=packet(name,windTime),hit=packet(name,hitTime);
  // Preserve the reference's directed swing instead of shortening it to a 130deg return.
  const delta=clamp(hit.weapon-wind.weapon,-270,270);wind.weapon=guard.weapon+wrap(wind.weapon-guard.weapon);hit.weapon=wind.weapon+delta;
  // SD exaggeration: full reference arm chain, reduced jump and safe torso lean.
  wind.torso=clamp(wind.torso,16,24);hit.torso=-35;wind.head=4;hit.head=-15;
  for(const p of [wind,hit]){p.near=p.near.map((v,i)=>i<2?v+offset*.4:v);p.weapon+=offset;}
  const p=u<phase.snapStart?blend(guard,wind,phase.wind):u<.38?blend(wind,hit,phase.weight,true):u<phase.recoveryStart?hit:blend(hit,guard,1-phase.weight);
  return {...p,source:name,reverse};
 }
 function move(u){const p=packet('move',u*reference.clips.move.duration);p.torso=clamp(p.torso,-20,-15);p.head=-4;return p;}
 function aux(u){const duration=reference.clips.aux.duration,time=u<.45?u/.45*.6:.6+(u-.45)/.55*(duration-.6);const p=packet('aux',time),rest=idle(0),fade=u<.12?u/.12:u>.8?(1-u)/.2:1;return blend(rest,p,clamp(fade,0,1));}
 return {sample,idle,attack,move,aux,profiles};
}
