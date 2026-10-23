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
