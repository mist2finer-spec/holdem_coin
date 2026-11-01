import {ROGUE_TILE,type RogueMap,type SceneryStyle} from './map';
import {drawDungeonFloor,FLOOR_SURFACE} from './floor-surface';
/** Source rectangles measured in the generated atlas; no runtime cutout editing or grid assumptions. */
export const DUNGEON_PARTS={
 crypt:[22,82,352,251],moss:[405,82,357,251],prison:[793,82,332,251],cathedral:[1156,82,357,251],
 floor:[23,503,461,138],brokenFloor:[513,503,452,138],pillar:[1035,364,128,301],candle:[1243,362,245,304],
 closed:[48,678,288,307],open:[412,677,369,310],statue:[900,667,138,324],rubble:[1106,797,401,194]
} as const;
export const SCENERY_LABELS:Record<SceneryStyle,string>={crypt:'고대 석실',moss:'이끼 회랑',prison:'지하 감옥',cathedral:'잊힌 성소'};
export type SceneryCamera={width:number;height:number;zoom:number;sx:(x:number)=>number;sy:(y:number,z?:number)=>number};
export function drawModularScenery(ctx:CanvasRenderingContext2D,image:CanvasImageSource,map:RogueMap,currentRoom:number,cleared:readonly number[],elapsed:number,c:SceneryCamera){
 const {width:w,height:h,zoom,sx,sy}=c,current=map.rooms[currentRoom];
 const part=(name:keyof typeof DUNGEON_PARTS,x:number,y:number,width:number,height:number)=>{const r=DUNGEON_PARTS[name];ctx.drawImage(image,r[0],r[1],r[2],r[3],x,y,width,height);};
 // Tall distant masonry fills the portrait window, with slower movement than the play plane.
 const wallWidth=240*zoom,wallHeight=172*zoom,shift=((sx(current.x1*ROGUE_TILE)*.3)%wallWidth+wallWidth)%wallWidth;
 ctx.save();ctx.globalAlpha=.7;for(let x=shift-wallWidth;x<w;x+=wallWidth)for(let y=-wallHeight;y<h;y+=wallHeight)part(current.scenery,x,y,wallWidth+.5,wallHeight+.5);ctx.restore();
 const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#050c12bb');shade.addColorStop(1,'#060b0f22');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
 for(const room of map.rooms){
  const left=sx(room.x1*ROGUE_TILE),right=sx((room.x2+1)*ROGUE_TILE);if(right<0||left>w)continue;
  const floorY=sy(map.start.y,room.elevation),alternate=room.column===current.column&&room.id!==currentRoom;
  const clipTop=Math.max(0,floorY-230*zoom);
  ctx.save();ctx.beginPath();ctx.rect(left,clipTop,right-left,Math.max(h,floorY+80*zoom)-clipTop);ctx.clip();ctx.globalAlpha=alternate?.65:1;
  const panelWidth=192*zoom,first=Math.max(0,Math.floor((0-left)/panelWidth));
  for(let i=first;left+i*panelWidth<Math.min(w,right);i++)part(room.scenery,left+i*panelWidth,floorY-175*zoom,panelWidth+.7,175*zoom);
  drawDungeonFloor(ctx,room.scenery,left,right,floorY,zoom,w,h);
  for(const decor of room.decor){const x=sx(decor.x);if(x<-130*zoom||x>w+130*zoom)continue;
   const decorY=floorY-(decor.kind==='rubble'?12:FLOOR_SURFACE.back)*zoom;
   const size=decor.kind==='pillar'?[72,172]:decor.kind==='candle'?[63,90]:decor.kind==='statue'?[69,158]:[102,48];
   part(decor.kind,x-size[0]*zoom/2,decorY-size[1]*zoom,size[0]*zoom,size[1]*zoom);
   if(decor.kind==='pillar'||decor.kind==='candle'){const flameY=decorY-(decor.kind==='pillar'?105:72)*zoom,radius=70*zoom;
    const glow=ctx.createRadialGradient(x,flameY,0,x,flameY,radius);glow.addColorStop(0,`rgba(255,159,54,${.11+Math.sin(elapsed*8+decor.x)*.025})`);glow.addColorStop(1,'rgba(255,140,30,0)');ctx.fillStyle=glow;ctx.fillRect(x-radius,flameY-radius,radius*2,radius*2);}
  }
  const gates=map.gates.filter(g=>g.fromRoom===room.id);if(gates.length){const x=sx(gates[0].from.x),open=cleared.includes(room.id);part(open?'open':'closed',x-43*zoom,floorY-115*zoom,86*zoom,115*zoom);}
  ctx.restore();
 }
}
