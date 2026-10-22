import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {HuntEngine,WORLD_WIDTH} from '../../src/components/rpg/hunt-engine';
import {HUNT_RULES,motions} from '../../src/components/rpg/combat-rules';
function advance(g:HuntEngine,seconds:number,direction=0){for(let t=0;t<seconds-1e-8;t+=.01)g.step(Math.min(.01,seconds-t),direction);}
function ready(){const g=new HuntEngine();g.x=500;g.enemyX=580;return g;}
test('motion profile matches actual skeleton bytes and every requested attack/skill alias exists',()=>{
 const raw=fs.readFileSync('public/rpg/Hero_Axe01.json'),data=JSON.parse(raw.toString());
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),motions.sha256);
 assert.equal(motions.attackHitEventsPresent,false);
 for(const name of ['attack1','attack2','attack3','attack4','attack5','dash','avoid1','skill5_loop','skill5_end'])
  assert.ok(data.animations[name]&&motions.durations[name as keyof typeof motions.durations]>0);
});
test('manual movement remains bounded and invalid time/direction cannot poison state',()=>{
 const g=ready();advance(g,20,-1);assert.equal(g.x,65);advance(g,20,1);assert.equal(g.x,WORLD_WIDTH-65);
 g.step(NaN,Infinity);g.step(-1,NaN);g.step(Infinity,1);
 assert.ok([g.x,g.elapsed,...g.cooldowns].every(Number.isFinite));
});
test('damage occurs on the configured swing frame once, never immediately at attack start',()=>{
 const g=ready();assert.equal(g.attack(),true);assert.equal(g.enemyHP,100);
 advance(g,HUNT_RULES.combo[0].hitAt-.02);assert.equal(g.enemyHP,100);
 advance(g,.03);assert.equal(g.enemyHP,80);advance(g,.18);assert.equal(g.enemyHP,80);
});
test('target range is rechecked at impact and delayed swings cannot damage a replacement monster',()=>{
 const g=ready();g.attack();g.enemyX=1000;advance(g,.5);assert.equal(g.enemyHP,100);
 const other=ready();other.attack();other.enemySerial++;advance(other,.5);assert.equal(other.enemyHP,100);
});
test('five-stage configured combo advances modulo the list rather than repeating attack1',()=>{
 const g=ready();g.enemyHP=1000;
 for(let i=0;i<7;i++){
  assert.equal(g.attack(),true);assert.equal(g.action,`attack${i%5+1}`);assert.equal(g.comboStage,i%5+1);
  advance(g,motions.durations[`attack${i%5+1}` as keyof typeof motions.durations]+.01);
 }
});
test('three/four-stage loadouts use their configured list length; invalid profiles fail early',()=>{
 for(const n of [3,4]){const g=new HuntEngine(HUNT_RULES.combo.slice(0,n));g.enemyX=g.x+80;g.enemyHP=1000;
  for(let i=0;i<n+1;i++){g.attack();assert.equal(g.comboStage,i%n+1);advance(g,.4);}}
 assert.throws(()=>new HuntEngine([]));assert.throws(()=>new HuntEngine([{animation:'attack1',hitAt:99,damage:20}]));
});
test('combo expires after a gap; buffered input is limited to one upcoming basic attack',()=>{
 const g=ready();g.enemyHP=1000;g.attack();advance(g,.1);assert.equal(g.attack(),false);
 advance(g,.15);assert.equal(g.attack(),true);assert.equal(g.attack(),true);
 advance(g,.15);assert.equal(g.action,'attack2');advance(g,.4);assert.equal(g.enemyHP,960);
 advance(g,HUNT_RULES.comboReset+.1);g.attack();assert.equal(g.action,'attack1');
});
test('held attack supports repeated swings and clearing input stops further queued swings',()=>{
 const g=ready();g.enemyHP=1000;g.attackHeld=true;advance(g,1.6);assert.ok(g.enemyHP<940);
 g.clearInput();advance(g,.8);const hp=g.enemyHP;advance(g,1);assert.equal(g.enemyHP,hp);
});
test('automatic approach Rush advances over time, stops in range and inflicts no contact damage',()=>{
 const g=new HuntEngine();g.setAuto(true);g.step(.01,0);assert.equal(g.action,'dash');const start=g.x;
 g.step(.01,0);assert.ok(g.x>start&&g.x<g.enemyX-HUNT_RULES.stopRange);assert.equal(g.enemyHP,100);
 advance(g,.25);assert.ok(g.action.startsWith('attack'));assert.ok(g.x<=g.enemyX-HUNT_RULES.stopRange+1e-8);
 assert.equal(g.enemyHP,100);advance(g,.22);assert.equal(g.enemyHP,80);
});
test('manual input and AUTO OFF cancel approach Rush without teleporting to its old destination',()=>{
 for(const manual of [true,false]){const g=new HuntEngine();g.setAuto(true);g.step(.01,0);g.step(.01,0);const x=g.x;
  if(manual)g.step(.01,-1);else g.setAuto(false);
  assert.notEqual(g.action,'dash');assert.ok(g.x<=x);if(!manual){advance(g,.5);assert.equal(g.x,x);}}
});
test('manual attack request approaches a remote target, while a far target is reached by ordinary run first',()=>{
 const g=new HuntEngine();g.attack();g.step(.01,0);assert.equal(g.action,'dash');
 const far=new HuntEngine();far.enemyX=1800;far.setAuto(true);far.step(.01,0);assert.equal(far.action,'run1');
 assert.ok(far.x>620&&far.x<630);
});
test('dodge travels continuously for the actual avoid clip and clamps world bounds',()=>{
 const g=ready(),x=g.x;assert.equal(g.dodge(1),true);assert.equal(g.x,x);g.step(.05,0);assert.ok(g.x>x&&g.x<x+125);
 advance(g,.46);assert.equal(g.x,x+125);assert.equal(g.dodge(1),false);
 advance(g,.8);g.x=WORLD_WIDTH-80;g.dodge(1);advance(g,.51);assert.equal(g.x,WORLD_WIDTH-65);
});
test('long skills are not cut at .6 seconds, and channel start/loop/end all play',()=>{
 for(const skill of [2,3]){const g=ready();g.attack(skill);advance(g,.7);assert.equal(g.action,`skill${skill+1}`);
  assert.equal(g.attack(),false);advance(g,.5);assert.equal(g.action,'stay1');}
 const g=ready();g.enemyHP=1000;g.attack(4);assert.equal(g.action,'skill5');advance(g,.18);assert.equal(g.action,'skill5_loop');
 advance(g,.34);assert.equal(g.action,'skill5_end');advance(g,.51);assert.equal(g.action,'stay1');assert.equal(g.enemyHP,960);
});
test('skills enforce cooldowns and recovery is a timed heal capped at max HP',()=>{
 const g=ready();g.attack(0);advance(g,.51);assert.equal(g.attack(0),false);advance(g,4.6);assert.equal(g.attack(0),true);
 const heal=ready();heal.hp=90;heal.attack(5);assert.equal(heal.hp,90);advance(heal,1.6);assert.equal(heal.hp,100);
 assert.equal(heal.attack(5),false);assert.equal(heal.enemyHP,100);
});
test('pause freezes motion, hits and cooldowns; one kill yields one reward and one fresh target id',()=>{
 const g=ready();g.enemyHP=20;g.attack();g.paused=true;const before=JSON.stringify(g);
 advance(g,2);assert.equal(JSON.stringify(g),before);g.paused=false;advance(g,.3);
 assert.equal(g.kills,1);assert.equal(g.coins,25);assert.equal(g.xp,12);assert.equal(g.enemyHP,0);
 const serial=g.enemySerial;advance(g,1);assert.equal(g.enemyHP,0);advance(g,1.1);assert.equal(g.enemySerial,serial+1);
 assert.equal(g.enemyHP,100);assert.equal(g.kills,1);
});
test('repeat animations carry fresh serials, auto play remains finite and replays deterministically',()=>{
 const run=()=>{const g=new HuntEngine();g.setAuto(true);advance(g,50);assert.ok(g.kills>0);
  assert.equal(g.coins,g.kills*25);assert.ok([g.x,g.enemyHP,g.elapsed].every(Number.isFinite));return JSON.stringify(g);};
 assert.equal(run(),run());
 const g=new HuntEngine(HUNT_RULES.combo.slice(0,1));g.enemyX=g.x+80;g.attack();const serial=g.actionSerial;
 advance(g,.38);g.attack();assert.equal(g.action,'attack1');assert.ok(g.actionSerial>serial);
});
