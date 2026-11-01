import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
import test from 'node:test';import assert from 'node:assert/strict';
import {newBuild,validateBuild,changeBuild,buildBudget,buildView,compileSkill,CORE_NODES,connected,GEMS,ACTIVE_SKILLS,supports,isBuildAction} from '../../src/components/rpg/hunt-build';
import {newHuntProgress} from '../../src/components/rpg/hunt-progression';
import {RpgStore} from '../../src/lib/rpg-store';import {RogueService} from '../../src/lib/rpg-rogue-service';
import {RogueEngine} from '../../src/components/rpg/rogue/engine';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
const idle={x:0,y:0,auto:false};
test('six actives, six gems, five supports form a six-link; invalid and incompatible links leave original unchanged',()=>{
 assert.equal(ACTIVE_SKILLS.length,6);assert.equal(GEMS.length,30);assert.equal(CORE_NODES.length,780);
 const b=newBuild(),before=structuredClone(b);assert.equal(b.links.length,6);b.links.forEach(l=>assert.equal(l.length,5));
 for(const bad of ['gem-0-5-power','gem-6-0-power','gem-0-0-evil','core-allocate-0_18','core-allocate-__proto__'])assert.equal(isBuildAction(bad),false);
 assert.throws(()=>changeBuild(b,'gem-0-0-renew'));assert.throws(()=>changeBuild(b,'gem-5-0-power'));assert.deepEqual(b,before);
 const linked=changeBuild(b,'gem-0-0-power');assert.throws(()=>changeBuild(linked,'gem-0-1-power'));
 assert.deepEqual(changeBuild(linked,'gem-0-0-empty'),b);
 for(let i=0;i<6;i++)for(const gem of GEMS){if(supports(i,gem.id))validateBuild(changeBuild(b,`gem-${i}-0-${gem.id}`));else assert.throws(()=>changeBuild(b,`gem-${i}-0-${gem.id}`));}
});
test('additive increases and multiplicative gems: deterministic damage, range, cooldown, echo and healing',()=>{
 let b=newBuild();b=changeBuild(b,'core-allocate-0_1');b=changeBuild(b,'core-allocate-0_2');
 b=changeBuild(b,'gem-0-0-power');b=changeBuild(b,'gem-0-1-echo');b=changeBuild(b,'gem-0-2-quick');const c=compileSkill(b,0);
 assert.ok(Math.abs(c.effect-1.12*1.3*.65*.9)<1e-12);assert.ok(Math.abs(c.cooldown-1.15*.75)<1e-12);assert.equal(c.repeats,1);
 b=changeBuild(b,'gem-5-0-renew');assert.equal(compileSkill(b,5).effect,1.45);assert.equal(compileSkill(b,5).heal,true);
 assert.equal(compileSkill(undefined,1).effect,1);const snapshot=buildView(b);snapshot.state.nodes.push('bad');validateBuild(b);
});
test('all 1000 prefix graphs: connectivity, points and bridge removal enforced',()=>{
 for(let a=0;a<=9;a++)for(let b=0;b<=9;b++)for(let c=0;c<=9;c++){
  const state=newBuild();[a,b,c].forEach((n,branch)=>{for(let i=1;i<=n;i++)state.nodes.push(`${branch}_${i}`);});assert.equal(connected(state.nodes),true);
  validateBuild(state,16);if(a+b+c>12)assert.throws(()=>validateBuild(state,1));else validateBuild(state,1);
  if(a>1)assert.throws(()=>changeBuild(state,'core-refund-0_1',16));
 }
 let b=newBuild();assert.throws(()=>changeBuild(b,'core-allocate-0_2'));for(let i=1;i<=9;i++)b=changeBuild(b,`core-allocate-0_${i}`);for(let i=1;i<=3;i++)b=changeBuild(b,`core-allocate-1_${i}`);assert.throws(()=>changeBuild(b,'core-allocate-1_4'));
 assert.equal(buildBudget(100),90);assert.deepEqual(changeBuild(b,'core-reset').nodes,['root']);
 const disconnected={...newBuild(),nodes:['root','0_2']};assert.throws(()=>validateBuild(disconnected));
});
test('SQLite old saves migrate, saved builds survive a new service, duplicates charge once and stale writer fails',()=>{
 const store=new RpgStore(':memory:');try{
  const old=newHuntProgress();delete old.build;store.db.prepare('INSERT INTO rpg_players VALUES(?,?,0,0)').run('guest',JSON.stringify(old));assert.deepEqual(store.load('guest').progress.build,newBuild());
  let now=0;const service=new RogueService(()=>now,()=>11,store),v=service.start('guest','hong');const one=service.command('guest',v.id,1,idle,'core-allocate-0_1');
  assert.equal(one.build.remaining,11);assert.deepEqual(service.command('guest',v.id,1,idle,'core-allocate-0_1'),one);assert.equal(store.load('guest').revision,1);
  const other=new RogueService(()=>now,()=>12,store),w=other.start('guest','hong');assert.ok(w.build.state.nodes.includes('0_1'));
  other.command('guest',w.id,1,idle,'gem-0-0-power');assert.throws(()=>service.command('guest',v.id,2,idle,'core-allocate-0_2'),/다른 세션/);
  assert.deepEqual(store.load('guest').progress.build?.links[0],['power',null,null,null,null]);assert.equal(store.load('guest').progress.build?.nodes.includes('0_2'),false);
  assert.throws(()=>other.command('guest',w.id,3,idle,'core-reset'));assert.throws(()=>other.command('guest',w.id,2,idle,'gem-5-0-power'));
  const valid=other.command('guest',w.id,2,idle,'gem-5-0-renew');assert.equal(valid.sequence,2);
 }finally{store.close();}
});
function rogue(build= newBuild()) {const g=new RogueEngine(1);g.build=build;g.mobs=g.mobs.slice(0,1);const m=g.mobs[0];m.x=g.hero.x+70;m.hp=m.maxHP=10000;m.until=999;return g;}
function step(g:RogueEngine,seconds:number){for(let t=0;t<seconds;t+=.01)g.step(.01,idle);}
test('default dungeon: linked damage, extended AoE and delayed echo hit real enemies; cast captures build',()=>{
 let b=changeBuild(newBuild(),'gem-0-0-power');b=changeBuild(b,'gem-0-1-echo');const g=rogue(b);g.command({...idle,skill:0});g.build=newBuild();step(g,.26);assert.ok(Math.abs(g.mobs[0].hp-(10000-110*1.3*.65))<1e-8);step(g,.22);assert.ok(Math.abs(g.mobs[0].hp-(10000-2*110*1.3*.65))<1e-8);step(g,1);assert.equal(g.hero.motion,null);
 const near=rogue(),wide=rogue(changeBuild(newBuild(),'gem-0-0-wide'));near.mobs[0].x=wide.mobs[0].x=near.hero.x+210;near.command({...idle,skill:0});wide.command({...idle,skill:0});step(near,.3);step(wide,.3);assert.equal(near.mobs[0].hp,10000);assert.equal(wide.mobs[0].hp,9901);
});
test('healing, cooldown and protection work in the default dungeon',()=>{
 let b=changeBuild(newBuild(),'gem-5-0-renew');b=changeBuild(b,'gem-5-1-echo');b=changeBuild(b,'gem-5-2-quick');b=changeBuild(b,'core-allocate-1_1');const g=rogue(b);g.hero.hp=1000;g.command({...idle,skill:5});assert.ok(Math.abs(g.cooldowns[5]-12*1.2*.75)<1e-8);step(g,.5);assert.ok(Math.abs(g.hero.hp-(1000+2*2500*1.45*.65*.9))<1e-8);
 const m=g.mobs[0];g.hero.motion=null;m.x=g.hero.x+25;m.state='windup';m.until=0;m.target={x:g.hero.x,y:g.hero.y};const hp=g.hero.hp;step(g,.01);assert.ok(Math.abs(hp-g.hero.hp-65*.98)<1e-8);
});
test('campaign uses the same compiler, repeats actual damage and healing, retaining baseline skill values',()=>{
 const a=new HuntEngine(HUNT_RULES.combo,1),b=new HuntEngine(HUNT_RULES.combo,1);a.enemyX=b.enemyX=a.x+40;a.enemyHP=b.enemyHP=10000;
 b.progress.build=changeBuild(changeBuild(newBuild(),'gem-0-0-power'),'gem-0-1-echo');assert.equal(a.attack(0),true);assert.equal(b.attack(0),true);
 for(let i=0;i<300;i++){a.step(.01,0);b.step(.01,0);}assert.ok(Math.abs((10000-b.enemyHP)/(10000-a.enemyHP)-1.3*.65*2)<1e-8);
 const h=new HuntEngine(HUNT_RULES.combo,1);h.hp=1;h.progress.build=changeBuild(newBuild(),'gem-5-0-renew');h.attack(5);for(let i=0;i<300;i++)h.step(.01,0);assert.ok(Math.abs(h.hp-Math.min(h.maxHP,37.25))<1e-8);
});
