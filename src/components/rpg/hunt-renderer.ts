import {AnimationState, AnimationStateData, AtlasAttachmentLoader, CanvasTexture, Physics, Skeleton, SkeletonJson, SkeletonRenderer, Skin, TextureAtlas} from '@esotericsoftware/spine-canvas';
import {HuntEngine, WORLD_WIDTH} from './hunt-engine';
const base = '/rpg/';
const image = (url: string, signal: AbortSignal) => new Promise<HTMLImageElement>((resolve, reject) => {
 const img = new Image();
 const abort = () => { img.src = ''; reject(new DOMException('Aborted', 'AbortError')); };
 signal.addEventListener('abort', abort, {once: true});
 img.onload = () => { signal.removeEventListener('abort', abort); resolve(img); };
 img.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error(`이미지 로드 실패: ${url}`)); };
 if (signal.aborted) abort(); else img.src = url;
});
async function actor(name: string, signal: AbortSignal) {
 const [json, atlasText] = await Promise.all([fetch(base + name + '.json', {signal}).then(r => {if (!r.ok) throw Error(name); return r.json();}), fetch(base + name + '.atlas', {signal}).then(r => {if (!r.ok) throw Error(name); return r.text();})]);
 const atlas = new TextureAtlas(atlasText);
 for (const page of atlas.pages) page.setTexture(new CanvasTexture(await image(base + page.name, signal)));
 const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);
 const skeleton = new Skeleton(data);
 if (name === 'Hero_Axe01') {
  const skin = new Skin('prototype');
  for (const key of ['cos/cos0', 'weapon/grade1']) { const part = data.findSkin(key); if (part) skin.addSkin(part); }
  skeleton.setSkin(skin);
 } else if (data.skins.length) skeleton.setSkin(data.skins[0]);
 skeleton.setSlotsToSetupPose();
 const stateData = new AnimationStateData(data); stateData.defaultMix = .1;
 const state = new AnimationState(stateData);
 const idle = data.animations.find(a=>/stay1|idle/i.test(a.name));
 if(idle){state.setAnimation(0,idle.name,true);state.apply(skeleton);}
 skeleton.updateWorldTransform(Physics.update);
 const bounds=skeleton.getBoundsRect();const baseline=bounds.y+bounds.height;
 return {skeleton, state, atlas, animation: '', baseline, available: data.animations.map(a => a.name)};
}
export async function createHuntRenderer(canvas: HTMLCanvasElement, signal: AbortSignal) {
 Skeleton.yDown = true;
 const [hero, enemy, forest, trees] = await Promise.all([actor('Hero_Axe01', signal), actor('Enemy_Slime_01_R', signal), image(base + 'BG_Forest01.png', signal), image(base + 'BG_Tree01.png', signal)]);
 const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas를 사용할 수 없습니다.');
 const renderer = new SkeletonRenderer(ctx); renderer.triangleRendering = true;
 const animate = (a: typeof hero, anim: string, x: number, y: number, scale: number, direction: number, dt: number) => {
  const next = a.available.includes(anim) ? anim : a.available.find(n => /stay|idle/i.test(n)) || a.available[0];
  if (a.animation !== next && next) { a.state.setAnimation(0, next, /stay|idle|run/i.test(next)); a.animation = next; }
  a.skeleton.x = x; a.skeleton.y = y - a.baseline * scale; a.skeleton.scaleX = scale * direction; a.skeleton.scaleY = scale;
  a.state.update(dt); a.state.apply(a.skeleton); a.skeleton.update(dt); a.skeleton.updateWorldTransform(Physics.update); renderer.draw(a.skeleton);
 };
 return {
  draw(game: HuntEngine, dt: number) {
   const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
   if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
   const floor = h * .79, camera = Math.max(0, Math.min(WORLD_WIDTH - w, game.x - w*.4));
   const tile = Math.max(h*1.15, 380), offset = camera*.22 % tile;
   for(let x=-tile-offset; x<w; x+=tile) ctx.drawImage(forest, x, 0, tile, floor+45);
   const shade = ctx.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, '#04191755'); shade.addColorStop(.55, '#091e1600'); shade.addColorStop(1, '#071b13'); ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#26372a';ctx.fillRect(0,floor+5,w,h-floor);
   ctx.fillStyle='#658150';ctx.fillRect(0,floor+5,w,4);
   ctx.fillStyle='#192a20'; for(let i=0;i<20;i++) ctx.fillRect(i*90-camera%90,floor+28+(i%3)*12,46,3);
   const scale = w < 600 ? .78 : 1.05;
   ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(game.x-camera,floor+4,35,8,0,0,Math.PI*2);ctx.fill();
   if(game.enemyHP>0) {
    animate(enemy, game.hitUntil>game.elapsed ? 'damage1' : 'stay1',game.enemyX-camera,floor,scale*2.5,-1,dt);
    ctx.fillStyle='#111c';ctx.fillRect(game.enemyX-camera-26,floor-68,52,5);ctx.fillStyle='#e07b67';ctx.fillRect(game.enemyX-camera-26,floor-68,52*game.enemyHP/100,5);
   }
   animate(hero,game.action,game.x-camera,floor,scale,game.facing,dt);
   if(game.hitUntil>game.elapsed) {ctx.fillStyle='#ffdb8b';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(String(game.lastDamage),game.enemyX-camera,floor-85-(.75-(game.hitUntil-game.elapsed))*35);}
   // Foreground decoration follows the world more quickly than the distant forest.
   ctx.globalAlpha=.7;ctx.drawImage(trees, -170-camera*.4%700, floor-250,220,280);ctx.globalAlpha=1;
  },
  dispose() { hero.atlas.dispose(); enemy.atlas.dispose(); },
  animations: {hero: hero.available, enemy: enemy.available},
 };
}
