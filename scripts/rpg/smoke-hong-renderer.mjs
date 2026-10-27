/** Exercise the actual browser renderer against a native Canvas2D DOM shim. QA only. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createCanvas,Image as NativeImage} from '@napi-rs/canvas';
import rendererModule from '../../src/components/rpg/hunt-renderer.ts';import engineModule from '../../src/components/rpg/hunt-engine.ts';
const {createHuntRenderer}=rendererModule,{HuntEngine}=engineModule;
const root=path.resolve('public');
class LocalImage extends NativeImage {set src(url){if(url)super.src=fs.readFileSync(path.join(root,url));}get src(){return super.src}}
function canvas(w=640,h=440){const c=createCanvas(w,h);c.clientWidth=w;c.clientHeight=h;c.dataset={};const get=c.getContext.bind(c);c.getContext=(type,...args)=>type==='webgl'?null:get(type,...args);return c;}
globalThis.Image=LocalImage;globalThis.document={createElement:()=>canvas()};globalThis.devicePixelRatio=1;
globalThis.fetch=async(url)=>{const p=path.join(root,url);try{return new Response(fs.readFileSync(p),{status:200});}catch{return new Response('not found',{status:404});}};
const c=canvas(),ac=new AbortController(),r=await createHuntRenderer(c,ac.signal,'hong');const g=new HuntEngine();let serial=0;
for(const weapon of ['unarmed','sword','axe','dual','spear'])for(const action of ['stay1','run1','dash','avoid1','attack1','attack2','attack3','damage1','die1']){
 g.action=action;g.actionSerial=++serial;g.elapsed=1;g.hp=action==='die1'?0:10000;g.facing=serial%2?-1:1;
 const view={weapon,motion:{startedAt:1,duration:.5,hitAt:.2}};
 for(let i=0;i<12;i++){g.elapsed=1+i/60;r.draw(g,1/60,view);}
 assert.equal(c.dataset.heroRig,'hong-spine-weapons-v1');assert.equal(c.dataset.weapon,weapon);assert.ok(!c.dataset.heroAssetError);
}
r.dispose();
// Verify a non-Hong appearance still goes through the existing sprite renderer.
const other=canvas(),old=await createHuntRenderer(other,ac.signal,'boy-hoodie');
g.action='stay1';g.hp=10000;old.draw(g,1/60,{weapon:'sword',motion:{startedAt:1,duration:0,hitAt:.2}});assert.equal(other.dataset.heroRig,'sprite-16-v1');old.dispose();
console.log('ACTUAL_RENDERER_PASSED: 45 Hong weapon/action combinations, both facing directions, 540 rendered frames + non-Hong fallback.');
