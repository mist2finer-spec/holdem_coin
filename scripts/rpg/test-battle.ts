import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {HUNT_RULES} from '../../src/components/rpg/combat-rules';
import {huntLoadout} from '../../src/components/rpg/hunt-loadouts';
import {COMBAT_CHARACTERS} from '../../src/components/rpg/combat-characters';
import {curveValue,awardHuntKill,newHuntProgress,upgradeHunt,DEFAULT_HUNT_BALANCE as balance} from '../../src/components/rpg/hunt-progression';
import {RpgStore} from '../../src/lib/rpg-store';
import {RpgService,parseHuntInput} from '../../src/lib/rpg-service';
const input={move:0,attack:false,auto:false};
const advance=(g:HuntEngine,seconds:number)=>{for(let t=0;t<seconds;t+=.01)g.step(.01,0);};
test('hostile enemy telegraphs, deals delayed damage, kills hero and safe revival restores input',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});g.enemyX=g.x+40;
 g.step(.01,0);assert.equal(g.hp,100);advance(g,1.1);assert.equal(g.enemies[0].state,'windup');assert.equal(g.hp,100);
 advance(g,.6);assert.ok(g.hp<100);g.hp=1;advance(g,2.1);assert.equal(g.hp,0);assert.equal(g.action,'die1');
 assert.equal(g.attack(),false);assert.equal(g.revive(),false);advance(g,2.1);assert.equal(g.revive(),true);assert.equal(g.hp,g.maxHP);
 assert.ok(g.enemies.every(e=>Math.abs(e.x-g.x)>=36));
});
test('dodge avoids a telegraphed hit; monster movement cannot pass through hero or occupy a roll origin',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});g.enemyX=g.x+40;advance(g,1.1);g.dodge(-1);advance(g,.5);assert.equal(g.hp,100);
 const h=new HuntEngine(HUNT_RULES.combo,1,{hostile:true});h.enemyX=h.x+200;advance(h,4);assert.ok(h.enemyX-h.x>=36-1e-6);
});
test('nine training loadouts reuse valid frames and retain 3/4/5 hit variation',()=>{
 const counts=new Set<number>();for(const c of COMBAT_CHARACTERS){const p=huntLoadout(c.id);counts.add(p.combo.length);assert.doesNotThrow(()=>new HuntEngine(p.combo,7,{hostile:true,range:p.range,crit:p.crit}));}
 assert.deepEqual([...counts].sort(),[3,4,5]);assert.throws(()=>huntLoadout('../bad'));
});
test('native floors and half-open segments match known values; missing curve is never a free upgrade',()=>{
 assert.equal(curveValue(balance.team,1),1000);assert.equal(curveValue(balance.team,2),1107);assert.equal(curveValue(balance.weapon,10),92);assert.equal(curveValue(balance.team,50),0);
 const p=newHuntProgress();p.xp=995;awardHuntKill(p,balance);assert.equal(p.level,2);assert.equal(p.xp,7);assert.equal(p.kills,1);
 p.soulGem=100;const cost=upgradeHunt(p,balance,'weapon');assert.equal(cost,40);assert.equal(p.weaponLevel,2);assert.equal(p.soulGem,60);
 p.weaponLevel=50;assert.throws(()=>upgradeHunt(p,balance,'weapon'));assert.equal(p.soulGem,60);
});
test('SQLite revision protects concurrent accounts and persists after closing/reopening',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rpg-save-'));try{const file=path.join(dir,'save.sqlite'),store=new RpgStore(file),a=store.load('guest');a.progress.gold=99;
  assert.equal(store.save('guest',a.progress,a.revision),1);assert.throws(()=>store.save('guest',a.progress,0));store.close();
  const next=new RpgStore(file);assert.equal(next.load('guest').progress.gold,99);assert.equal(next.load('other').progress.gold,0);next.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('server controls time and rewards, rejects out-of-order requests and deduplicates retries',()=>{
 const store=new RpgStore(':memory:');let now=0;const service=new RpgService(store,balance,()=>now);let view=service.start('guest','hong');
 let seq=0;for(let i=0;i<160;i++){now+=100;view=service.command('guest',view.id,++seq,{...input,auto:true});}
 assert.ok(view.progress.kills>0);const savedGold=view.progress.gold;
 assert.deepEqual(service.command('guest',view.id,seq,{...input,auto:true}),view);assert.equal(store.load('guest').progress.gold,savedGold);
 const elapsed=view.elapsed;view=service.command('guest',view.id,++seq,{...input,auto:true});assert.equal(view.elapsed,elapsed);
 now+=100000;view=service.command('guest',view.id,++seq,input);assert.ok(view.elapsed-elapsed<=.300001);
 assert.throws(()=>service.command('guest',view.id,seq+2,input));
 const old=view.id;service.start('guest','white-bob');assert.throws(()=>service.command('guest',old,seq+1,input));store.close();
});
test('client cannot submit rewards or invalid movement/actions',()=>{
 assert.deepEqual(parseHuntInput({...input,gold:999,kills:999}),{...input,basic:undefined,skill:undefined,dodge:undefined,parry:undefined});
 for(const value of [{...input,move:NaN},{...input,move:2},{...input,skill:6},{...input,dodge:4}])assert.throws(()=>parseHuntInput(value));
});
test('insufficient upgrade does not consume a sequence or discard subsequent combat rewards',()=>{
 const store=new RpgStore(':memory:');let now=0;const service=new RpgService(store,balance,()=>now),v=service.start('guest','hong');now=200;
 assert.throws(()=>service.command('guest',v.id,1,input,'weapon'));const result=service.command('guest',v.id,1,input);assert.equal(result.sequence,1);assert.equal(result.progress.soulGem,0);store.close();
});
test('server upgrade charges once, raises combat stats and survives re-entry',()=>{
 const store=new RpgStore(':memory:'),saved=store.load('guest');saved.progress.soulGem=100;store.save('guest',saved.progress,saved.revision);
 const service=new RpgService(store,balance,()=>0),v=service.start('guest','hong');
 const result=service.command('guest',v.id,1,input,'weapon');assert.equal(result.progress.weaponLevel,2);assert.equal(result.progress.soulGem,60);
 assert.deepEqual(service.command('guest',v.id,1,input,'weapon'),result);const next=service.start('guest','pink-glasses');assert.equal(next.progress.soulGem,60);assert.equal(next.progress.weaponLevel,2);store.close();
});
test('respawn cannot introduce a fourth blocker or occupy the origin during a dodge',()=>{
 const g=new HuntEngine(HUNT_RULES.combo,2,{hostile:true});g.x=500;g.enemies[0].x=540;g.enemies[1].x=500;g.enemies[1].hp=0;g.enemies[1].respawnAt=0;
 g.dodge(1);advance(g,.4);assert.equal(g.enemies[1].hp,0);advance(g,.3);assert.ok(g.enemies.every(e=>e.hp<=0||Math.abs(e.x-g.x)>=36-1e-6));
});
