import {hongNativeName,hongNativeContact,HONG_NATIVE_BODY_SLOTS,HONG_NATIVE_FOOT_SLOTS} from './hong-native-motion';
import {hongMotionName,hongMotionTime,hongVisualContact,HONG_BODY_SLOTS,HONG_FOOT_SLOTS} from './hong-combat-motion';
import type {LabyrinthView} from './hunt-labyrinth';
import {LABYRINTH} from './hunt-labyrinth';
import {ATTACK_CELL,attackSpriteFrame,attackSpritePlacement} from './combat-attack-sprite';
import {WEAPON_TYPES} from './hunt-weapons';
import {HUNT_MONSTER_ASSET,HUNT_STAGE} from './hunt-tables';
import {drawHeldWeapon} from './hunt-weapon-renderer';
import type {WeaponType} from './hunt-weapons';
import {CanvasTexture, SkeletonRenderer as CanvasRenderer} from '@esotericsoftware/spine-canvas';
import {AnimationState, AnimationStateData, AtlasAttachmentLoader, GLTexture, Physics, SceneRenderer, Skeleton, SkeletonJson, TextureAtlas} from '@esotericsoftware/spine-webgl';
import {HuntEngine,WORLD_WIDTH} from './hunt-engine';
import {combatCharacter} from './combat-characters';
import {CombatSpriteClock,COMBAT_SPRITE_SCALE,spritePlacement} from './combat-sprite';
import {huntViewport,HUNT_PORTRAIT_ZOOM,HUNT_MONSTER_RENDER_SCALE,HUNT_ACTOR_RENDER_GAIN,HUNT_BACKGROUND_GAIN,HUNT_GROUND_RATIO} from './hunt-layout';
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
async function actor(name: string, signal: AbortSignal, gl: WebGLRenderingContext | null, groundSlots:string[]=HUNT_MONSTER_ASSET.groundSlots) {
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
 return {skeleton, state, atlas,groundSlots,setupHeight:Math.max(1,skeleton.getBoundsRect().height), animation: '', serial:-1, available: data.animations.map(a => a.name)};
}
export async function createHuntRenderer(canvas: HTMLCanvasElement, signal: AbortSignal, characterId='hong') {
 Skeleton.yDown = true;
 const layer = document.createElement('canvas');
 const gl = layer.getContext('webgl', {alpha:true, premultipliedAlpha:true, antialias:true});
 if(!combatCharacter(characterId))throw Error('알 수 없는 캐릭터입니다.');
 const [sheet, enemy, forest, trees] = await Promise.all([image(base+`characters/${characterId}/sheet.png`,signal), actor(HUNT_MONSTER_ASSET.skeleton, signal, gl), image(base + 'BG_Forest01.png', signal), image(base + 'BG_Tree01.png', signal)]);
 if(sheet.naturalWidth!==1024||sheet.naturalHeight!==1024)throw Error('잘못된 캐릭터 스프라이트 크기');
 const attackMeta=await fetch(base+`characters/${characterId}/attacks/manifest.json`,{signal}).then(r=>{if(!r.ok)throw Error('Missing attack manifest');return r.json();});
 const attackSheets=Object.fromEntries(await Promise.all(WEAPON_TYPES.map(async type=>[type,await image(base+`characters/${characterId}/attacks/${type}.png`,signal)]))) as Record<WeaponType,HTMLImageElement>;
 for(const sheet of Object.values(attackSheets))if(sheet.naturalWidth!==ATTACK_CELL.width*ATTACK_CELL.frames||sheet.naturalHeight!==ATTACK_CELL.height)throw Error('Invalid attack sheet');
 // Hong alone uses the new articulated rig. Keep the existing sheets as a recoverable load fallback.
 const jointHero=characterId==='hong'?await actor('characters/hong/spine/hong',signal,null,[...HONG_FOOT_SLOTS]).catch(error=>{
  if(signal.aborted)throw error;canvas.dataset.heroAssetError='hong-spine-load-failed';return null;
 }):null;
 const nativeHeroes:Partial<Record<WeaponType,Awaited<ReturnType<typeof actor>>>>={};
 if(characterId==='hong')await Promise.all((['axe','sword','dual','spear'] as const).map(async weapon=>{
  try{nativeHeroes[weapon]=await actor(`characters/hong/native-${weapon}/hong`,signal,null,[...HONG_NATIVE_FOOT_SLOTS]);}
  catch(error){if(signal.aborted)throw error;canvas.dataset.nativeHeroAssetError='load-failed:'+weapon;}
 }));
 let heroWeapon:WeaponType|undefined,heroKey='',heroTime=0;
 const spriteClock=new CombatSpriteClock();
 // Each slime owns its pose/animation state, while sharing immutable skeleton data and atlas textures.
 const enemies=Array.from({length:HUNT_STAGE.maxAlive},()=>{
  const skeleton=new Skeleton(enemy.skeleton.data);
  if(enemy.skeleton.skin)skeleton.setSkin(enemy.skeleton.skin);
  skeleton.setSlotsToSetupPose();
  return {...enemy,skeleton,state:new AnimationState(enemy.state.data),animation:'',serial:0};
 });
 const assetCache=new Map<string,typeof enemy>();const pending=new Set<string>();const failed=new Set<string>();
 const stageVisuals=new Map<number,typeof enemy & {keySerial:number}>();let disposed=false;
 const fallbackFor=(slot:number)=>{while(enemies.length<=slot){const skeleton=new Skeleton(enemy.skeleton.data);if(enemy.skeleton.skin)skeleton.setSkin(enemy.skeleton.skin);skeleton.setSlotsToSetupPose();enemies.push({...enemy,skeleton,state:new AnimationState(enemy.state.data),animation:'',serial:0});}return enemies[slot];};
 const visualFor=(mob:HuntEngine['enemies'][number])=>{
  if(!mob.asset)return fallbackFor(mob.slot);
  const meta=LABYRINTH.assets[mob.asset];if(!meta)return fallbackFor(mob.slot);
  const old=stageVisuals.get(mob.slot);if(old?.keySerial===mob.serial)return old;
  const template=assetCache.get(mob.asset);
  if(template){const skeleton=new Skeleton(template.skeleton.data);if(template.skeleton.skin)skeleton.setSkin(template.skeleton.skin);skeleton.setSlotsToSetupPose();
   const value={...template,skeleton,state:new AnimationState(template.state.data),animation:'',serial:mob.serial,keySerial:mob.serial};stageVisuals.set(mob.slot,value);return value;}
  if(!pending.has(mob.asset)&&!failed.has(mob.asset)){pending.add(mob.asset);void actor(meta.skeleton,signal,gl,meta.groundSlots).then(value=>{if(disposed)value.atlas.dispose();else assetCache.set(mob.asset!,value);}).catch(()=>{failed.add(mob.asset!);canvas.dataset.assetError=mob.asset;}).finally(()=>pending.delete(mob.asset!));}
  return fallbackFor(mob.slot);
 };
 const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas를 사용할 수 없습니다.');
 const heroRenderer=jointHero||Object.keys(nativeHeroes).length?new CanvasRenderer(ctx):null;if(heroRenderer)heroRenderer.triangleRendering=true;
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
  draw(game: HuntEngine, dt: number, view?:{weapon:WeaponType;motion:{startedAt:number;duration:number;hitAt:number};stage?:LabyrinthView;elapsed?:number;impactors?:{id:number;x:number;width:number;speed:number;targetX:number;expires:number}[]}) {
   const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(Math.max(devicePixelRatio || 1, renderer ? 1 : 2), 2);
   if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
   if(layer.width!==canvas.width||layer.height!==canvas.height){layer.width=canvas.width;layer.height=canvas.height;}
   if(gl&&renderer){
    gl.viewport(0,0,layer.width,layer.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.camera.position.set(w/2,h/2,0);renderer.camera.setViewport(w,-h);renderer.begin();
   }
   const floor=h*HUNT_GROUND_RATIO,{zoom,camera,screenX}=huntViewport(w,game.x);
   canvas.dataset.enemyCount=String(game.enemies.filter(e=>e.hp>0).length);
   canvas.dataset.visibleEnemies=String(game.enemies.filter(e=>e.hp>0&&screenX(e.x)>=0&&screenX(e.x)<=w).length);
   canvas.dataset.cameraX=String(camera);canvas.dataset.heroScreenX=String(screenX(game.x));
   canvas.dataset.worldWidth=String(WORLD_WIDTH);canvas.dataset.cameraSpan=String(w/zoom);canvas.dataset.sceneZoom=String(HUNT_PORTRAIT_ZOOM);
   const sceneScale=HUNT_BACKGROUND_GAIN,backgroundHeight=(floor+45)*sceneScale;
   const tile = Math.max(h*.8,230)*sceneScale, offset = ((camera*zoom*.22 % tile)+tile)%tile;
   for(let x=-tile-offset; x<w; x+=tile) ctx.drawImage(forest, x, floor+45-backgroundHeight, tile, backgroundHeight);
   const shade = ctx.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, '#04191755'); shade.addColorStop(.55, '#091e1600'); shade.addColorStop(1, '#071b13'); ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#26372a';ctx.fillRect(0,floor+5,w,h-floor);
   ctx.fillStyle='#658150';ctx.fillRect(0,floor+5,w,4);
   const groundStep=90*sceneScale;
   ctx.fillStyle='#192a20'; for(let i=-1;i<w/groundStep+1;i++) ctx.fillRect(i*groundStep-((camera*zoom%groundStep)+groundStep)%groundStep,floor+(28+(i%3)*12)*sceneScale,46*sceneScale,3*sceneScale);
   for(const edge of [65,WORLD_WIDTH-65]){const x=screenX(edge);if(x>=0&&x<w){ctx.fillStyle='#b4ba8777';ctx.fillRect(x,floor-18,3,25);}}
   const scale=COMBAT_SPRITE_SCALE*zoom*HUNT_ACTOR_RENDER_GAIN;
   ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(screenX(game.x),floor+4,25*zoom,5*zoom,0,0,Math.PI*2);ctx.fill();
   for(const [slot,visual] of stageVisuals)if(!game.enemies.some(e=>e.slot===slot&&e.serial===visual.keySerial))stageVisuals.delete(slot);
   for(const mob of game.enemies){
    if(mob.hp<=0&&game.elapsed>=mob.respawnAt)continue;
    if(screenX(mob.x)<-150||screenX(mob.x)>w+150)continue;
    const visual=visualFor(mob),hurt=mob.hp>0&&mob.hitUntil>game.elapsed;
    const clips=(mob.asset?LABYRINTH.assets[mob.asset]:undefined)?.clips??HUNT_MONSTER_ASSET.clips;
    const anim=mob.hp<=0?clips.death:hurt?clips.hurt:mob.state==='windup'?(mob.clip??clips.attack):mob.state==='walk'?clips.move:clips.idle;
    const shake=hurt?Math.sin(game.elapsed*90)*2*zoom:0,x=screenX(mob.x),y=floor;
    animate(visual,anim,x+shake,y,(mob.asset?(mob.boss?100:38)/visual.setupHeight:HUNT_VISUALS.slimeScale)*zoom*HUNT_ACTOR_RENDER_GAIN*HUNT_MONSTER_RENDER_SCALE,mob.x>game.x?-1:1,dt,mob.serial*10000+(mob.castSerial??0));
   }
   if(renderer){renderer.end();ctx.drawImage(layer,0,0,w,h);}
   const stage=game.combo.find(s=>s.animation===game.action);
   const frame=spriteClock.frame(game.action,game.actionSerial,dt,game.animationSpeed,stage?.hitAt??.2);
   const attack=!!view&&/^attack/.test(game.action),age=view?Math.max(0,game.elapsed-view.motion.startedAt):0;
   const attackFrame=attack?attackSpriteFrame(age,view!.motion.duration,view!.motion.hitAt,attackMeta.animations[view!.weapon].impactFrame):0;
   const weapon=view?.weapon??'unarmed',native=!!nativeHeroes[weapon],hero=native?nativeHeroes[weapon]:jointHero;
   if(hero&&heroRenderer){
    const key=`${game.action}:${game.actionSerial}:${weapon}`;
    const requested=native?hongNativeName(game.action):hongMotionName(game.action,weapon),next=hero.available.includes(requested)?requested:native?'stay1':hongMotionName('stay1',weapon);
    if(heroWeapon!==weapon&&!native){
     hero.skeleton.setSkinByName(weapon);hero.skeleton.setSlotsToSetupPose();
     hero.skeleton.findSlot('weapon-front')!.setAttachment(weapon==='unarmed'?null:hero.skeleton.getAttachmentByName('weapon-front',`held-${weapon}`));
     hero.skeleton.findSlot('weapon-back')!.setAttachment(weapon==='dual'?hero.skeleton.getAttachmentByName('weapon-back','held-dual'):null);heroWeapon=weapon;
    }
    if(native)heroWeapon=weapon;
    if(key!==heroKey){hero.state.setAnimation(0,next,/stay|run/.test(next));heroKey=key;heroTime=0;}
    heroTime+=Math.max(0,dt)*Math.max(0,game.animationSpeed);
    hero.state.update(Math.max(0,dt)*Math.max(0,game.animationSpeed));
    const entry=hero.state.getCurrent(0)!;
    if(view&&(attack||game.action.startsWith('skill'))&&view.motion.duration>0){
     const contact=native?hongNativeContact(next,entry.animation!.duration):hongVisualContact(next);
     entry.trackTime=hongMotionTime(age,view.motion.duration,view.motion.hitAt,entry.animation!.duration,contact,attack&&!native);
    }else entry.trackTime=heroTime;
    hero.state.apply(hero.skeleton);
    hero.skeleton.x=screenX(game.x);hero.skeleton.y=floor;hero.skeleton.scaleX=scale*(native?1.75:1.25)*game.facing;hero.skeleton.scaleY=scale*(native?1.75:1.25);
    hero.skeleton.updateWorldTransform(Physics.update);
    groundSkeleton(hero.skeleton,floor,/avoid|die|defeat|damage/.test(game.action)?native?HONG_NATIVE_BODY_SLOTS:HONG_BODY_SLOTS:native?HONG_NATIVE_FOOT_SLOTS:HONG_FOOT_SLOTS);
    canvas.dataset.heroGroundError=String(Math.abs((attachmentBottom(hero.skeleton,native?HONG_NATIVE_FOOT_SLOTS:HONG_FOOT_SLOTS)??floor)-floor));
    ctx.save();ctx.imageSmoothingEnabled=native;ctx.imageSmoothingQuality='high';
    canvas.dataset.heroTexture=native?'2048x1024-linear':'original';
    hero.skeleton.color.a=game.heroHitUntil>game.elapsed&&game.hp>0?.55+Math.sin(game.elapsed*60)*.2:1;
    heroRenderer.draw(hero.skeleton);ctx.restore();
    canvas.dataset.heroRig=native?`hong-native-${weapon}-${weapon==='axe'?'v2':'v1'}`:'hong-eirika-weapons-v12';canvas.dataset.heroMotion=next;canvas.dataset.weaponMount=native?'native-hand':weapon==='dual'||weapon==='spear'?'both-hands':weapon==='unarmed'?'none':'front-hand';
   }else{
    const pose=attack?attackSpritePlacement(attackFrame,screenX(game.x),floor,scale,game.facing):spritePlacement(frame,screenX(game.x),floor,scale,game.facing);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(pose.x,pose.y);ctx.scale(pose.scaleX,pose.scaleY);
    if(game.heroHitUntil>game.elapsed&&game.hp>0)ctx.globalAlpha=.55+Math.sin(game.elapsed*60)*.2;
    ctx.drawImage(attack?attackSheets[view!.weapon]:sheet,pose.source[0],pose.source[1],pose.source[2],pose.source[3],pose.target[0],pose.target[1],pose.target[2],pose.target[3]);ctx.restore();
    if(view&&!attack&&game.hp>0&&!/avoid|die/.test(game.action))drawHeldWeapon(ctx,view.weapon,frame,screenX(game.x),floor,scale,game.facing,age,view.motion.duration,view.motion.hitAt,attack);
    canvas.dataset.heroRig=attack?'weapon-attack-v1':'sprite-16-v1';
   }
   canvas.dataset.weapon=view?.weapon??'none';canvas.dataset.character=characterId;canvas.dataset.spriteFrame=String(attack?attackFrame:frame);
   canvas.dataset.groundY=String(floor);
   const bottoms=enemies.slice(0,game.enemies.length).map(e=>attachmentBottom(e.skeleton,e.groundSlots));
   canvas.dataset.groundError=String(Math.max(0,...bottoms.filter((b):b is number=>b!==null).map(b=>Math.abs(b-floor))));
   canvas.dataset.slimeScale=String(HUNT_VISUALS.slimeScale);
   // UI overlays are painted after the WebGL layer so health and damage remain visible.
   for(const mob of game.enemies){
    const x=screenX(mob.x),bar=Math.max(20,36*zoom),y=floor-30*zoom;
    if(mob.hp>0){ctx.fillStyle='#111c';ctx.fillRect(x-bar/2,y,bar,3);ctx.fillStyle='#e07b67';ctx.fillRect(x-bar/2,y,bar*mob.hp/mob.maxHP,3);}
    if(mob.state==='windup'&&mob.hp>0){ctx.fillStyle='#ff9c72';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('!',x,y-10);
     ctx.strokeStyle='#ff644c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,floor+3,24*zoom,6*zoom,0,0,Math.PI*2);ctx.stroke();}
    if(mob.hitUntil>game.elapsed){ctx.fillStyle='#ffdb8b';ctx.font=`bold ${Math.max(12,20*zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(mob.lastDamage),x,y-8-(.75-(mob.hitUntil-game.elapsed))*25);}
   }

   for(const p of view?.impactors??[]){if(game.elapsed>p.expires)continue;const delta=p.targetX-p.x,lag=Math.min(.15,Math.max(0,game.elapsed-(view?.elapsed??game.elapsed))),px=p.x+Math.sign(delta)*Math.min(Math.abs(delta),p.speed*lag);ctx.fillStyle='#ffbb66';ctx.beginPath();ctx.ellipse(screenX(px),floor-20*zoom,Math.min(25,Math.max(5,p.width/4))*zoom,7*zoom,0,0,Math.PI*2);ctx.fill();}
   const objective=view?.stage;
   if(objective?.exitX){const x=screenX(objective.exitX);ctx.strokeStyle='#82ffe0';ctx.lineWidth=4;ctx.strokeRect(x-22*zoom,floor-70*zoom,44*zoom,70*zoom);ctx.fillStyle='#cefff1';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('출구',x,floor-80*zoom);}
   for(const o of objective?.objects??[]){const x=screenX(o.x);ctx.fillStyle=o.done?'#80c7ad':'#e7bc62';ctx.fillRect(x-14*zoom,floor-35*zoom,28*zoom,35*zoom);ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(o.done?'완료':'장치',x,floor-43*zoom);}
   if(objective?.escort){const a=objective.escort,x=screenX(a.x);ctx.fillStyle='#80d6ed';ctx.fillRect(x-10*zoom,floor-38*zoom,20*zoom,38*zoom);ctx.fillRect(x-20*zoom,floor-48*zoom,40*zoom*a.hp/a.maxHP,4);ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('동료',x,floor-55*zoom);}
   // Foreground decoration follows the world more quickly than the distant forest.
   const foregroundStep=700*sceneScale;
   ctx.globalAlpha=.7;for(let x=-170*sceneScale-((camera*zoom*.65%foregroundStep)+foregroundStep)%foregroundStep;x<w;x+=foregroundStep)ctx.drawImage(trees,x,floor-165*sceneScale,145*sceneScale,190*sceneScale);ctx.globalAlpha=1;
  },
  dispose() { disposed=true;assetCache.forEach(a=>a.atlas.dispose());enemy.atlas.dispose();jointHero?.atlas.dispose();Object.values(nativeHeroes).forEach(a=>a.atlas.dispose()); renderer?.dispose(); },
  animations: {hero: ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','damage1'], enemy: enemy.available},
 };
}
