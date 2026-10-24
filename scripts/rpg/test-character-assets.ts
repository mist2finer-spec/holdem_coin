import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMBAT_CHARACTERS,combatCharacter,combatSpriteFrame} from '../../src/components/rpg/combat-characters';
import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
test('nine appearances have complete RGBA sprite packs',()=>{
 assert.equal(new Set(COMBAT_CHARACTERS.map(c=>c.id)).size,9);
 for(const c of COMBAT_CHARACTERS){
  const root=`public/rpg/characters/${c.id}`,meta=JSON.parse(fs.readFileSync(`${root}/manifest.json`,'utf8'));
  assert.equal(meta.portraitId,c.portrait);assert.equal(meta.frames.length,16);
  const png=fs.readFileSync(`${root}/sheet.png`);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);
  for(const frame of meta.frames){assert.ok(frame.rect[0]>=0&&frame.rect[1]>=0&&frame.rect[0]+256<=1024&&frame.rect[1]+256<=1024);assert.deepEqual(frame.anchor,[128,224]);}
 }
 assert.equal(combatCharacter('../unknown'),undefined);
});
test('contact poses match actual engine impact clock without changing damage timing',()=>{
 for(const stage of HUNT_RULES.combo){assert.equal(combatSpriteFrame(stage.animation,stage.hitAt-1e-5,stage.hitAt),8);assert.ok(combatSpriteFrame(stage.animation,stage.hitAt,stage.hitAt)>=9);}
 for(const action of ['stay1','run1','dash','avoid1','attack1','attack2','attack3','attack4','attack5','skill5','damage1'])for(const time of [0,.1,.3,1,100])assert.ok(combatSpriteFrame(action,time)>=0&&combatSpriteFrame(action,time)<16);
});
test('sprite cells keep one floor anchor and scale across all frames and facing directions',async()=>{
 const {spritePlacement}=await import('../../src/components/rpg/combat-sprite');
 for(let frame=0;frame<16;frame++)for(const direction of [-1,1])for(const scale of [.2,.62,1]){
  const p=spritePlacement(frame,100,240,scale,direction);
  assert.ok(p.source[0]+p.source[2]<=1024&&p.source[1]+p.source[3]<=1024);
  assert.equal(p.x+(p.target[0]+128)*p.scaleX,100);
  assert.equal(p.y+(p.target[1]+224)*p.scaleY,240);
 }
 assert.throws(()=>spritePlacement(16,0,0,1,1));
});
test('each repeated strike restarts its sprite windup while pause freezes the pose',async()=>{
 const {CombatSpriteClock}=await import('../../src/components/rpg/combat-sprite');
 const clock=new CombatSpriteClock();
 assert.equal(clock.frame('attack1',1,.1),8);
 assert.equal(clock.frame('attack1',1,.1),9);
 assert.equal(clock.frame('attack1',1,0),9);
 assert.equal(clock.frame('attack1',2,0),8);
 assert.equal(clock.frame('attack1',2,.1,2),9);
 assert.equal(clock.frame('run1',3,0),4);
 assert.equal(clock.frame('run1',3,.1),5);
 assert.equal(clock.frame('run1',3,0),5);
});
test('active character sheets stay unchanged and archived Spine skeletons retain their hashes',async()=>{
 const {createHash}=await import('node:crypto');
 const archive=JSON.parse(fs.readFileSync('archive/rpg/spine-characters/index.json','utf8'));
 for(const c of COMBAT_CHARACTERS){
  const root=`public/rpg/characters/${c.id}`,meta=JSON.parse(fs.readFileSync(`${root}/manifest.json`,'utf8'));
  assert.equal(meta.renderMode,'sprite-16-v1');assert.equal(meta.rig,undefined);
  assert.equal(createHash('sha256').update(fs.readFileSync(`${root}/sheet.png`)).digest('hex'),meta.sheetSha256);
  assert.ok(fs.statSync(`${root}/illustration.jpg`).size>1000);
  assert.equal(fs.existsSync(`${root}/rig`),false);
  const archived=archive.characters.find((a:{id:string})=>a.id===c.id);
  assert.equal(createHash('sha256').update(fs.readFileSync(`${archived.path}/character.json`)).digest('hex'),archived.skeletonSha256);
 }
});

test('all nine characters have five independent four-frame attack sheets with unchanged base sprites',async()=>{
 const {WEAPON_TYPES}=await import('../../src/components/rpg/hunt-weapons');
 const {ATTACK_CELL}=await import('../../src/components/rpg/combat-attack-sprite');
 const {createHash}=await import('node:crypto');
 assert.equal(WEAPON_TYPES.length,5);
 for(const c of COMBAT_CHARACTERS){const root=`public/rpg/characters/${c.id}/attacks`,m=JSON.parse(fs.readFileSync(`${root}/manifest.json`,'utf8')),hashes=[];
  assert.equal(m.character,c.id);assert.deepEqual(m.cell,[ATTACK_CELL.width,ATTACK_CELL.height]);assert.deepEqual(m.footAnchor,[ATTACK_CELL.footX,ATTACK_CELL.footY]);
  for(const type of WEAPON_TYPES){const a=m.animations[type],png=fs.readFileSync(`${root}/${a.sheet}`);assert.equal(a.frames,4);assert.ok([1,2].includes(a.impactFrame));assert.equal(png.readUInt32BE(16),ATTACK_CELL.width*4);assert.equal(png.readUInt32BE(20),ATTACK_CELL.height);assert.equal(createHash('sha256').update(png).digest('hex'),a.sha256);hashes.push(a.sha256);assert.equal(a.frameHashes.length,4);assert.ok(new Set(a.frameHashes).size>=3);}
  assert.equal(new Set(hashes).size,5,'five real images, never five aliases of punching');
 }
});
test('weapon attack frames reach contact at the server impact and stay bounded when mirrored',async()=>{
 const {attackSpriteFrame,attackSpritePlacement,ATTACK_CELL}=await import('../../src/components/rpg/combat-attack-sprite');
 for(const impact of [1,2]){assert.equal(attackSpriteFrame(0,.4,.15,impact),0);assert.equal(attackSpriteFrame(.15,.4,.15,impact),impact);assert.equal(attackSpriteFrame(.4,.4,.15,impact),3);}
 for(let f=0;f<4;f++)for(const dir of [-1,1]){const p=attackSpritePlacement(f,100,240,.5,dir);assert.equal(p.x+(p.target[0]+ATTACK_CELL.footX)*p.scaleX,100);assert.equal(p.y+(p.target[1]+ATTACK_CELL.footY)*p.scaleY,240);}
 assert.throws(()=>attackSpritePlacement(4,0,0,1,1));
});

test('inventory icons exist as transparent square assets for all four weapons',()=>{
 for(const type of ['sword','axe','spear','dual']){const png=fs.readFileSync(`public/rpg/weapons/${type}.png`);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),384);assert.equal(png.readUInt32BE(20),384);assert.equal(png[25],6);}
});
