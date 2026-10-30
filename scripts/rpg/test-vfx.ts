import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {SKILL_VFX,vfxFrame,vfxPlacement,type HuntVfxEvent} from '../../src/components/rpg/hunt-vfx';
const advance=(g:HuntEngine,s:number)=>{for(let t=0;t<s;t+=.01)g.step(.01,0);};
test('each skill emits exactly one effect at contact; drawing cannot add damage',()=>{
 for(let skill=0;skill<6;skill++){
  const g=new HuntEngine(undefined,1);g.enemyX=g.x+70;g.enemyHP=g.enemies[0].maxHP=10000;
  assert.equal(g.attack(skill),true);assert.equal(g.vfx.length,0);const {hitAt}=g.visualTiming;
  advance(g,Math.max(0,hitAt-.025));assert.equal(g.vfx.length,0);advance(g,.04);assert.equal(g.vfx.length,1);assert.equal(g.vfx[0].skill,skill);
  const hp=g.enemyHP;for(let i=0;i<100;i++)vfxFrame(g.vfx[0],g.elapsed);assert.equal(g.enemyHP,hp);
  advance(g,.1);assert.equal(g.vfx.length,1);advance(g,2.1);assert.equal(g.vfx.length,0);
 }
});
test('frame boundaries never loop expired effects, and camera transforms preserve world position',()=>{
 const e:HuntVfxEvent={id:1,skill:0,x:800,facing:-1,born:10,expires:12};
 assert.equal(vfxFrame(e,9),null);assert.equal(vfxFrame(e,10),0);assert.equal(vfxFrame(e,11.999),31);assert.equal(vfxFrame(e,12),null);assert.equal(vfxFrame(e,NaN),null);
 const a=vfxPlacement(e,200,1,x=>x-500),b=vfxPlacement(e,200,1,x=>x-550);assert.equal(a.x-b.x,50);assert.equal(a.y,b.y);
 assert.equal(vfxFrame({...e,skill:99},10),null);
});
test('six runtime sheets and every catalog GIF resolve to extracted assets',()=>{
 const manifest=JSON.parse(readFileSync('public/rpg/vfx/runtime/manifest.json','utf8'));
 assert.equal(manifest.effects.length,6);assert.deepEqual(manifest.effects.map((e:any)=>e.id).sort(),[...SKILL_VFX].sort());
 for(const e of manifest.effects){assert.ok(existsSync('public'+e.sheet));assert.ok(e.visibleFrames>0);assert.equal(e.frames,32);assert.equal(e.cell,256);}
 const catalog=JSON.parse(readFileSync('public/rpg/vfx/catalog.json','utf8'));
 assert.ok(catalog.prefabs.filter((e:any)=>e.category==='Skill').length>=300);
 for(const e of catalog.prefabs)if(e.preview)assert.ok(existsSync('public'+e.preview));
});
