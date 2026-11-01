import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createGameStorage} from '../../src/lib/game-storage';
import {RpgItemsStore} from '../../src/lib/rpg-items';
import {initializeIdleProfile} from '../../src/lib/rpg-idle-profile';
import {sqliteAtomic} from '../../src/lib/rpg-sqlite';
import {CORE_EDGES,changeBuild,equipJewel,unequipJewel,ACTIVE_CATALOG,GEMS,type BuildState} from '../../src/components/rpg/hunt-build';
import {ACQUIRABLE_ACTIVE_GEMS} from '../../src/components/rpg/idle-gacha';
import {ITEM_REWARD_POLICY} from '../../src/components/rpg/transcendence';
process.env.POKER_TEST_MODE='1';
const {LobbyLedger}=require('../../mini-services/poker-server/lobby-ledger') as typeof import('../../mini-services/poker-server/lobby-ledger');
const account='e'.repeat(64),monday=Date.UTC(2026,10,2),week=7*86400000;
function fixture(){const dir=mkdtempSync(path.join(tmpdir(),'idle-items-')),file=path.join(dir,'game.sqlite'),a=createGameStorage(file),b=createGameStorage(file);return{dir,file,a,b,close(){a.close();b.close();rmSync(dir,{recursive:true,force:true});}};}
function initialize(s:ReturnType<typeof createGameStorage>,id=account){return sqliteAtomic(s.db,()=>{const saved=s.progress.load(id);initializeIdleProfile(saved.progress,100000);saved.revision=s.progress.save(id,saved.progress,saved.revision);return saved;});}
function wins(s:RpgItemsStore,n:number,prefix='win',at=Date.now()){for(let i=0;i<n;i++)s.awardCashWin(`${prefix}:${i}`,account,{flushPlus:false},at);}
function allocate(b:BuildState,target:string){const queue=[['root']],seen=new Set(['root']);for(const route of queue){const tail=route.at(-1)!;if(tail===target){for(const id of route.slice(1))if(!b.nodes.includes(id))b=changeBuild(b,`core-allocate-${id}`,40);return b;}for(const[a,c]of CORE_EDGES){const next=a===tail?c:c===tail?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push([...route,next]);}}}throw Error('Missing path');}

test('live inventory exposes persisted counts and actual weapons; standalone fixtures alone retain compatibility',()=>{
 const f=fixture(),legacy=new RpgItemsStore(':memory:');try{const fixture=legacy.view('fixture');assert.equal(fixture.testCollection,true);assert.equal(Object.keys(fixture.gemCollection.active).length,ACTIVE_CATALOG.length);assert.equal(Object.keys(fixture.gemCollection.support).length,GEMS.length);assert.throws(()=>legacy.transcend('fixture','gem:forged','invalid-target-00001',fixture.revision));
  f.a.progress.load(account);assert.equal(f.a.items.view(account).testCollection,false);assert.deepEqual(f.a.items.view(account).gemCollection.active,{});initialize(f.a);const v=f.b.items.view(account);assert.equal(v.testCollection,false);assert.equal(Object.keys(v.gemCollection.active).length,6);assert.deepEqual(v.gemCollection.support,{});assert.deepEqual(v.ownedWeapons,['axe']);v.gemCollection.active.fireball=100;assert.equal(f.b.items.view(account).gemCollection.active.fireball,undefined);
 }finally{legacy.close();f.close();}
});

test('transcend enforces acquired gem and weapon ownership atomically and rejects changed-target nonce replay',()=>{
 const f=fixture();try{initialize(f.a);let v=f.a.items.view(account);for(const target of ['gem:fireball','gem:power','gear:sword'])assert.throws(()=>f.a.items.transcend(account,target,'ownership-check-00001',v.revision),/보유하지/);assert.deepEqual(f.b.items.view(account),v);
  const p=f.a.progress.load(account);p.progress.gemCollection!.support.power=2;p.progress.equipment!.items.push({instanceId:'owned_sword',slot:'weapon',rarity:'normal',weaponType:'sword',level:1,gems:[null]});f.a.progress.save(account,p.progress,p.revision);
  v=f.a.items.transcend(account,'gem:power','owned-transcend-00001',v.revision,()=>0);assert.equal(v.orbs,4);assert.equal(v.gemCollection.support.power,2);assert.equal(v.transcended['gem:power'],'power');assert.deepEqual(f.a.items.transcend(account,'gem:power','owned-transcend-00001',0,()=>{throw Error('no second draw');}),v);assert.throws(()=>f.a.items.transcend(account,'gear:sword','owned-transcend-00001',v.revision),/대상을 변경/);v=f.a.items.transcend(account,'gear:sword','owned-transcend-00002',v.revision,()=>2);assert.equal(v.transcended['gear:sword'],'pure');
 }finally{f.close();}
});

test('cash rewards deduplicate results, flush tickets and weekly ten-win orbs with per-week protection',()=>{
 const f=fixture();try{assert.equal(f.a.items.awardCashWin('hand:0',account,{flushPlus:false},monday),true);assert.equal(f.b.items.awardCashWin('hand:0',account,{flushPlus:true},monday),false);let v=f.a.items.view(account,monday);assert.equal(v.mileage,10);assert.equal(v.rerollTickets,0);assert.equal(v.weeklyWins,1);
  for(let i=1;i<9;i++)f.a.items.awardCashWin(`hand:${i}`,account,{flushPlus:i===1},monday);assert.equal(f.a.items.view(account,monday).orbs,5);f.a.items.awardCashWin('hand:9',account,{flushPlus:false},monday);v=f.a.items.view(account,monday);assert.equal(v.orbs,6);assert.equal(v.weeklyWins,10);assert.equal(v.weeklyOrbClaimed,true);assert.equal(v.rerollTickets,1);
  wins(f.a.items,10,'more',monday);assert.equal(f.a.items.view(account,monday).orbs,6);wins(f.a.items,10,'next',monday+week);assert.equal(f.a.items.view(account,monday+week).orbs,7);wins(f.a.items,10,'clock-back',monday);assert.equal(f.a.items.view(account,monday).orbs,7);assert.throws(()=>f.a.items.awardCashWin('bad',account,{flushPlus:'yes' as any},monday));
 }finally{f.close();}
});

test('boss first-clear awards only once per account and server stage across connections',()=>{
 const f=fixture();try{assert.equal(f.a.items.awardBossFirst(account,0),true);assert.equal(f.b.items.awardBossFirst(account,0),false);assert.equal(f.b.items.awardBossFirst(account,1),true);assert.equal(f.a.items.view(account).orbs,7);assert.equal(f.a.items.awardBossFirst('other',0),true);for(const stage of [-1,6001,1.5,NaN])assert.throws(()=>f.a.items.awardBossFirst(account,stage));assert.equal(f.b.items.view(account).orbs,7);
 }finally{f.close();}
});

test('actual shared-wallet settlement failure rolls back cash win rewards and checkpoint; retry grants once',()=>{
 const f=fixture();try{const ledger=new LobbyLedger(f.a.db),player=ledger.connect('winner',undefined)!;ledger.reserve('winner');ledger.start('winner');const before=f.a.items.view(account);f.a.db.exec("CREATE TRIGGER fail_checkpoint BEFORE INSERT ON holdem_wallet_settlements BEGIN SELECT RAISE(ABORT,'injected settlement'); END;");
  assert.throws(()=>ledger.settleHand('reward-hand',[{socketId:'winner',stack:6500}],()=>{f.a.items.awardCashWin('reward-hand',account,{flushPlus:true});}),/injected/);assert.deepEqual(f.b.items.view(account),before);assert.equal((f.b.db.prepare('SELECT table_amount FROM holdem_wallets WHERE token=?').get(player.token) as any).table_amount,5000);assert.equal(ledger.isSettled('reward-hand'),false);
  f.a.db.exec('DROP TRIGGER fail_checkpoint');assert.equal(ledger.settleHand('reward-hand',[{socketId:'winner',stack:6500}],()=>{f.a.items.awardCashWin('reward-hand',account,{flushPlus:true});}),true);assert.equal(ledger.settleHand('reward-hand',[{socketId:'winner',stack:9999}],()=>{throw Error('no callback twice');}),false);assert.equal(f.b.items.view(account).mileage,10);assert.equal(f.b.items.view(account).rerollTickets,1);
 }finally{f.close();}
});

test('Timeless reroll rejects equipped/foreign/non-Timeless items, spends once and preserves immutable variant',()=>{
 const f=fixture();try{initialize(f.a);f.a.items.purchaseJewel(account,'gloriousvanity','seed-purchase-00001','Doryani');f.a.items.purchaseJewel(account,'crimson','seed-purchase-00002');f.a.items.purchaseJewel('other','lethalpride','seed-purchase-00003','Kaom');f.a.items.awardCashWin('flush',account,{flushPlus:true});let v=f.a.items.view(account);const jewel=v.jewels![0],normal=v.jewels![1],foreign=f.a.items.jewels('other')[0];
  assert.throws(()=>f.a.items.rerollJewel(account,normal.instanceId,'reroll-wrong-00001',v.revision),/Timeless/);assert.throws(()=>f.a.items.rerollJewel(account,foreign.instanceId,'reroll-wrong-00002',v.revision),/Timeless/);
  let p=f.a.progress.load(account);p.progress.level=40;p.progress.build=equipJewel(allocate(p.progress.build!,'jewel_1'),'jewel_1',jewel,40);f.a.progress.save(account,p.progress,p.revision);assert.throws(()=>f.a.items.rerollJewel(account,jewel.instanceId,'reroll-equipped-00001',v.revision),/해제/);assert.equal(f.a.items.view(account).rerollTickets,1);
  p=f.a.progress.load(account);p.progress.build=unequipJewel(p.progress.build!,'jewel_1',40);f.a.progress.save(account,p.progress,p.revision);v=f.a.items.rerollJewel(account,jewel.instanceId,'reroll-success-00001',v.revision,()=>0);const changed=v.jewels!.find(j=>j.instanceId===jewel.instanceId)!;assert.notEqual(changed.seed,jewel.seed);assert.equal(changed.conqueror,'Doryani');assert.equal(v.rerollTickets,0);assert.deepEqual(f.b.items.rerollJewel(account,jewel.instanceId,'reroll-success-00001',0,()=>{throw Error('never draw twice');}),v);assert.throws(()=>f.a.items.rerollJewel(account,normal.instanceId,'reroll-success-00001',v.revision),/대상을 변경/);assert.throws(()=>f.a.items.rerollJewel(account,jewel.instanceId,'reroll-empty-00001',v.revision),/부족/);
 }finally{f.close();}
});

test('reroll SQL failure and stale revisions leave ticket and original seed unchanged',()=>{
 const f=fixture();try{initialize(f.a);f.a.items.purchaseJewel(account,'lethalpride','reroll-atomic-purchase','Kaom');f.a.items.awardCashWin('flush2',account,{flushPlus:true});const before=f.a.items.view(account),id=before.jewels![0].instanceId;f.a.db.exec("CREATE TRIGGER fail_reroll_receipt BEFORE INSERT ON rpg_item_requests BEGIN SELECT RAISE(ABORT,'injected receipt'); END;");assert.throws(()=>f.a.items.rerollJewel(account,id,'reroll-atomic-00001',before.revision,()=>5),/injected/);assert.deepEqual(f.b.items.view(account),before);f.a.db.exec('DROP TRIGGER fail_reroll_receipt');assert.throws(()=>f.a.items.rerollJewel(account,id,'reroll-atomic-00001',before.revision-1),/다른 창/);const next=f.b.items.rerollJewel(account,id,'reroll-atomic-00001',before.revision,()=>9998);assert.equal(next.rerollTickets,0);assert.ok(next.jewels![0].seed<=10000);assert.notEqual(next.jewels![0].seed,before.jewels![0].seed);
 }finally{f.close();}
});

test('mileage gem redemption credits actual collection with player CAS, excludes starters, retries once and rolls back failures',()=>{
 const f=fixture();try{initialize(f.a);wins(f.a.items,20,'mileage');const before=f.a.items.view(account),progress=f.a.progress.load(account);f.a.db.exec("CREATE TRIGGER fail_redemption BEFORE INSERT ON rpg_item_requests BEGIN SELECT RAISE(ABORT,'injected mileage receipt'); END;");assert.throws(()=>f.a.items.redeemMileage(account,'gem','mileage-failure-0001',before.revision,()=>0),/injected/);assert.deepEqual(f.b.items.view(account),before);assert.deepEqual(f.b.progress.load(account),progress);f.a.db.exec('DROP TRIGGER fail_redemption');
  const next=f.a.items.redeemMileage(account,'gem','mileage-failure-0001',before.revision,()=>0),gem=ACQUIRABLE_ACTIVE_GEMS[0].id;assert.equal(next.mileage,100);assert.equal(next.gemCollection.active[gem],1);assert.equal(f.b.progress.load(account).revision,progress.revision+1);assert.equal(f.b.progress.load(account).progress.soulGem,progress.progress.soulGem);assert.deepEqual(f.b.items.redeemMileage(account,'gem','mileage-failure-0001',before.revision,()=>{throw Error('no double reward');}),next);
  assert.throws(()=>f.a.items.redeemMileage(account,'reroll','mileage-failure-0001',next.revision),/대상을 변경/);const ticket=f.a.items.redeemMileage(account,'reroll','mileage-ticket-0001',next.revision);assert.equal(ticket.mileage,0);assert.equal(ticket.rerollTickets,1);assert.throws(()=>f.a.items.redeemMileage(account,'gem','mileage-empty-00001',ticket.revision),/부족/);
 }finally{f.close();}
});

test('two processes cannot both spend one ticket under the same revision',async()=>{
 const f=fixture();try{initialize(f.a);f.a.items.purchaseJewel(account,'lethalpride','race-purchase-00001','Kaom');f.a.items.awardCashWin('race-flush',account,{flushPlus:true});const before=f.a.items.view(account),{spawn}=await import('node:child_process');
  const run=(nonce:string)=>new Promise<any>((resolve,reject)=>{const code=`const {RpgItemsStore}=require(${JSON.stringify(path.resolve('src/lib/rpg-items.ts'))});const s=new RpgItemsStore(${JSON.stringify(f.file)});try{s.rerollJewel('${account}','${before.jewels![0].instanceId}','${nonce}',${before.revision});console.log(JSON.stringify({ok:true}));}catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}finally{s.close();}`;const child=spawn(process.execPath,['--import',path.resolve('mini-services/poker-server/node_modules/tsx/dist/loader.mjs'),'-e',code],{stdio:['ignore','pipe','pipe']});let out='',error='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>error+=d);child.on('error',reject);child.on('exit',n=>n?reject(Error(error)):resolve(JSON.parse(out.trim())));});
  const results=await Promise.all([run('reroll-race-request-1'),run('reroll-race-request-2')]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.a.items.view(account).rerollTickets,0);assert.equal(f.a.items.view(account).revision,before.revision+1);
 }finally{f.close();}
});

test('live API initializes real starter inventory once and rolls failed mutations back with the same shared profile transaction',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'items-api-'));process.env.RPG_SAVE_DIR=dir;const {NextRequest}=await import('next/server'),{POST}=await import('../../src/app/api/rpg/items/route'),{gameStorage}=await import('../../src/lib/game-storage');
 const post=(body:unknown)=>POST(new NextRequest('http://localhost/api/rpg/items',{method:'POST',headers:{host:'localhost',origin:'http://localhost',cookie:`rpg_guest=${account}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 try{let r=await post({action:'view'});assert.equal(r.status,200);let v=await r.json();assert.equal(v.testCollection,false);assert.equal(Object.keys(v.gemCollection.active).length,6);assert.deepEqual(v.gemCollection.support,{});assert.equal(gameStorage().progress.load(account).progress.soulGem,1000);r=await post({action:'view'});assert.equal(r.status,200);assert.equal(gameStorage().progress.load(account).progress.soulGem,1000);const before=gameStorage().progress.load(account);r=await post({action:'transcend',target:'gem:fireball',requestId:'api-unowned-test-0001',revision:v.revision});assert.equal(r.status,400);assert.deepEqual(gameStorage().progress.load(account),before);assert.equal(gameStorage().items.view(account).orbs,5);
  wins(gameStorage().items,10,'api-mileage');v=gameStorage().items.view(account);r=await post({action:'redeem-mileage',reward:'gem',requestId:'api-gem-test-0000001',revision:v.revision,gemId:'rift',roll:0});assert.equal(r.status,200);const paid=await r.json();assert.equal(paid.mileage,0);assert.equal(Object.values(paid.gemCollection.active).reduce((a:any,b:any)=>a+b,0)+Object.values(paid.gemCollection.support).reduce((a:any,b:any)=>a+b,0),7);assert.equal(paid.gemCollection.active.rift,1);
 }finally{gameStorage().close();delete process.env.RPG_SAVE_DIR;rmSync(dir,{recursive:true,force:true});}
});
