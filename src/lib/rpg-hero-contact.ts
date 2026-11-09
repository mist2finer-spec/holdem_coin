import profile from './generated/unity-hero-contact.json';
import {segmentDistanceSq,worldPoint,type V3} from './rpg-boss-contact';
export const HERO_CONTACT=profile;
export function heroAttackDefinition(action:string){return profile.attacks[action as keyof typeof profile.attacks]??profile.attacks.attack1;}
export function sampleWeapon(action:string,phase:number,lowTarget=false){const d=lowTarget?profile.lowAttacks[action as keyof typeof profile.lowAttacks]??profile.lowAttacks.attack1:heroAttackDefinition(action),at=Math.max(0,Math.min(1,phase))*d.segments,n=Math.floor(at),u=at-n,a=d.frames[n],b=d.frames[Math.min(n+1,d.segments)];const p=(i:number):V3=>({x:a[i]+(b[i]-a[i])*u,y:a[i+1]+(b[i+1]-a[i+1])*u,z:a[i+2]+(b[i+2]-a[i+2])*u});return {base:p(0),tip:p(3)};}
export function weaponContact(action:string,phase:number,hero:Parameters<typeof worldPoint>[1]&{airHeight:number;sideView?:boolean;lowTarget?:boolean},target:{x:number;y:number;elevation:number;radius:number;bodyHeight?:number;unityBoss?:boolean}){
 const shape=sampleWeapon(action,phase,hero.lowTarget),actor={...hero,elevation:hero.elevation+hero.airHeight},a=worldPoint(shape.base,actor),b=worldPoint(shape.tip,actor),radius=target.radius,height=target.unityBoss?650:target.bodyHeight??62;
 if(hero.sideView){a.z=hero.y-shape.base.x;b.z=hero.y-shape.tip.x;}
 const lo={x:target.x,y:target.elevation+radius,z:target.y},hi={x:target.x,y:target.elevation+Math.max(radius,height-radius),z:target.y};
 return segmentDistanceSq(a,b,lo,hi)<=(radius+profile.bladeRadius)**2?{point:b,part:'blade'}:null;
}
