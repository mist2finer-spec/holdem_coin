import {AnimationState,AnimationStateData,AtlasAttachmentLoader,CanvasTexture,Physics,Skeleton,SkeletonJson,SkeletonRenderer,TextureAtlas,MeshAttachment,RegionAttachment} from '@esotericsoftware/spine-canvas';
import {FOV} from 'rot-js';
import {LABYRINTH} from '../hunt-labyrinth';
import {groundSkeleton} from '../hunt-ground';
import {hongNativeContact,HONG_NATIVE_FOOT_SLOTS} from '../hong-native-motion';
import {hongMotionTime} from '../hong-combat-motion';
import {ROGUE_TILE,cell,terrainElevation,type RogueMap} from './map';
import {PASSAGE_LABEL} from './traversal';
import type {RogueSnapshot,RogueMob} from './engine';
/** One world-unit ruler: actor 88, wall 52, floor tile 48, corridor 144. No independent map stretch. */
export const ROGUE_VISUAL={heroHeight:88,smallHeight:40,bossHeight:94,wallHeight:52,viewportWidth:640,depth:.72} as const;
const root='/rpg/';
const loadImage=(url:string,signal:AbortSignal)=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();const abort=()=>{im.src='';reject(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',abort,{once:true});im.onload=()=>{signal.removeEventListener('abort',abort);resolve(im);};im.onerror=()=>{signal.removeEventListener('abort',abort);reject(Error('에셋 로딩 실패: '+url));};im.src=url;});
async function rig(path:string,signal:AbortSignal,feet:readonly string[]){
 const [data,text]=await Promise.all([fetch(root+path+'.json',{signal}).then(r=>{if(!r.ok)throw Error(path);return r.json();}),fetch(root+path+'.atlas',{signal}).then(r=>{if(!r.ok)throw Error(path);return r.text();})]);
 const atlas=new TextureAtlas(text),folder=path.slice(0,path.lastIndexOf('/')+1);
 for(const page of atlas.pages)page.setTexture(new CanvasTexture(await loadImage(root+folder+page.name,signal)));
 const skeletonData=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(data),s=new Skeleton(skeletonData);if(skeletonData.skins.length)s.setSkin(skeletonData.skins[0]);
 const state=new AnimationState(new AnimationStateData(skeletonData));state.data.defaultMix=.06;
 const clips=skeletonData.animations.map(a=>a.name),idle=clips.includes('stay1')?'stay1':clips[0];state.setAnimation(0,idle,true);state.apply(s);s.updateWorldTransform(Physics.pose);
 const body=s.getBoundsRect();let height=Math.max(1,body.height);
 // Exclude axe reach and decorative hair from the character's body ruler.
 if(path.startsWith('characters/')){let top=Infinity,bottom=-Infinity;for(const slot of s.slots){if(!['head','body','Rleg','Lleg2'].includes(slot.data.name))continue;const a=slot.getAttachment();let v:Float32Array;if(a instanceof MeshAttachment){v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,v.length,v,0,2);}else if(a instanceof RegionAttachment){v=new Float32Array(8);a.computeWorldVertices(slot,v,0,2);}else continue;for(let i=1;i<v.length;i+=2){top=Math.min(top,v[i]);bottom=Math.max(bottom,v[i]);}}if(Number.isFinite(top)&&bottom>top)height=bottom-top;}

 return {atlas,s,state,clips,height,feet,clone(){const cs=new Skeleton(skeletonData);if(skeletonData.skins.length)cs.setSkin(skeletonData.skins[0]);return {s:cs,state:new AnimationState(new AnimationStateData(skeletonData)),key:''};}};
}
export async function createRogueRenderer(canvas:HTMLCanvasElement,map:RogueMap,signal:AbortSignal){
 Skeleton.yDown=true;const ctx=canvas.getContext('2d')!,skeletonRenderer=new SkeletonRenderer(ctx);skeletonRenderer.triangleRendering=true;
 const species=[...new Set([1001,1002,1003,1051,1101,1102,1103,1201,1031])];
 const [hero,floor,wall,flame,monsters]=await Promise.all([
  rig('characters/hong/native-axe/hong',signal,HONG_NATIVE_FOOT_SLOTS),loadImage(root+'maps/candle-dungeon/textures/8fc6a24c9fa1201c.png',signal),loadImage(root+'maps/candle-dungeon/textures/7c8bd537db964e9d.png',signal),loadImage(root+'maps/candle-dungeon/textures/2a5fa6602875c8d0.png',signal),
  Promise.all(species.map(async id=>{const profile=LABYRINTH.monsters[id],a=LABYRINTH.assets[profile.asset];return [id,{rig:await rig(a.skeleton,signal,a.groundSlots),clips:a.clips}] as const;}))]);
 const sources=new Map(monsters),actors=new Map<number,ReturnType<typeof hero.clone>>();let heroKey='',visible=new Set<number>(),explored=new Set<number>(),lastCell=-1,flameTime=0;
 const fov=new FOV.PreciseShadowcasting((x,y)=>x>=0&&y>=0&&x<map.width&&y<map.height&&map.tiles[y*map.width+x]===0,{topology:8});
 let hx=map.start.x,hy=map.start.y,hz=map.rooms[0].elevation,heroZ=hz;const positions=new Map<number,{x:number;y:number}>();
 return {draw(view:RogueSnapshot,dt:number){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#141917';ctx.fillRect(0,0,w,h);
  const zoom=w/ROGUE_VISUAL.viewportWidth,depth=ROGUE_VISUAL.depth;hx+=(view.hero.x-hx)*(1-Math.exp(-dt*24));hy+=(view.hero.y-hy)*(1-Math.exp(-dt*24));
  heroZ+=(view.hero.elevation-heroZ)*(1-Math.exp(-dt*24));hz+=(view.hero.elevation-hz)*(1-Math.exp(-dt*5));
  const sx=(x:number)=>(x-hx)*zoom+w/2,sy=(y:number,z=0)=>(y-hy)*zoom*depth+h*.58-(z-hz)*zoom;
  const groundY=(x:number,y:number)=>sy(y,terrainElevation(map,x));
  const currentCell=cell(view.hero.y)*map.width+cell(view.hero.x);if(currentCell!==lastCell){lastCell=currentCell;visible=new Set();fov.compute(cell(view.hero.x),cell(view.hero.y),12,(x,y)=>{if(x>=0&&y>=0&&x<map.width&&y<map.height){const k=y*map.width+x;visible.add(k);explored.add(k);}});}
  const xmin=Math.max(0,cell(hx-w/zoom/2)-2),xmax=Math.min(map.width-1,cell(hx+w/zoom/2)+2),ymin=Math.max(0,cell(hy-h/(zoom*depth))-2),ymax=Math.min(map.height-1,cell(hy+h/(zoom*depth))+2);
  ctx.imageSmoothingEnabled=true;const tile=ROGUE_TILE*zoom;
  // Stone volume behind the traversable floor. Unseen space stays dim, not an empty black void.
  for(let y=ymin;y<=ymax;y+=2)for(let x=xmin;x<=xmax;x+=2){const px=sx(x*ROGUE_TILE),py=sy(y*ROGUE_TILE);ctx.globalAlpha=.18;ctx.drawImage(wall,px,py,tile*2+1,tile*depth*2+1);}ctx.globalAlpha=1;
  // Entered chambers read as complete side-view arenas; corridors retain shadow-cast discovery.
  const revealed=[map.rooms[view.room]];
  // The player must see a landing platform across a non-walkable chasm. FOV walls alone hide it.
  if(view.gate?.ready)revealed.push(map.rooms[view.gate.nextRoom]);
  for(const chamber of revealed)if(chamber)for(let y=chamber.y1;y<=chamber.y2;y++)for(let x=chamber.x1;x<=chamber.x2;x++){const k=y*map.width+x;visible.add(k);explored.add(k);}

  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const index=y*map.width+x;const northWall=map.tiles[index]!==0&&y+1<map.height&&map.tiles[index+map.width]===0;const known=explored.has(index)||(northWall&&explored.has(index+map.width));if(!known)continue;const px=sx(x*ROGUE_TILE),py=groundY((x+.5)*ROGUE_TILE,y*ROGUE_TILE);if(px> w+tile||px< -tile||py>h+tile||py< -tile*2)continue;
   ctx.globalAlpha=visible.has(index)||(northWall&&visible.has(index+map.width))?1:.3;
   if(map.tiles[index]===0){ctx.drawImage(floor,px,py,tile+.5,tile*depth+.5);ctx.fillStyle=`rgba(22,19,16,${.16+((x*13+y*7)%5)*.012})`;ctx.fillRect(px,py,tile,tile*depth);ctx.strokeStyle='#0002';ctx.lineWidth=.5;ctx.strokeRect(px,py,tile,tile*depth);
    // Recessed stone walkway lip: decoration never changes the collision tile.
    if(map.tiles[index+map.width]!==0){ctx.drawImage(wall,px,py+tile*depth,tile+.5,32*zoom);ctx.fillStyle='#080d0c99';ctx.fillRect(px,py+tile*depth,tile,32*zoom);ctx.fillStyle='#080d0cbc';ctx.fillRect(px,py+tile*depth-5*zoom,tile,5*zoom);ctx.fillStyle='#c4ae752e';ctx.fillRect(px,py+tile*depth-6*zoom,tile,1*zoom);}
    if(map.tiles[index-1]!==0){ctx.fillStyle='#0a0e0f70';ctx.fillRect(px,py,4*zoom,tile*depth);}
   }
   else if(y+1<map.height&&map.tiles[index+map.width]===0){const height=ROGUE_VISUAL.wallHeight*zoom;ctx.drawImage(wall,px,py+tile*depth-height,tile+.5,height);ctx.fillStyle='#c6a57133';ctx.fillRect(px,py+tile*depth-height,tile,3*zoom);ctx.fillStyle='#0007';ctx.fillRect(px,py+tile*depth-5*zoom,tile,5*zoom);
    if((x*3+y)%7===0&&visible.has(index)){const cx=px+tile/2,cy=py+tile*depth-height*.65;const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,90*zoom);glow.addColorStop(0,'#ffb34e30');glow.addColorStop(1,'#ffb34e00');ctx.fillStyle=glow;ctx.fillRect(cx-90*zoom,cy-90*zoom,180*zoom,180*zoom);ctx.fillStyle='#443328';ctx.fillRect(cx-3*zoom,cy,6*zoom,18*zoom);const frame=(Math.floor(flameTime*16)+x*5+y*3)%16;ctx.save();ctx.globalCompositeOperation='lighter';ctx.drawImage(flame,(frame%4)*64,(3-Math.floor(frame/4))*64,64,64,cx-14*zoom,cy-25*zoom,28*zoom,34*zoom);ctx.restore();}
   }else{ctx.fillStyle='#14171a';ctx.fillRect(px,py,tile+.5,tile*depth+.5);}
  }ctx.globalAlpha=1;flameTime+=dt;
  // Source-style action links: elevation changes, open chasms, climbing ledges and low lintels.
  const drawGates=(overhead:boolean)=>{for(const gate of map.gates){
   if(!view.visited.includes(gate.id))continue;
   const left=sx(gate.from.x+ROGUE_TILE/2),right=sx(gate.to.x-ROGUE_TILE/2),middle=(left+right)/2;
   const nearTop=sy(6*ROGUE_TILE,gate.from.elevation),nearBottom=sy(9*ROGUE_TILE,gate.from.elevation);
   const farTop=sy(6*ROGUE_TILE,gate.to.elevation),farBottom=sy(9*ROGUE_TILE,gate.to.elevation);
   if(right<0||left>w)continue;const open=view.cleared.includes(gate.id),passed=view.transitions.includes(gate.id),ink=open?'#dcca88':'#b57867';
   ctx.save();ctx.globalAlpha=1;
   if(!overhead){
    if(gate.kind==='jump'){
     const top=Math.min(nearTop,farTop),bottom=Math.max(nearBottom,farBottom)+70*zoom;
     const pit=ctx.createLinearGradient(0,top,0,bottom);pit.addColorStop(0,'#081314');pit.addColorStop(1,'#020406');ctx.fillStyle=pit;ctx.fillRect(left,top,right-left,bottom-top);
     // Stone cut faces show the platform height instead of painting a gap on flat floor.
     for(const [x,y,edge] of [[left-9*zoom,nearTop,nearBottom],[right,farTop,farBottom]]){
      ctx.drawImage(wall,x,y,9*zoom,bottom-y);ctx.fillStyle='#0005';ctx.fillRect(x,y,9*zoom,bottom-y);ctx.fillStyle='#b5a27b';ctx.fillRect(x,y,9*zoom,2*zoom);ctx.fillRect(x,edge,9*zoom,2*zoom);
     }
     for(const ledge of gate.ledges){
      const x=sx(ledge.x),y=sy(ledge.y,ledge.elevation),lw=32*zoom,lh=24*zoom;
      ctx.drawImage(wall,x-lw/2,y,lw,lh);ctx.fillStyle='#0005';ctx.fillRect(x-lw/2,y+5*zoom,lw,lh-5*zoom);
      ctx.drawImage(floor,x-lw/2,y-10*zoom,lw,10*zoom);ctx.fillStyle='#d7c58d';ctx.fillRect(x-lw/2,y-2*zoom,lw,2*zoom);
     }
    }
    if(!open){ctx.fillStyle='#60251f55';ctx.fillRect(sx(gate.from.x+13),nearTop,8*zoom,nearBottom-nearTop);ctx.strokeStyle='#d58b70';ctx.lineWidth=2*zoom;for(let y=nearTop;y<nearBottom;y+=15*zoom){ctx.beginPath();ctx.moveTo(sx(gate.from.x+9),y);ctx.lineTo(sx(gate.from.x+23),y+9*zoom);ctx.stroke();}}
    ctx.fillStyle=ink;ctx.font=`bold ${Math.max(10,14*zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillText(!open?'적 전멸 시 개방':PASSAGE_LABEL[gate.passage],middle,Math.min(nearTop,farTop)-20*zoom);
    if(open&&!passed){ctx.strokeStyle='#e0c77d';ctx.lineWidth=2*zoom;ctx.beginPath();ctx.ellipse(sx(gate.from.x),sy(gate.from.y,gate.from.elevation),20*zoom,12*zoom,0,0,Math.PI*2);ctx.stroke();}
   }else if(gate.kind==='slide'){
    const beamY=sy(gate.from.y,gate.from.elevation)-34*zoom,beamH=22*zoom;ctx.drawImage(wall,left-5*zoom,beamY-beamH,right-left+10*zoom,beamH);ctx.fillStyle='#dbc291';ctx.fillRect(left-5*zoom,beamY-beamH,right-left+10*zoom,3*zoom);
    for(const x of [left-8*zoom,right]){ctx.drawImage(wall,x,nearTop-35*zoom,8*zoom,nearBottom-nearTop+35*zoom);ctx.fillStyle='#080e0e88';ctx.fillRect(x,nearTop-35*zoom,2*zoom,nearBottom-nearTop+35*zoom);}
   }ctx.restore();
  }};drawGates(false);
  const exitVisible=explored.has(cell(map.exit.y)*map.width+cell(map.exit.x));if(exitVisible){const x=sx(map.exit.x),y=groundY(map.exit.x,map.exit.y);ctx.fillStyle=view.cleared.length===10?'#61d7c9':'#91734c';ctx.beginPath();ctx.ellipse(x,y,24*zoom,15*zoom,0,0,Math.PI*2);ctx.fill();ctx.font=`${12*zoom}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff0cb';ctx.fillText(view.cleared.length===10?'탈출':'출구',x,y-28*zoom);}
  const shade=ctx.createRadialGradient(w/2,h*.58,25,w/2,h*.58,w*.8);shade.addColorStop(0,'#03080a08');shade.addColorStop(1,'#02060965');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  for(const room of map.rooms)for(const tx of [room.x1+1,room.x2-1]){const ty=room.y1;if(!visible.has(ty*map.width+tx))continue;const x=sx((tx+.5)*ROGUE_TILE),y=sy((ty+.65)*ROGUE_TILE,room.elevation),size=34*zoom;
   const glow=ctx.createRadialGradient(x,y-12*zoom,0,x,y-12*zoom,100*zoom);glow.addColorStop(0,'#ffb25240');glow.addColorStop(1,'#ff9e3000');ctx.fillStyle=glow;ctx.fillRect(x-100*zoom,y-112*zoom,200*zoom,200*zoom);
   ctx.fillStyle='#8d7546';ctx.fillRect(x-5*zoom,y-2*zoom,10*zoom,4*zoom);ctx.fillStyle='#d5be83';ctx.fillRect(x-2*zoom,y-16*zoom,4*zoom,15*zoom);
   const frame=(Math.floor(flameTime*16)+tx+ty)%16;ctx.save();ctx.globalCompositeOperation='lighter';ctx.drawImage(flame,(frame%4)*64,(3-Math.floor(frame/4))*64,64,64,x-size/2,y-16*zoom-size*.8,size,size);ctx.restore();
  }
  const drawActor=(s:typeof hero.s,state:typeof hero.state,feet:readonly string[],baseHeight:number,action:string,x:number,y:number,height:number,facing:number,time:number,key:string,oldKey:string,trackTime?:number,elevation=terrainElevation(map,x))=>{
   if(key!==oldKey){s.setSlotsToSetupPose();state.setAnimation(0,action,/stay|run/.test(action));}state.update(Math.min(.05,dt));if(trackTime!==undefined)state.getCurrent(0)!.trackTime=trackTime;state.apply(s);s.x=sx(x);s.y=sy(y,elevation);s.scaleX=height/baseHeight*zoom*facing;s.scaleY=height/baseHeight*zoom;s.update(Math.min(.05,dt));s.updateWorldTransform(Physics.update);groundSkeleton(s,sy(y,elevation)-time,feet);skeletonRenderer.draw(s);
  };
  const mobs=view.mobs.filter(m=>explored.has(cell(m.y)*map.width+cell(m.x))&&visible.has(cell(m.y)*map.width+cell(m.x))&&(m.hp>0||view.elapsed-m.until<.5));
  const ordered:({kind:'mob';mob:RogueMob}|{kind:'hero';y:number})[]=[...mobs.map(m=>({kind:'mob' as const,mob:m})),{kind:'hero',y:hy}];ordered.sort((a,b)=>(a.kind==='mob'?a.mob.y:a.y)-(b.kind==='mob'?b.mob.y:b.y));
  for(const actor of ordered){
   if(actor.kind==='hero'){
    const m=view.hero.motion,age=m?Math.max(0,view.elapsed-m.start):0,t=m?Math.min(1,age/m.duration):0,air=view.hero.airHeight*zoom,action=hero.clips.includes(view.hero.action)?view.hero.action:'stay1',key=view.hero.serial+':'+action;
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(sx(hx),sy(hy,heroZ)+2,20*zoom,7*zoom,0,0,Math.PI*2);ctx.fill();hero.s.color.a=view.hero.hitUntil>view.elapsed?.65:1;
    const clipDuration=hero.s.data.findAnimation(action)!.duration,trackTime=m&&(m.kind==='attack'||m.kind==='skill')?hongMotionTime(age,m.duration,m.hitAt,clipDuration,hongNativeContact(action,clipDuration),false):undefined;
    drawActor(hero.s,hero.state,hero.feet,hero.height,action,hx,hy,ROGUE_VISUAL.heroHeight,view.hero.facing,air,key,heroKey,trackTime,heroZ);heroKey=key;canvas.dataset.jumpHeight=String(air/zoom);
   }else{
    const m=actor.mob,source=sources.get(m.species)!;let a=actors.get(m.id);if(!a){a=source.rig.clone();actors.set(m.id,a);}let p=positions.get(m.id);if(!p){p={x:m.x,y:m.y};positions.set(m.id,p);}p.x+=(m.x-p.x)*(1-Math.exp(-dt*24));p.y+=(m.y-p.y)*(1-Math.exp(-dt*24));
    const clip=m.hp<=0?source.clips.death:m.state==='windup'?source.clips.attack:m.state==='walk'?source.clips.move:source.clips.idle,action=source.rig.clips.includes(clip)?clip:source.rig.clips[0],key=action+':'+(m.state==='windup'?m.until:0),height=m.boss?ROGUE_VISUAL.bossHeight:m.species===1102?68:ROGUE_VISUAL.smallHeight;
    ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(sx(p.x),sy(p.y,map.rooms[m.room].elevation),m.radius*zoom,5*zoom,0,0,Math.PI*2);ctx.fill();a.s.color.a=m.hp<=0?Math.max(0,1-(view.elapsed-m.until)*2):1;
    drawActor(a.s,a.state,source.rig.feet,source.rig.height,action,p.x,p.y,height,m.x>view.hero.x?-1:1,0,key,a.key);a.key=key;
    if(m.hp>0){const width=(m.boss?58:30)*zoom,x=sx(p.x),y=sy(p.y,map.rooms[m.room].elevation)-height*zoom-8*zoom;ctx.fillStyle='#160d0d';ctx.fillRect(x-width/2,y,width,3);ctx.fillStyle=m.boss?'#d6ac60':'#d56f61';ctx.fillRect(x-width/2,y,width*m.hp/m.maxHP,3);}
    if(m.state==='windup'){ctx.strokeStyle='#ff8059';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx(m.target.x),sy(m.target.y,map.rooms[m.room].elevation),34*zoom,24*zoom,0,0,Math.PI*2);ctx.stroke();}
   }
  }
  drawGates(true);
  for(const f of view.fx){
   if(f.kind==='damage'||f.kind==='gold'){
    if(!visible.has(cell(f.y)*map.width+cell(f.x)))continue;
    const t=Math.max(0,Math.min(1,view.elapsed-f.born)),drift=((f.id%3)-1)*18*zoom;
    const x=sx(f.x)+drift*t,y=groundY(f.x,f.y)-(f.kind==='gold'?30:65)*zoom-45*zoom*t+18*zoom*t*t;
    ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*4);ctx.textAlign='center';ctx.font=`bold ${Math.max(11,(f.kind==='gold'?15:22)*zoom)}px sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#101414';
    const text=f.kind==='gold'?`+${f.value} G`:String(f.value);ctx.strokeText(text,x,y);ctx.fillStyle=f.kind==='gold'?'#f0ce7c':f.target==='hero'?'#f79586':'#fff1c5';ctx.fillText(text,x,y);ctx.restore();continue;
   }
   const t=(view.elapsed-f.born)/.65;ctx.save();ctx.translate(sx(f.x),groundY(f.x,f.y)-20*zoom);ctx.scale(zoom,zoom*depth);ctx.rotate(f.angle);ctx.globalAlpha=Math.max(0,1-t);ctx.strokeStyle=f.kind==='heal'?'#8de6a5':f.kind==='rift'?'#d6b47f':'#bce9ed';ctx.lineWidth=f.kind==='slash'?10:4;ctx.beginPath();if(f.kind==='slash')ctx.arc(0,0,70+t*35,-1.4,1.4);else ctx.ellipse(0,0,30+t*150,30+t*150,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  // Compact route strip shows the local arena and its next movement requirement.
  const gate=view.gate;ctx.fillStyle='#081012df';ctx.fillRect(w-105,10,96,43);ctx.strokeStyle='#ad8b4d66';ctx.strokeRect(w-105,10,96,43);ctx.textAlign='center';ctx.font='10px sans-serif';ctx.fillStyle='#cdbf98';ctx.fillText('NEXT PASSAGE',w-57,25);ctx.font='bold 12px sans-serif';ctx.fillStyle=gate?.ready?'#e7d48e':'#b8c2b7';ctx.fillText(gate?PASSAGE_LABEL[gate.passage]:'최종 출구',w-57,43);
  canvas.dataset.heroAction=view.hero.action;canvas.dataset.autoTarget=String(Math.min(10,view.autoRoom+1));canvas.dataset.autoOrder=view.autoOrder.map(i=>i+1).join(',');canvas.dataset.mode='rogue';canvas.dataset.presentation='vardian-elevation';canvas.dataset.elevation=String(view.hero.elevation);canvas.dataset.passage=view.gate?.passage??'exit';canvas.dataset.phase=view.phase;canvas.dataset.gate=String(view.gate?.kind??'exit');canvas.dataset.transitions=view.transitions.join(',');canvas.dataset.rooms=String(map.rooms.length);canvas.dataset.visibleMonsters=String(mobs.filter(m=>m.hp>0).length);canvas.dataset.heroHeight=String(ROGUE_VISUAL.heroHeight);canvas.dataset.tileSize=String(ROGUE_TILE);canvas.dataset.worldX=String(view.hero.x);canvas.dataset.worldY=String(view.hero.y);canvas.dataset.status='ready';
 },dispose(){hero.atlas.dispose();for(const s of sources.values())s.rig.atlas.dispose();actors.clear();positions.clear();}};
}
