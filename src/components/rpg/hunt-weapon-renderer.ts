import type {WeaponType} from './hunt-weapons';
/** Hand anchors in the unchanged 256px cells. Mirroring happens around the foot anchor. */
const hands=[[166,91],[166,93],[166,91],[166,92],[172,99],[173,96],[174,100],[174,97],[97,83],[194,101],[199,102],[170,106],[169,105],[112,172],[100,188],[170,99]];
function weapon(ctx:CanvasRenderingContext2D,type:WeaponType){
 ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=2;ctx.strokeStyle='#22323a';
 const spear=type==='spear',dual=type==='dual';
 ctx.fillStyle='#795b37';ctx.fillRect(-3,-(spear?70:9),6,spear?118:28);ctx.strokeRect(-3,-(spear?70:9),6,spear?118:28);
 ctx.fillStyle='#e0e9e8';ctx.beginPath();
 if(type==='axe'){ctx.moveTo(0,-62);ctx.quadraticCurveTo(37,-64,31,-31);ctx.quadraticCurveTo(13,-29,0,-43);ctx.closePath();}
 else if(spear){ctx.moveTo(0,-106);ctx.lineTo(10,-73);ctx.lineTo(0,-66);ctx.lineTo(-10,-73);ctx.closePath();}
 else {ctx.moveTo(-5,-12);ctx.lineTo(-5,dual?-45:-65);ctx.lineTo(0,dual?-59:-82);ctx.lineTo(5,dual?-45:-65);ctx.lineTo(5,-12);ctx.closePath();}
 ctx.fill();ctx.stroke();
 if(!spear){ctx.strokeStyle='#cba867';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-11,-10);ctx.lineTo(11,-10);ctx.stroke();}
 ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,spear?-92:type==='axe'?-54:dual?-48:-70);ctx.stroke();
}
export function drawHeldWeapon(ctx:CanvasRenderingContext2D,type:WeaponType,frame:number,x:number,floor:number,scale:number,facing:number,age:number,duration:number,hitAt:number,attacking:boolean){
 const hand=hands[frame]??hands[0],t=duration>0?Math.min(1,age/duration):0;
 const contact=duration>0?Math.min(.8,hitAt/duration):.4;
 // Smooth wind-up / strike / recovery, never a random position jump per frame.
 const swing=attacking?(t<contact?-1.0+2.1*Math.pow(t/Math.max(.01,contact),2):1.1-1.3*(1-Math.pow(1-(t-contact)/(1-contact),2))):-.25;
 ctx.save();ctx.translate(x,floor);ctx.scale(scale*(facing<0?-1:1),scale);
 const one=(back=false)=>{ctx.save();ctx.translate(hand[0]-128-(back?35:0),hand[1]-224+(back?9:0));
  ctx.rotate(type==='spear'?(attacking?Math.PI/2:-.2):swing*(back?-1:1));
  if(back)ctx.globalAlpha=.8;weapon(ctx,type);ctx.restore();};
 if(type==='dual')one(true);one();
 if(attacking&&t>contact-.12&&t<contact+.18){
  ctx.strokeStyle=type==='axe'?'#ffcf8580':'#bceeff99';ctx.lineWidth=type==='axe'?7:3;
  ctx.beginPath();if(type==='spear'){ctx.moveTo(35,-105);ctx.lineTo(125,-105);}else ctx.arc(15,-105,type==='dual'?55:73,-1.4,1.1);ctx.stroke();
 }
 ctx.restore();
}
