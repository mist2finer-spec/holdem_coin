import {Path as RotPath} from 'rot-js';
import {generateRogueMap,moveOnMap,walkable,lineClear,cell,tileCenter,ROGUE_TILE,type Point,type RogueMap} from './map';
import {LABYRINTH} from '../hunt-labyrinth';
export const ROGUE_SPECIES=[1001,1002,1003,1051,1101,1102,1103,1201] as const;
export const ROGUE_LABELS:Record<number,string>={1001:'불 슬라임',1002:'물 슬라임',1003:'숲 슬라임',1051:'오염체',1101:'정찰 고블린',1102:'검 고블린',1103:'주술 고블린',1201:'별거미',1031:'슬라임 군주'};
export type RogueInput={x:number;y:number;auto:boolean;attack?:boolean;skill?:number;jump?:boolean;dodge?:boolean};
export type RogueMob=Point&{id:number;room:number;species:number;hp:number;maxHP:number;radius:number;state:'idle'|'walk'|'windup'|'recover'|'dead';until:number;hitUntil:number;target:Point;boss:boolean};
export type RogueFx=Point&{id:number;kind:'slash'|'rift'|'dash'|'heal';born:number;angle:number};
export type RogueMotion={kind:'attack'|'jump'|'dodge'|'skill';start:number;duration:number;hitAt:number;done:boolean;from:Point;to:Point;skill?:number};
export type RogueSnapshot={elapsed:number;hero:Point&{hp:number;maxHP:number;action:string;serial:number;facing:number;direction:Point;motion:RogueMotion|null;hitUntil:number};mobs:RogueMob[];visited:number[];cleared:number[];room:number;status:'playing'|'dead'|'won';kills:number;gold:number;cooldowns:number[];jumpReady:boolean;dodgeReady:boolean;auto:boolean;fx:RogueFx[]};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y);return d?{x:x/d,y:y/d}:{x:1,y:0};};
/** Separate test run. Does not advance Labyrinth stages or write account rewards. */
export class RogueEngine{
 readonly map:RogueMap;elapsed=0;hero:RogueSnapshot['hero'];mobs:RogueMob[]=[];visited=new Set<number>([0]);cleared=new Set<number>();room=0;status:RogueSnapshot['status']='playing';kills=0;gold=0;cooldowns=[0,0,0];auto=true;fx:RogueFx[]=[];
 private pendingSkill:number|null=null;private jumpAt=0;private dodgeAt=0;private attackAt=0;private combo=0;private fxId=0;private navAt=0;private nav:InstanceType<typeof RotPath.Dijkstra>|null=null;
 constructor(seed:number){this.map=generateRogueMap(seed);this.hero={...this.map.start,hp:10000,maxHP:10000,action:'stay1',serial:0,facing:1,direction:{x:1,y:0},motion:null,hitUntil:0};
  let id=0;for(const room of this.map.rooms){if(room.id===0)continue;const count=3+room.id%3;
   for(let i=0;i<count;i++){const species=ROGUE_SPECIES[(room.id*3+i+seed)%ROGUE_SPECIES.length],x=tileCenter(room.x1+2+i%3*2),y=tileCenter(room.y1+2+Math.floor(i/3)*3);
    const boss=dist(room.center,this.map.exit)<1&&i===count-1,kind=boss?1031:species,radius=boss?22:kind===1102||kind===1103?15:12,hp=boss?500:kind===1102?160:100;
    this.mobs.push({id:++id,room:room.id,species:kind,x,y,hp,maxHP:hp,radius,state:'idle',until:0,hitUntil:0,target:{x,y},boss});
   }
  }
 }
 private pose(action:string){if(this.hero.action!==action){this.hero.action=action;this.hero.serial++;}}
 private space(p:Point,ignore=-1){return walkable(this.map,p.x,p.y)&&this.mobs.every(m=>m.id===ignore||m.hp<=0||dist(p,m)>=12+m.radius-1);}
 private heroMove(dx:number,dy:number,airborne=false){const p=moveOnMap(this.map,this.hero,dx,dy);if(airborne||this.space(p)){this.hero.x=p.x;this.hero.y=p.y;}else{for(const v of [{x:p.x,y:this.hero.y},{x:this.hero.x,y:p.y}])if(this.space(v)){this.hero.x=v.x;this.hero.y=v.y;}}}
 private hit(m:RogueMob,damage:number){m.hp=Math.max(0,m.hp-damage);m.hitUntil=this.elapsed+.15;if(m.hp===0){m.state='dead';m.until=this.elapsed;this.kills++;this.gold+=m.boss?100:10;}}
 private effect(kind:RogueFx['kind']){this.fx.push({id:++this.fxId,kind,born:this.elapsed,x:this.hero.x,y:this.hero.y,angle:Math.atan2(this.hero.direction.y,this.hero.direction.x)});}
 private land(m:RogueMotion){if(this.space(this.hero))return;const span=dist(m.from,m.to),steps=Math.max(1,Math.ceil(span/4));for(let i=steps;i>=0;i--){const t=i/steps,p={x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t};if(this.space(p)){this.hero.x=p.x;this.hero.y=p.y;return;}}this.hero.x=m.from.x;this.hero.y=m.from.y;}
 command(input:RogueInput){
  if(this.status!=='playing')return false;this.auto=input.auto;
  if(this.hero.motion){if(input.skill!==undefined)this.pendingSkill=input.skill;return false;}
  if(input.skill!==undefined&&this.cooldowns[input.skill]<=0){const skill=input.skill;this.cooldowns[skill]=[5,7,10][skill];this.hero.motion={kind:'skill',skill,start:this.elapsed,duration:.7,hitAt:.25,done:false,from:{x:this.hero.x,y:this.hero.y},to:{x:this.hero.x,y:this.hero.y}};this.pose(['skill1','skill2','rest1'][skill]);return true;}
  if(input.jump&&this.elapsed>=this.jumpAt||input.dodge&&this.elapsed>=this.dodgeAt){const jump=!!input.jump,dir=Math.hypot(input.x,input.y)>.1?unit(input.x,input.y):jump?{x:0,y:0}:this.hero.direction,duration=jump ? .86 : .36,distance=jump?150:120;
   let to=moveOnMap(this.map,this.hero,dir.x*distance,dir.y*distance);const touched=this.mobs.filter(m=>m.hp>0&&dist(m,this.hero)+dist(m,to)<=dist(this.hero,to)+m.radius*2+24);
   if(touched.length>3)to={x:this.hero.x,y:this.hero.y};
   this.hero.motion={kind:jump?'jump':'dodge',start:this.elapsed,duration,hitAt:0,done:true,from:{x:this.hero.x,y:this.hero.y},to};if(jump)this.jumpAt=this.elapsed+1.05;else this.dodgeAt=this.elapsed+1.2;this.pose(jump?'jump1':'avoid1');return true;
  }
  if(input.attack)return this.attack();return false;
 }
 private attack(){if(this.elapsed<this.attackAt)return false;const target=this.mobs.filter(m=>m.hp>0&&dist(m,this.hero)<110&&lineClear(this.map,this.hero,m)).sort((a,b)=>dist(a,this.hero)-dist(b,this.hero))[0];
  if(target){this.hero.direction=unit(target.x-this.hero.x,target.y-this.hero.y);if(Math.abs(this.hero.direction.x)>.1)this.hero.facing=Math.sign(this.hero.direction.x);}
  this.combo=(this.combo%5)+1;this.attackAt=this.elapsed+.56;this.hero.motion={kind:'attack',start:this.elapsed,duration:.56,hitAt:.2,done:false,from:{x:this.hero.x,y:this.hero.y},to:{x:this.hero.x,y:this.hero.y}};this.pose('attack'+this.combo);this.hero.serial++;return true;
 }
 step(dt:number,input:RogueInput){
  if(this.status!=='playing')return;dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.025));this.elapsed+=dt;this.cooldowns=this.cooldowns.map(c=>Math.max(0,c-dt));this.fx=this.fx.filter(f=>this.elapsed-f.born<.65);
  const m=this.hero.motion;
  if(m){const age=this.elapsed-m.start;
   if(m.kind==='jump'||m.kind==='dodge'){const t=Math.min(1,age/m.duration);this.heroMove(m.from.x+(m.to.x-m.from.x)*t-this.hero.x,m.from.y+(m.to.y-m.from.y)*t-this.hero.y,true);if(m.kind==='jump')this.pose(t<.12?'jump1':t<.35?'jump2':t<.65?'jump3':t<.9?'jump4':'jump5');}
   if(!m.done&&age>=m.hitAt){m.done=true;const skill=m.kind==='skill'?m.skill:-1;this.effect(skill===0?'rift':skill===1?'dash':skill===2?'heal':'slash');
    if(skill===2)this.hero.hp=Math.min(this.hero.maxHP,this.hero.hp+2500);
    else for(const enemy of this.mobs){if(enemy.hp<=0||!lineClear(this.map,this.hero,enemy))continue;const d=dist(enemy,this.hero),dot=((enemy.x-this.hero.x)*this.hero.direction.x+(enemy.y-this.hero.y)*this.hero.direction.y)/(d||1),range=skill===0?180:skill===1?200:100;
     if(d<=range+enemy.radius&&(skill===0||dot>-.15))this.hit(enemy,skill===-1?50:110);
    }
   }
   if(age>=m.duration){if(m.kind==='jump'||m.kind==='dodge')this.land(m);this.hero.motion=null;this.pose('stay1');}
  }else if(this.pendingSkill!==null&&this.cooldowns[this.pendingSkill]<=0){const skill=this.pendingSkill;this.pendingSkill=null;this.command({...input,skill});
  }else{const move=unit(input.x,input.y),length=Math.min(1,Math.hypot(input.x,input.y));
   if(length>.1){this.hero.direction=move;if(Math.abs(move.x)>.15)this.hero.facing=Math.sign(move.x);this.heroMove(move.x*180*length*dt,move.y*180*length*dt);this.pose('run1');}
   else if(input.attack||input.auto&&this.mobs.some(e=>e.hp>0&&dist(e,this.hero)<100+e.radius&&lineClear(this.map,this.hero,e)))this.attack();else this.pose('stay1');
  }
  for(const r of this.map.rooms)if(cell(this.hero.x)>=r.x1&&cell(this.hero.x)<=r.x2&&cell(this.hero.y)>=r.y1&&cell(this.hero.y)<=r.y2){this.room=r.id;this.visited.add(r.id);}
  for(const r of this.map.rooms)if(this.visited.has(r.id)&&!this.mobs.some(e=>e.room===r.id&&e.hp>0))this.cleared.add(r.id);
  if(this.elapsed>=this.navAt){this.navAt=this.elapsed+.4;this.nav=new RotPath.Dijkstra(cell(this.hero.x),cell(this.hero.y),(x,y)=>x>=0&&y>=0&&x<this.map.width&&y<this.map.height&&this.map.tiles[y*this.map.width+x]===0,{topology:4});}
  for(const enemy of this.mobs){if(enemy.hp<=0)continue;const d=dist(enemy,this.hero),profile=LABYRINTH.monsters[enemy.species];
   if(enemy.state==='windup'){if(this.elapsed>=enemy.until){enemy.state='recover';enemy.until=this.elapsed+.8;
     if(this.hero.motion?.kind!=='dodge'&&d<enemy.radius+38&&dist(this.hero,enemy.target)<48&&lineClear(this.map,enemy,this.hero)){this.hero.hp=Math.max(0,this.hero.hp-(enemy.boss?350:65));this.hero.hitUntil=this.elapsed+.15;}
    }continue;}
   if(this.elapsed<enemy.until)continue;
   if(!this.visited.has(enemy.room)&&d>ROGUE_TILE*5){enemy.state='idle';continue;}
   if(d<enemy.radius+28&&lineClear(this.map,enemy,this.hero)){enemy.state='windup';enemy.until=this.elapsed+Math.max(.35,profile.windup);enemy.target={x:this.hero.x,y:this.hero.y};continue;}
   if(d>ROGUE_TILE*14){enemy.state='idle';continue;}enemy.state='walk';if(this.hero.motion?.kind==='jump'||this.hero.motion?.kind==='dodge')continue;
   let goal:Point=this.hero;if(!lineClear(this.map,enemy,this.hero)){let next:Point|null=null;this.nav?.compute(cell(enemy.x),cell(enemy.y),(x,y)=>{if(!next&&(x!==cell(enemy.x)||y!==cell(enemy.y)))next={x:tileCenter(x),y:tileCenter(y)};});if(!next){enemy.state='idle';continue;}goal=next;}
   const dir=unit(goal.x-enemy.x,goal.y-enemy.y),speed=enemy.species===1201?90:enemy.species===1101?80:60,p=moveOnMap(this.map,enemy,dir.x*speed*dt,dir.y*speed*dt,enemy.radius);
   if(dist(p,this.hero)>=enemy.radius+12&&this.mobs.every(o=>o.id===enemy.id||o.hp<=0||dist(o,p)>=o.radius+enemy.radius-2)){enemy.x=p.x;enemy.y=p.y;}
  }
  if(this.hero.hp<=0){this.status='dead';if(this.hero.motion)this.land(this.hero.motion);this.hero.motion=null;this.pose('die1');}
  else if(this.cleared.size===10&&this.mobs.every(e=>e.hp<=0)&&dist(this.hero,this.map.exit)<ROGUE_TILE){this.status='won';this.hero.motion=null;this.pose('stay1');}
 }
 view():RogueSnapshot{return {elapsed:this.elapsed,hero:{...this.hero,direction:{...this.hero.direction},motion:this.hero.motion?{...this.hero.motion,from:{...this.hero.motion.from},to:{...this.hero.motion.to}}:null},mobs:this.mobs.map(m=>({...m,target:{...m.target}})),visited:[...this.visited],cleared:[...this.cleared],room:this.room,status:this.status,kills:this.kills,gold:this.gold,cooldowns:[...this.cooldowns],jumpReady:this.elapsed>=this.jumpAt&&!this.hero.motion,dodgeReady:this.elapsed>=this.dodgeAt&&!this.hero.motion,auto:this.auto,fx:this.fx.map(f=>({...f}))};}
}
