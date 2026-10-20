import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {HybridHoldemRoom} from '../mini-services/poker-server/index.ts';
import {HandHistoryStore,authorizedHistory} from '../mini-services/poker-server/hand-history-store.ts';
import {publicHandHistory,handHistoryCSV,type HandHistory} from '../src/lib/poker-hand-history.ts';
import {mergeHandHistories} from '../src/lib/poker-hand-history-client.ts';
import {decideLiveBot} from '../src/lib/poker-live.ts';
import {SelfPlayTrainer} from '../src/lib/self-play-trainer.ts';

function fixture() {
  const room:any=new HybridHoldemRoom(false);room.sleep=async()=>{};
  room.state.handNumber=7;room.state.buttonSeat=0;room.state.smallBlindSeat=1;room.state.bigBlindSeat=2;
  room.state.seats.forEach((s:any,i:number)=>Object.assign(s,{
    inHand:i<3,folded:i>=3,allIn:false,isBot:i!==0,socketId:i===0?'human-socket':null,
    stack:5000-(i===1?100:i===2?200:0),currentBet:i===1?100:i===2?200:0,
    totalBet:i===1?100:i===2?200:0,hasActed:false,
    holeCards:[{rank:i===1?'A':i===2?'K':'Q',suit:'♠'},{rank:i===1?'A':i===2?'K':'J',suit:'♥'}],
  }));
  room.users.set('human-socket',{playerId:'private-human-id',socketId:'human-socket',name:'Hero',seatId:0,preAction:null});
  room.users.set('other-viewer',{playerId:'other',seatId:null});
  room.beginHistory();return room;
}
async function finished():Promise<HandHistory> {
  const room=fixture();
  const actions=[{action:'raise',amount:600},{action:'call',amount:400},{action:'fold',amount:0}];
  room.getDecision=async()=>{room.pendingAudit={vpip:.45,aggression:.7,decisionPath:'test'};return actions.shift();};
  await room.runBettingRound(0,1,[]);
  room.state.board=[{rank:'2',suit:'♠'},{rank:'3',suit:'♥'},{rank:'4',suit:'♦'},{rank:'8',suit:'♣'},{rank:'9',suit:'♠'}];
  await room.finishHand(true);
  assert.equal(room.history.count,1);
  assert.equal(room.getPublicHistory('unjoined'),null);
  const h=room.history.all()[0];
  assert.deepEqual(room.getPublicHistory('human-socket')[0].players[0].holeCards,['Q♠','J♥']);
  assert.deepEqual(room.getPublicHistory('other-viewer')[0].players[0].holeCards,['??','??']);
  return h;
}

test('actual room records mixed human/CPU hand, paid raise chips, blinds and rake exactly once',async()=>{
  const h=await finished();
  assert.equal(h.humans,1);assert.equal(h.cpus,2);assert.equal(h.players.length,3);
  assert.ok(h.players.every(p=>p.startingStack===5000));
  assert.deepEqual(h.forcedBets.map(b=>b.paid),[100,200]);
  assert.deepEqual(h.actions.map(a=>a.source),['cpu','cpu','human']);
  assert.equal(h.actions[0].amount,600);assert.equal(h.actions[0].paid,500);
  assert.equal(h.actions[0].potBefore,300);assert.equal(h.actions[0].potAfter,800);
  assert.equal(h.actions[1].callBefore,400);assert.equal(h.actions[1].paid,400);
  assert.equal(h.rake,60);assert.equal(h.results.reduce((n,r)=>n+r.netProfit,0),-60);
  assert.equal(h.status,'completed');assert.ok(h.endedAt>=h.startedAt);
  assert.equal(h.actions[0].privateAudit?.decisionPath,'test');
});

test('public export masks folded cards, private identities and all CPU decision details',async()=>{
  const h=await finished(),visible=publicHandHistory(h);
  assert.deepEqual(visible.players[0].holeCards,['??','??']);
  assert.deepEqual(visible.players[1].holeCards,['A♠','A♥']);
  const json=JSON.stringify(visible);
  for(const forbidden of ['privatePlayerId','privateAudit','aggression','vpip','private-human-id'])assert.ok(!json.includes(forbidden));
  visible.players[1].holeCards[0]='changed';assert.equal(h.players[1].holeCards[0],'A♠');
  const aborted={...h,status:'aborted' as const,players:h.players.map(p=>({...p,revealed:false}))};
  assert.ok(publicHandHistory(aborted).players.every(p=>p.holeCards.every(c=>c==='??')));
});

test('aborted hands record refunds and never expose cards as a showdown',()=>{
  const room=fixture();room.endHistory();room.endHistory();
  const h=room.history.all()[0];assert.equal(room.history.count,1);
  assert.equal(h.status,'aborted');assert.equal(h.rake,0);
  assert.equal(h.results.reduce((n:any,r:any)=>n+r.refund,0),300);
  assert.equal(h.results.reduce((n:any,r:any)=>n+r.netProfit,0),0);
  assert.ok(h.players.every((p:any)=>!p.revealed));
});

test('archive caps count/bytes, atomically saves private data, and restores on same filesystem',async()=>{
  const h=await finished(),dir=mkdtempSync(path.join(tmpdir(),'holdem-history-'));
  try {
    const file=path.join(dir,'hands.json'),store=new HandHistoryStore(file,2,100000);
    for(let n=0;n<5;n++)store.add({...h,id:String(n)});
    await store.flush();assert.equal(store.count,2);assert.equal(store.writeError,null);
    assert.deepEqual(JSON.parse(readFileSync(file,'utf8')).map((h:any)=>h.id),['3','4']);
    assert.equal(new HandHistoryStore(file,2,100000).all()[0].actions[0].privateAudit?.vpip,.45);
    const bounded=new HandHistoryStore(undefined,1000,Buffer.byteLength(JSON.stringify(h))*2+5);
    for(let n=0;n<10;n++)bounded.add({...h,id:String(n)});
    assert.ok(bounded.count<=2);assert.ok(Buffer.byteLength(JSON.stringify(bounded.all()))<=Buffer.byteLength(JSON.stringify(h))*2+5);
    const invalid=path.join(dir,'not-a-directory');writeFileSync(invalid,'fixture');
    const failing=new HandHistoryStore(path.join(invalid,'hands.json'));failing.add(h);await failing.flush();
    assert.equal(failing.count,1);assert.ok(failing.writeError);
  }finally {rmSync(dir,{recursive:true,force:true});}
});

test('CSV includes settlements for players without actions and escapes formula names',async()=>{
  const h=publicHandHistory(await finished());h.players[0].name='=HYPERLINK("evil")';
  h.actions=h.actions.filter(a=>a.seatId!==0);
  const csv=handHistoryCSV([h]);assert.ok(csv.includes('"settlement"'));
  assert.ok(csv.includes("'=HYPERLINK"));assert.ok(!csv.includes('privateAudit'));
  assert.equal(csv.split('\r\n').length,1+h.actions.length+h.players.length);
});

test('browser history deduplicates hands across reconnects and caps retention',async()=>{
  const h=await finished();const history=Array.from({length:1100},(_,n)=>({...h,id:String(n)}));
  const merged=mergeHandHistories(history,[history[1099]]);
  assert.equal(merged.length,1000);assert.equal(new Set(merged.map(h=>h.id)).size,1000);
});

test('admin export requires a strong bearer secret and never accepts missing/short/wrong values',()=>{
  const token='a'.repeat(48);assert.equal(authorizedHistory('Bearer '+token,token),true);
  for(const header of [undefined,token,'Basic '+token,'Bearer '+'b'.repeat(48)])assert.equal(authorizedHistory(header,token),false);
  assert.equal(authorizedHistory('Bearer short','short'),false);
});

test('private CPU audit has final personality and route without changing the live action shape',()=>{
  const room=fixture();let audit:Record<string,unknown>|undefined;
  const actor=room.state.seats[2];
  const d=decideLiveBot(new SelfPlayTrainer(),{actor,seats:room.state.seats,board:[],pot:0,
    minRaise:400,maxRaise:5000,button:0,smallBlind:1,bigBlind:2,hand:7,raiseLevel:0,onAudit:a=>{audit=a;}});
  assert.ok(audit?.decisionPath);assert.equal(typeof audit?.vpip,'number');assert.equal(typeof audit?.isOOP,'boolean');
  assert.ok(!('privateAudit' in d));assert.ok(!('vpip' in d));
});

test('board transitions are recorded once even when an all-in street has no actions',()=>{
  const room=fixture();room.broadcastTableState();
  room.state.phase='FLOP';room.state.board=[{rank:'2',suit:'♠'},{rank:'3',suit:'♥'},{rank:'4',suit:'♦'}];
  room.broadcastTableState();room.broadcastTableState();
  room.state.phase='TURN';room.state.board.push({rank:'8',suit:'♣'});room.broadcastTableState();
  room.state.phase='RIVER';room.state.board.push({rank:'9',suit:'♠'});room.broadcastTableState();
  room.endHistory();
  assert.deepEqual(room.history.all()[0].streets.map((s:any)=>[s.street,s.board.length]),
    [['PREFLOP',0],['FLOP',3],['TURN',4],['RIVER',5]]);
});
