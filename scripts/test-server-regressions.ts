import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HybridHoldemRoom } from '../mini-services/poker-server/index.ts';
import { rotateSeatView } from '../src/lib/poker-seat-view.ts';

function roomWith(bets: number[] = [200, 400]) {
  const room: any = new HybridHoldemRoom(false);
  room.sleep = async () => {};
  room.state.handNumber = 1;
  room.state.activeSeatId = 0;
  room.state.seats.forEach((seat: any, i: number) => Object.assign(seat, {
    inHand: i < bets.length, folded: i >= bets.length, allIn: false,
    currentBet: bets[i] || 0, totalBet: bets[i] || 0, stack: 20000,
    holeCards: [{ rank: 'J', suit: '♠' }, { rank: '9', suit: '♠' }],
  }));
  return room;
}

test('spectators and seated players always have positions and correct own seat', () => {
  const seats = Array.from({length:8}, (_, seatId) => ({seatId}));
  const spectator = rotateSeatView(seats, -1);
  assert.ok(spectator.every(seat => seat.position.top && !seat.isMe));
  assert.equal(rotateSeatView(seats, 3)[0].isMe, true);
});

test('joining twice is idempotent and never mutates an active hand', () => {
  const room = roomWith();
  const before = JSON.stringify(room.state.seats);
  const socket: any = { id:'one', emit(){} };
  room.onUserConnect(socket, 'Hero');
  room.onUserConnect(socket, 'Hero');
  assert.equal(JSON.stringify(room.state.seats), before);
  assert.equal(room.pendingJoinQueue.length, 1);
  assert.equal(room.createSafeSnapshot('one').handInProgress, true);
  room.processSeatSwaps();
  assert.equal(room.state.seats.filter((s:any) => s.socketId === 'one').length, 1);
});

test('disconnect removes a waiting player and three duplicate names stay unique', () => {
  const room = roomWith();
  for (const id of ['a','b','c']) room.onUserConnect({id,emit(){}}, 'Hero');
  assert.deepEqual([...room.users.values()].map((u:any)=>u.name), ['Hero','Hero#2','Hero#3']);
  room.onUserDisconnect('b');
  room.processSeatSwaps();
  assert.equal(room.state.seats.filter((s:any)=>s.socketId==='b').length,0);
});

test('server computes calls and rejects illegal checks and raises', () => {
  const room=roomWith();
  assert.deepEqual(room.mapUserAction({action:'call',amount:-999}),{action:'call',amount:200});
  assert.equal(room.mapUserAction({action:'check',amount:0}),null);
  for(const amount of [0,-1,NaN,Infinity,500,30000,600.5])
    assert.equal(room.mapUserAction({action:'raise',amount}),null);
  assert.deepEqual(room.mapUserAction({action:'raise',amount:600}),{action:'raise',amount:600});
  assert.throws(()=>room.applyAction(0,{action:'raise',amount:0}));
  assert.equal(room.state.seats[0].stack,20000);
});

test('all-in raise uses total target including chips already committed', () => {
  const room=roomWith();
  room.state.seats[0].stack=1000;
  assert.deepEqual(room.mapUserAction({action:'raise',amount:1200}),{action:'allin',amount:1000});
  assert.deepEqual(room.mapUserAction({action:'raise',amount:1000}),{action:'raise',amount:1000});
});

test('invalid user action does not resolve or cancel their pending turn', () => {
  const room=roomWith();
  room.onUserConnect({id:'a',emit(){}}, 'A');
  room.users.get('a').seatId=0;
  let resolved=0;
  room.pendingActionResolve=()=>resolved++;
  room.onUserAction('a',{action:'raise',amount:0});
  assert.equal(resolved,0);
  assert.ok(room.pendingActionResolve);
  room.onUserAction('a',{action:'call',amount:0});
  assert.equal(resolved,1);
});

test('folded contributions are split across all main and side-pot layers', () => {
  const room=roomWith([5000,20000,20000,20000]);
  room.state.seats[3].folded=true;room.state.seats[3].inHand=false;
  const pots=room.calculateSidePots(room.state.seats.filter((s:any)=>s.inHand));
  assert.deepEqual(pots.map((p:any)=>p.amount),[20000,45000]);
  assert.deepEqual(pots[1].eligibleSeatIds,[1,2]);
});

test('multiple all-in levels conserve chips including a folded intermediate bet', () => {
  const room=roomWith([5000,10000,15000,12000]);
  room.state.seats[3].folded=true;room.state.seats[3].inHand=false;
  const pots=room.calculateSidePots(room.state.seats.filter((s:any)=>s.inHand));
  assert.deepEqual(pots.map((p:any)=>p.amount),[20000,15000,7000]);
  assert.equal(pots.reduce((s:number,p:any)=>s+p.amount,0),42000);
});

test('actual finishHand distributes each pot correctly and clears commitments', async () => {
  const room=roomWith([5000,20000,20000,20000]);
  const ranks=['A','K','Q','J'];
  room.state.seats.forEach((s:any,i:number)=>{
    s.stack=20000-s.totalBet;
    s.holeCards=[{rank:ranks[i]||'6',suit:'♠'},{rank:ranks[i]||'6',suit:'♥'}];
  });
  room.state.seats[3].folded=true;room.state.seats[3].inHand=false;
  room.state.board=['2','3','4','8','9'].map((rank,i)=>({rank,suit:i%2?'♣':'♦'}));
  await room.finishHand(true);
  assert.equal(room.state.seats[0].stack,35000);
  assert.equal(room.state.seats[1].stack,45000);
  assert.equal(room.state.seats[2].stack,0);
  assert.equal(room.state.seats.reduce((n:number,s:any)=>n+s.stack,0),160000);
  assert.ok(room.state.seats.every((s:any)=>s.totalBet===0 && s.currentBet===0));
});

test('blind defence covers a 2BB open at 50% override probability', async () => {
  const room=roomWith([0,0,200,400]);
  room.state.buttonSeat=0;room.state.activeSeatId=2;room.state.raiseLevel=1;
  room.trainer.decideActionForLive=()=>({action:0,amount:0});
  const random=Math.random;
  try {
    Math.random=()=>0.25;
    assert.equal((await room.getDecision(room.state.seats[2],200,600,20200,false)).action,'call');
    Math.random=()=>0.75;
    assert.equal((await room.getDecision(room.state.seats[2],200,600,20200,false)).action,'fold');
    room.state.raiseLevel=2;
    Math.random=()=>0.25;
    assert.equal((await room.getDecision(room.state.seats[2],200,600,20200,false)).action,'fold');
  } finally {Math.random=random;}
});
