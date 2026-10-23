import {CanvasTexture, SkeletonRenderer as CanvasRenderer} from '@esotericsoftware/spine-canvas';
import {AnimationState, AnimationStateData, AtlasAttachmentLoader, GLTexture, Physics, SceneRenderer, Skeleton, SkeletonJson, TextureAtlas} from '@esotericsoftware/spine-webgl';
import {HuntEngine} from './hunt-engine';
import {combatCharacter} from './combat-characters';
import {CombatSpriteClock,COMBAT_SPRITE_SCALE,spritePlacement} from './combat-sprite';
import {huntViewport} from './hunt-layout';
import {HUNT_VISUALS} from './hunt-collision';
import {attachmentBottom,groundSkeleton} from './hunt-ground';
const base = '/rpg/';
const image = (url: string, signal: AbortSignal) => new Promise<HTMLImageElement>((resolve, reject) => {
 const img = new Image();
 const abort = () => { img.src = ''; reject(new DOMException('Aborted', 'AbortError')); };
 signal.addEventListener('abort', abort, {once: true});
 img.onload = () => { signal.removeEventListener('abort', abort); resolve(img); };
 img.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error(`이미지 로드 실패: ${url}`)); };
 if (signal.aborted) abort(); else img.src = url;
});
async function actor(name: string, signal: AbortSignal, gl: WebGLRenderingContext | null) {
 const [json, atlasText] = await Promise.all([fetch(base + name + '.json', {signal}).then(r => {if (!r.ok) throw Error(name); return r.json();}), fetch(base + name + '.atlas', {signal}).then(r => {if (!r.ok) throw Error(name); return r.text();})]);
 const atlas = new TextureAtlas(atlasText);
 for (const page of atlas.pages) {
  const folder=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'';
  const img=await image(base + folder + page.name, signal);
  page.setTexture(gl ? new GLTexture(gl,img,true) : new CanvasTexture(img));
 }
 const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);
 const skeleton = new Skeleton(data);
 if (data.skins.length) skeleton.setSkin(data.skins[0]);
 skeleton.setSlotsToSetupPose();
 const stateData = new AnimationStateData(data); stateData.defaultMix = .1;
 const state = new AnimationState(stateData);
 const idle = data.animations.find(a=>/stay1|idle/i.test(a.name));
 if(idle){state.setAnimation(0,idle.name,true);state.apply(skeleton);}
 skeleton.updateWorldTransform(Physics.update);
 return {skeleton, state, atlas,groundSlots:['body'], animation: '', serial:-1, available: data.animations.map(a => a.name)};
}
export async function createHuntRenderer(canvas: HTMLCanvasElement, signal: AbortSignal, characterId='hong') {
 Skeleton.yDown = true;
 const layer = document.createElement('canvas');
 const gl = layer.getContext('webgl', {alpha:true, premultipliedAlpha:true, antialias:true});
 if(!combatCharacter(characterId))throw Error('알 수 없는 캐릭터입니다.');
 const [sheet, enemy, forest, trees] = await Promise.all([image(base+`characters/${characterId}/sheet.png`,signal), actor('Enemy_Slime_01_R', signal, gl), image(base + 'BG_Forest01.png', signal), image(base + 'BG_Tree01.png', signal)]);
 if(sheet.naturalWidth!==1024||sheet.naturalHeight!==1024)throw Error('잘못된 캐릭터 스프라이트 크기');
 const spriteClock=new CombatSpriteClock();
 // Each slime owns its pose/animation state, while sharing immutable skeleton data and atlas textures.
 const enemies=Array.from({length:7},()=>{
  const skeleton=new Skeleton(enemy.skeleton.data);
  if(enemy.skeleton.skin)skeleton.setSkin(enemy.skeleton.skin);
  skeleton.setSlotsToSetupPose();
  return {...enemy,skeleton,state:new AnimationState(enemy.state.data),animation:'',serial:0};
 });
 const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas를 사용할 수 없습니다.');
 const renderer = gl ? new SceneRenderer(layer, gl) : null;
 const fallback = renderer ? null : new CanvasRenderer(ctx);
 if(fallback) fallback.triangleRendering=true;
 canvas.dataset.renderer=renderer?'webgl':'canvas';
 const animate = (a: typeof enemy, anim: string, x: number, y: number, scale: number, direction: number, dt: number,serial=0,speed=1) => {
  const next = a.available.includes(anim) ? anim : a.available.find(n => /stay|idle/i.test(n)) || a.available[0];
  if ((a.animation !== next||a.serial!==serial) && next) { a.state.setAnimation(0, next, /stay|idle|run/i.test(next)); a.animation = next;a.serial=serial; }
  a.skeleton.x = x; a.skeleton.y = y; a.skeleton.scaleX = scale * direction; a.skeleton.scaleY = scale;
  a.state.update(dt*speed); a.state.apply(a.skeleton); a.skeleton.update(dt); a.skeleton.updateWorldTransform(Physics.update); groundSkeleton(a.skeleton,y,a.groundSlots); if(renderer) renderer.drawSkeleton(a.skeleton, true); else fallback!.draw(a.skeleton);
 };
 return {
  draw(game: HuntEngine, dt: number) {
   const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(Math.max(devicePixelRatio || 1, renderer ? 1 : 2), 2);
   if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
   if(layer.width!==canvas.width||layer.height!==canvas.height){layer.width=canvas.width;layer.height=canvas.height;}
   if(gl&&renderer){
    gl.viewport(0,0,layer.width,layer.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.camera.position.set(w/2,h/2,0);renderer.camera.setViewport(w,-h);renderer.begin();
   }
   const floor=h*.76,{zoom,camera,screenX}=huntViewport(w,game.x);
   canvas.dataset.enemyCount=String(game.enemies.filter(e=>e.hp>0).length);
   canvas.dataset.visibleEnemies=String(game.enemies.filter(e=>e.hp>0&&screenX(e.x)>=0&&screenX(e.x)<=w).length);
   const tile = Math.max(h*.8,230), offset = camera*zoom*.22 % tile;
   for(let x=-tile-offset; x<w; x+=tile) ctx.drawImage(forest, x, 0, tile, floor+45);
   const shade = ctx.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, '#04191755'); shade.addColorStop(.55, '#091e1600'); shade.addColorStop(1, '#071b13'); ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#26372a';ctx.fillRect(0,floor+5,w,h-floor);
   ctx.fillStyle='#658150';ctx.fillRect(0,floor+5,w,4);
   ctx.fillStyle='#192a20'; for(let i=0;i<20;i++) ctx.fillRect(i*90-camera%90,floor+28+(i%3)*12,46,3);
   const scale=COMBAT_SPRITE_SCALE*zoom;
   ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(screenX(game.x),floor+4,25*zoom,5*zoom,0,0,Math.PI*2);ctx.fill();
   for(const mob of game.enemies){
    if(mob.hp<=0&&game.elapsed>=mob.respawnAt)continue;
    const visual=enemies[mob.slot],hurt=mob.hp>0&&mob.hitUntil>game.elapsed;
    const anim=mob.hp<=0?'die1':hurt&&visual.available.includes('damage1')?'damage1':'stay1';
    const shake=hurt?Math.sin(game.elapsed*90)*2*zoom:0,x=screenX(mob.x),y=floor;
    animate(visual,anim,x+shake,y,HUNT_VISUALS.slimeScale*zoom,mob.x>game.x?-1:1,dt,mob.serial);
   }
   if(renderer){renderer.end();ctx.drawImage(layer,0,0,w,h);}
   const stage=game.combo.find(s=>s.animation===game.action);
   const frame=spriteClock.frame(game.action,game.actionSerial,dt,game.animationSpeed,stage?.hitAt??.2);
   const pose=spritePlacement(frame,screenX(game.x),floor,scale,game.facing);
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(pose.x,pose.y);ctx.scale(pose.scaleX,pose.scaleY);
   ctx.drawImage(sheet,...pose.source,...pose.target);ctx.restore();
   canvas.dataset.character=characterId;
   canvas.dataset.heroRig='sprite-16-v1';canvas.dataset.spriteFrame=String(frame);
   canvas.dataset.groundY=String(floor);
   const bottoms=enemies.slice(0,game.enemies.length).map(e=>attachmentBottom(e.skeleton,e.groundSlots));
   canvas.dataset.groundError=String(Math.max(0,...bottoms.filter((b):b is number=>b!==null).map(b=>Math.abs(b-floor))));
   canvas.dataset.slimeScale=String(HUNT_VISUALS.slimeScale);
   // UI overlays are painted after the WebGL layer so health and damage remain visible.
   for(const mob of game.enemies){
    const x=screenX(mob.x),bar=Math.max(20,36*zoom),y=floor-30*zoom;
    if(mob.hp>0){ctx.fillStyle='#111c';ctx.fillRect(x-bar/2,y,bar,3);ctx.fillStyle='#e07b67';ctx.fillRect(x-bar/2,y,bar*mob.hp/100,3);}
    if(mob.hitUntil>game.elapsed){ctx.fillStyle='#ffdb8b';ctx.font=`bold ${Math.max(12,20*zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(mob.lastDamage),x,y-8-(.75-(mob.hitUntil-game.elapsed))*25);}
   }
   // Foreground decoration follows the world more quickly than the distant forest.
   ctx.globalAlpha=.7;ctx.drawImage(trees, -170-camera*.4%700, floor-165,145,190);ctx.globalAlpha=1;
  },
  dispose() { enemy.atlas.dispose(); renderer?.dispose(); },
  animations: {hero: ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','damage1'], enemy: enemy.available},
 };
}
