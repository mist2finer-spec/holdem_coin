import profile from './generated/unity-boss-contact.json';
export const BOSS_CONTACT=profile;
export type V3={x:number;y:number;z:number};
export function sampleArm(phase:number,hand:number){const at=Math.max(0,Math.min(1,phase))*profile.segments,n=Math.floor(at),u=at-n,a=profile.frames[n],b=profile.frames[Math.min(n+1,profile.segments)],offset=hand*6;const p=(i:number):V3=>({x:a[offset+i]+(b[offset+i]-a[offset+i])*u,y:a[offset+i+1]+(b[offset+i+1]-a[offset+i+1])*u,z:a[offset+i+2]+(b[offset+i+2]-a[offset+i+2])*u});return {elbow:p(0),hand:p(3)};}
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a:V3,b:V3):V3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export function segmentDistanceSq(p1:V3,q1:V3,p2:V3,q2:V3){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r),clamp=(x:number)=>Math.max(0,Math.min(1,x));let s=0,t=0;
 if(a<=1e-10&&e<=1e-10)return dot(r,r);
 if(a<=1e-10)t=clamp(f/e);else {const c=dot(d1,r);if(e<=1e-10)s=clamp(-c/a);else{const b=dot(d1,d2),denom=a*e-b*b;if(denom!==0)s=clamp((b*f-c*e)/denom);t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 const v={x:r.x+d1.x*s-d2.x*t,y:r.y+d1.y*s-d2.y*t,z:r.z+d1.z*s-d2.z*t};return dot(v,v);
}
export function worldPoint(p:V3,boss:{x:number;y:number;elevation:number;direction:{x:number;y:number}}):V3{return {x:boss.x+p.x*boss.direction.y+p.z*boss.direction.x,y:boss.elevation+p.y,z:boss.y-p.x*boss.direction.x+p.z*boss.direction.y};}
export function hookContact(phase:number,hand:number,boss:Parameters<typeof worldPoint>[1],hero:{x:number;y:number;elevation:number;airHeight:number;action:string}){
 const shape=sampleArm(phase,hand),a=worldPoint(shape.elbow,boss),b=worldPoint(shape.hand,boss),radius=profile.heroRadius,base=hero.elevation+hero.airHeight,height=hero.action.startsWith('sliding')?65:profile.heroHeight;
 const lo={x:hero.x,y:base+radius,z:hero.y},hi={x:hero.x,y:base+height-radius,z:hero.y};
 const fist=segmentDistanceSq(b,b,lo,hi)<=(radius+profile.handRadii[hand])**2,arm=segmentDistanceSq(a,b,lo,hi)<=(radius+profile.armRadius)**2;
 return fist||arm?{point:b,part:fist?'hand':'forearm'}:null;
}
