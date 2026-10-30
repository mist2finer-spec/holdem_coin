import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {dungeonPlacement,type DungeonLayout} from '../../src/components/rpg/hunt-map';
const root='public/rpg/maps/candle-dungeon/';
test('dungeon ground uses real mesh floor, not the elevated actor origin',()=>{
 const layout=JSON.parse(fs.readFileSync(root+'layout.json','utf8'));
 assert.equal(layout.groundWorldY,10);assert.equal(layout.actorOriginY,11);
 for(const zoom of [.4,.624,1.2]){
  const screenX=(x:number)=>(x-500)*zoom,p=dungeonPlacement(layout,320,zoom,5200,screenX);
  assert.ok(Math.abs(p.y+layout.groundY*p.scale-320)<1e-8);
  assert.ok(Math.abs(p.x+layout.startPixel*p.scale-screenX(0))<1e-8);
  assert.ok(Math.abs(p.x+layout.endPixel*p.scale-screenX(5200))<1e-8);
 }
 assert.throws(()=>dungeonPlacement({...layout,endPixel:layout.startPixel},0,1,5200,x=>x));
});
test('all recovered renderer submeshes, UVs and textures resolve with finite transforms',()=>{
 const scene=JSON.parse(fs.readFileSync(root+'scene.json','utf8')),evidence=JSON.parse(fs.readFileSync(root+'evidence.json','utf8'));
 assert.equal(scene.renderers.length,108);assert.equal(Object.keys(scene.geometry).length,33);
 assert.deepEqual(evidence.unresolved.map((e:any)=>e.name).sort(),['DitheredLightOverlay','Vignette']);
 for(const r of scene.renderers){const g=scene.geometry[r.geometry];assert.ok(g);assert.equal(g.uv.length,g.positions.length);assert.equal(g.uv2.length,g.positions.length);assert.ok(r.world.flat().every(Number.isFinite));
  for(const sub of r.submeshes)for(const t of g.submeshes[sub])for(const i of t)assert.ok(i>=0&&i<g.positions.length);
  for(const mat of r.materials){const m=scene.materials[mat];assert.ok(m);if(m.texture)assert.ok(fs.existsSync(root+scene.textures[m.texture].file));}
 }
 const layout=JSON.parse(fs.readFileSync(root+'layout.json','utf8'));assert.equal(layout.flames.length,6);assert.equal(layout.parts.length,108);
 for(const f of layout.flames){assert.ok(fs.existsSync(root+f.texture));assert.equal(f.tilesX*f.tilesY,16);assert.ok(f.pixel.every(Number.isFinite));}
});
