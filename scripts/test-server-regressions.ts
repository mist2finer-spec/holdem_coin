import { LIVE_RULES, handPositions, postBlind, normalizeLiveAction, applyLiveAction, decideLiveBot } from "../src/lib/poker-live.ts";
import { bluffFrequency, successfulBluff } from "../src/lib/poker-bluff.ts";
import { SelfPlayTrainer } from "../src/lib/self-play-trainer.ts";
import { contributionLayers } from "../src/lib/poker-rules.ts";
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

test('real server retains check history through a raise and clears it on the next street', async () => {
  const room = roomWith([0, 0]);
  const checked: boolean[] = [];
  const actions = [
    {action:'check',amount:0}, {action:'raise',amount:200},
    {action:'raise',amount:600}, {action:'call',amount:400},
    {action:'check',amount:0}, {action:'check',amount:0},
  ];
  room.getDecision = async (_actor:any, _call:number, _min:number, _max:number, _user:boolean, wasChecked:boolean) => {
    checked.push(wasChecked);
    assert.ok(actions.length, 'betting loop must terminate');
    return actions.shift();
  };
  await room.runBettingRound(0, 0, []);
  await room.runBettingRound(0, 0, []);
  assert.deepEqual(checked, [false, false, true, false, false, false]);
});

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
  const pots=contributionLayers(room.state.seats);
  assert.deepEqual(pots.map((p:any)=>p.amount),[20000,45000]);
  assert.deepEqual(pots[1].eligibleSeatIds,[1,2]);
});

test('multiple all-in levels conserve chips including a folded intermediate bet', () => {
  const room=roomWith([5000,10000,15000,12000]);
  room.state.seats[3].folded=true;room.state.seats[3].inHand=false;
  const pots=contributionLayers(room.state.seats);
  assert.deepEqual(pots.map((p:any)=>p.amount),[20000,15000,4000,3000]);
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
  assert.equal(room.state.seats[0].stack,34000);
  assert.equal(room.state.seats[1].stack,42750);
  assert.equal(room.state.seats[2].stack,0);
  assert.equal(room.state.seats.reduce((n:number,s:any)=>n+s.stack,0),156750);
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


test('aggressive weak-hand decisions bluff 20% with legal standard raises', () => {
  assert.equal(bluffFrequency({aggression:0.8,bluffFreq:0.05}),0.20);
  assert.equal(bluffFrequency({aggression:0.8,bluffFreq:0.35}),0.35);
  assert.equal(bluffFrequency({aggression:0.3,bluffFreq:0.05}),0.05);
  const trainer = new SelfPlayTrainer();
  const random = Math.random;
  let bluffs=0;
  try {
    for(let i=0;i<100;i++) {
      Math.random=()=>(i+0.5)/100;
      const d=trainer.decideActionForLive(
        [{rank:'7',suit:'♠'},{rank:'2',suit:'♥'}],[],0,200,20000,300,20000,0,1,0,8,0,0,
        {vpip:0.5,aggression:0.8,bluffFreq:0.05});
      if(d.isBluff) {bluffs++;assert.equal(d.action,2);assert.ok(d.amount>=200 && d.amount<20000);}
    }
    assert.equal(bluffs,20);
  } finally {Math.random=random;}
});

test('bluff success excludes showdowns, called hands, stale value raises and folded bluffers', () => {
  const survivor=[{seatId:0,inHand:true,folded:false},{seatId:1,inHand:false,folded:true}];
  assert.equal(successfulBluff(survivor,{seatId:0,isBluff:true},false),0);
  assert.equal(successfulBluff(survivor,{seatId:0,isBluff:true},true),null);
  assert.equal(successfulBluff(survivor,{seatId:0,isBluff:false},false),null);
  assert.equal(successfulBluff(survivor,{seatId:1,isBluff:true},false),null);
  assert.equal(successfulBluff(survivor,null,false),null);
  assert.equal(successfulBluff(survivor.map(s=>({...s,inHand:true,folded:false})),{seatId:0,isBluff:true},false),null);
});

test('real server tracks normalized bluff raise and reveals only winner until result expires', async () => {
  const room=roomWith([0,0]);
  const notices:any[]=[];
  room.broadcast=(event:string,data:any)=>{if(event==='SYSTEM_NOTICE')notices.push(data);};
  room.getDecision=async (actor:any)=>actor.seatId===0
    ? {action:'raise',amount:400,isBluff:true} : {action:'fold',amount:0};
  await room.runBettingRound(0,0,[]);
  assert.deepEqual(room.state.lastAggression,{seatId:0,isBluff:true});
  assert.deepEqual(room.createSafeSnapshot(null).seats[0].holeCards,['??','??']);
  let captured:any;
  room.sleep=async (ms:number)=>{if(ms===5000)captured=room.createSafeSnapshot(null);};
  await room.finishHand(false);
  assert.equal(captured.bluffReveal,0);
  assert.deepEqual(captured.seats[0].holeCards,['J♠','9♠']);
  assert.deepEqual(captured.seats[1].holeCards,['??','??']);
  assert.equal(notices.filter(n=>n.messages.some((m:string)=>m.includes("배짱"))).length,1);
  assert.ok(notices[0].messages[0].includes('배짱'));
  assert.equal(room.state.bluffReveal,null);
  assert.equal(room.state.lastAggression,null);
  assert.deepEqual(room.createSafeSnapshot(null).seats[0].holeCards,['??','??']);
});

test('real server replaces old bluff marker when another player makes a value raise', async () => {
  const room=roomWith([0,0]);
  room.state.lastAggression={seatId:1,isBluff:true};
  room.getDecision=async (actor:any)=>actor.seatId===0
    ? {action:'raise',amount:400,isBluff:false} : {action:'fold',amount:0};
  await room.runBettingRound(0,0,[]);
  assert.deepEqual(room.state.lastAggression,{seatId:0,isBluff:false});
  let captured:any;
  room.sleep=async ()=>{captured=room.createSafeSnapshot(null);};
  await room.finishHand(false);
  assert.equal(captured.bluffReveal,null);
  assert.deepEqual(captured.seats[0].holeCards,['??','??']);
});


test('shared blind posting marks an exact-stack big blind all-in and skips busted seats', () => {
  const room=roomWith([0,0,0,0]);
  room.state.seats[2].inHand=false;
  const positions=handPositions(room.state.seats,0);
  assert.deepEqual(positions,{button:1,smallBlind:3,bigBlind:0,preflopStart:1,postflopStart:3});
  const short={...room.state.seats[0],stack:200,totalBet:0,currentBet:0};
  const posted=postBlind(short,200);
  assert.equal(posted.stack,0);assert.equal(posted.allIn,true);assert.equal(posted.totalBet,200);
  assert.equal(short.stack,200,'input is unchanged');
  const headsUp=handPositions(room.state.seats.map((s:any)=>({...s,inHand:s.seatId===0||s.seatId===3})),0);
  assert.equal(headsUp.button,3);assert.equal(headsUp.smallBlind,3);assert.equal(headsUp.bigBlind,0);
  assert.equal(headsUp.preflopStart,3);assert.equal(headsUp.postflopStart,0);
});

test('shared action normalization computes calls and conserves contributions', () => {
  const room=roomWith([200,600]);
  const action=normalizeLiveAction(room.state.seats,0,{action:'call',amount:999999},200)!;
  assert.deepEqual(action,{action:'call',amount:400});
  const before=room.state.seats[0];
  const after=applyLiveAction(before,action);
  assert.equal(after.stack+after.totalBet,before.stack+before.totalBet);
  assert.equal(after.currentBet,600);
  assert.equal(normalizeLiveAction(room.state.seats,0,{action:'raise',amount:700},400),null);
});

test('server human bust uses manual next-hand rebuy instead of automatic free chips', async () => {
  const room=roomWith();
  room.users.set('busted',{socketId:'busted',seatId:0,name:'Hero',playerId:'Hero'});
  Object.assign(room.state.seats[0],{isBot:false,socketId:'busted',name:'Hero',stack:100});
  room.runBettingRound=async()=>{};room.advancePhase=async()=>{};
  await room.playOneHand();
  assert.equal(room.state.seats[0].stack,100);
  assert.equal(room.state.seats[0].inHand,false);
  assert.notEqual(room.state.smallBlindSeat,0);assert.notEqual(room.state.bigBlindSeat,0);
  assert.equal(room.createSafeSnapshot('busted').playerBusted,true);
  room.onUserRebuy('busted');room.onUserRebuy('busted');
  assert.equal(room.state.seats[0].stack,100,'rebuy cannot modify a running hand');
  assert.equal(room.createSafeSnapshot('busted').rebuyPending,true);
  await room.playOneHand();
  assert.equal(room.state.seats[0].stack,LIVE_RULES.buyIn);
  assert.equal(room.state.seats[0].inHand,true);
  assert.equal(room.createSafeSnapshot('busted').rebuyPending,false);
  room.onUserRebuy('busted');
  assert.equal(room.pendingRebuys.size,0,'a solvent player cannot add chips');
});

test('new server seats start with the shared 5000-chip buy-in', () => {
  const room:any = new HybridHoldemRoom(false);
  assert.equal(LIVE_RULES.buyIn,5000);
  assert.ok(room.state.seats.every((seat:any)=>seat.stack===5000));
});

test('all-in humans cannot rebuy before settlement', () => {
  const room=roomWith();
  room.users.set('a',{socketId:'a',seatId:0});
  Object.assign(room.state.seats[0],{isBot:false,socketId:'a',stack:0,allIn:true,inHand:true});
  room.onUserRebuy('a');assert.equal(room.pendingRebuys.size,0);
  assert.equal(room.createSafeSnapshot('a').playerBusted,false);
});

test('server decision window is ten seconds and clears its deadline on action', async () => {
  const room=roomWith();
  room.users.set('a',{socketId:'a',seatId:0});
  const before=Date.now();
  const pending=room.waitForUserAction('a');
  const snapshot=room.createSafeSnapshot('a');
  assert.ok(snapshot.actionDeadline>=before+LIVE_RULES.userSeconds*1000);
  assert.ok(snapshot.actionDeadline<=Date.now()+LIVE_RULES.userSeconds*1000);
  assert.equal(snapshot.isUserTurn,true);
  room.onUserAction('a',{action:'call',amount:0});
  assert.deepEqual(await pending,{action:'call',amount:200});
  assert.equal(room.createSafeSnapshot('a').actionDeadline,0);
  assert.equal(room.createSafeSnapshot('a').isUserTurn,false);
});

test('shared live AI retains 50% small-open blind defence for both callers', () => {
  const room=roomWith([200,400,200]);
  const random=Math.random;
  const trainer={decideActionForLive:()=>({action:0,amount:0})} as any;
  const ctx={actor:room.state.seats[2],seats:room.state.seats,board:[],pot:600,minRaise:600,maxRaise:20200,
    button:0,smallBlind:1,bigBlind:2,hand:1,raiseLevel:1};
  try {
    Math.random=()=>0.25;assert.equal(decideLiveBot(trainer,ctx).action,'call');
    Math.random=()=>0.75;assert.equal(decideLiveBot(trainer,ctx).action,'fold');
  } finally {Math.random=random;}
});
