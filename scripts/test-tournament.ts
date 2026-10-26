import test from 'node:test';
import assert from 'node:assert/strict';
import {TournamentLifecycle} from '../mini-services/poker-server/tournament';
import {HybridHoldemRoom} from '../mini-services/poker-server/index';
import {publicHandHistory} from '../src/lib/poker-hand-history';
const socket=(id:string)=>({id,events:[] as {event:string;data:any}[],emit(event:string,data:any){this.events.push({event,data});}});
const room=()=>{const r:any=new HybridHoldemRoom(false,8,'tournament');r.sleep=async()=>{};return r;};
test('8 players start 100BB, blinds double at five-minute boundaries and stay fixed inside a hand',()=>{
 const r=room();assert.equal(r.state.seats.length,8);assert.ok(r.state.seats.every((s:any)=>s.stack===20000));
 const t=r.tournament as TournamentLifecycle;t.beginHand(1000);assert.equal(t.bigBlind,200);assert.equal(t.smallBlind,100);
 assert.equal(t.snapshot().nextLevelAt,301000);t.beginHand(300999);assert.equal(t.bigBlind,200);t.beginHand(301000);assert.equal(t.bigBlind,400);t.beginHand(601000);assert.equal(t.bigBlind,800);
 assert.equal(r.state.seats.reduce((n:number,s:any)=>n+s.stack,0),160000);
});
test('elimination removes entrants permanently, rejects rebuys and only the survivor wins',()=>{
 const r=room();r.state.seats[0].stack=160000;for(const s of r.state.seats.slice(1))s.stack=0;
 r.tournament.settle(r.state.seats);assert.equal(r.tournament.eliminated.size,7);assert.equal(r.tournament.snapshot().remaining,1);
 assert.deepEqual(r.tournament.winner,{seatId:0,name:r.state.seats[0].name,portrait:r.state.seats[0].persona.portrait??4});
 r.onUserRebuy('none');r.processSeatSwaps();assert.ok(r.state.seats.slice(1).every((s:any)=>s.stack===0));
 const snapshot=r.createSafeSnapshot(null);assert.equal(snapshot.seats.filter((s:any)=>s.eliminated).length,7);assert.equal(snapshot.tournament.status,'finished');
});
test('test names can take a surviving CPU seat, never an eliminated seat or fresh chips',()=>{
 const r=room();r.startGameLoop=async()=>{};
 r.tournament.beginHand(1000);r.state.seats[0].stack=0;r.tournament.settle(r.state.seats);r.state.seats[1].stack=12345;
 const a=socket('alice');r.onUserConnect(a,'Alice');r.processSeatSwaps();assert.equal(r.state.seats[0].isBot,true);assert.equal(r.state.seats[1].name,'Alice');assert.equal(r.state.seats[1].stack,12345);
 r.onUserRebuy('alice');r.processSeatSwaps();assert.equal(r.state.seats[1].stack,12345);
 r.onUserDisconnect('alice');const b=socket('return');r.onUserConnect(b,'Alice');assert.equal(r.users.get('return').seatId,1);assert.equal(r.state.seats[1].stack,12345);
 r.state.seats[1].stack=0;r.tournament.settle(r.state.seats);r.onUserDisconnect('return');
 const denied=socket('denied');r.onUserConnect(denied,'Ａｌｉｃｅ');assert.ok(denied.events.some(e=>e.event==='ROOM_DENIED'));
 const next=socket('next');r.onUserConnect(next,'Alice2');r.processSeatSwaps();assert.equal(r.users.get('next').seatId,2);assert.equal(r.state.seats[1].stack,0);
});
test('joining during a live hand only queues a takeover and never overwrites action state',()=>{
 const r=room();r.isRunning=true;r.state.activeSeatId=3;r.state.phase='FLOP';r.state.seats[0].currentBet=500;
 const before=JSON.stringify(r.state.seats);r.onUserConnect(socket('queue'),'Queue');assert.equal(JSON.stringify(r.state.seats),before);assert.equal(r.pendingJoinQueue.length,1);
});
test('complete tournaments retain 160000 chips, charge no rake, do not refill or revive eliminated bots',async(t)=>{
 let clock=1000;t.mock.method(Date,'now',()=>clock);const r=room();
 let n=0;for(;n<32&&!r.tournament.finished;n++){
  const dead=new Set<number>(r.tournament.eliminated);clock+=300000;await r.playOneHand();
  const h=r.history.all().at(-1);assert.equal(h.status,'completed');assert.equal(h.rake,0);assert.equal(h.gameMode,'tournament');assert.equal(publicHandHistory(h).gameMode,'tournament');
  assert.equal(r.state.seats.reduce((sum:number,s:any)=>sum+s.stack,0),160000);
  assert.ok(r.state.seats.every((s:any)=>s.stack>=0));for(const id of dead)assert.equal(r.state.seats[id].stack,0);
 }
 assert.ok(r.tournament.finished,`did not finish in ${n} hands`);assert.equal(r.state.seats.filter((s:any)=>s.stack>0).length,1);assert.equal(r.tournament.eliminated.size,7);
 const hands=r.state.handNumber;await r.playOneHand();assert.equal(r.state.handNumber,hands);
});

test('a short posted BB uses the actual public price; partial blinds never create phantom calls',()=>{
 const r=room();r.tournament.level=8; // nominal SB25600 / BB51200
 for(const s of r.state.seats)Object.assign(s,{inHand:false,folded:true,currentBet:0,totalBet:0});
 Object.assign(r.state.seats[2],{inHand:true,folded:false,currentBet:25600,totalBet:25600,stack:7100});
 Object.assign(r.state.seats[3],{inHand:true,folded:false,currentBet:16110,totalBet:16110,stack:0,allIn:true});
 Object.assign(r.state.seats[6],{inHand:true,folded:false,currentBet:0,totalBet:0,stack:36800});r.state.activeSeatId=6;r.state.phase='PREFLOP';r.state.lastRaiseSize=51200;
 const call=r.mapUserAction({action:'call',amount:51200});assert.equal(call.action,'call');assert.equal(call.amount,25600);
 const allin=r.mapUserAction({action:'allin',amount:36800});assert.equal(allin.action,'allin');assert.equal(allin.amount,36800);
});
test('a disconnected tournament entrant checks for free and folds only when facing a price',async()=>{
 const r=room(),actor={...r.state.seats[0],isBot:false,socketId:'offline'};
 assert.equal((await r.getDecision(actor,0,200,20000,true)).action,'check');
 assert.equal((await r.getDecision(actor,200,400,20000,true)).action,'fold');
});

test('entry countdown is single, cancellable and does not start the blind clock',()=>{
 const t=new TournamentLifecycle();assert.equal(t.snapshot().status,'waiting');t.requestStart(1000);t.requestStart(4000);
 assert.equal(t.snapshot().status,'countdown');assert.equal(t.startsAt,11000);assert.equal(t.startedAt,null);assert.equal(t.snapshot().nextLevelAt,null);
 t.cancelStart();assert.equal(t.snapshot().status,'waiting');t.requestStart(20000);t.beginHand(30000);
 assert.equal(t.snapshot().status,'running');assert.equal(t.startedAt,30000);assert.equal(t.snapshot().nextLevelAt,330000);
});
test('champion locks entry for exactly ten minutes; later settlement cannot extend it',t=>{
 let now=10000;t.mock.method(Date,'now',()=>now);const life=new TournamentLifecycle();const seats=Array.from({length:8},(_,seatId)=>({seatId,name:`P${seatId}`,stack:seatId===0?160000:0}));
 life.settle(seats);assert.equal(life.nextTournamentAt,610000);now+=1000;life.settle(seats);assert.equal(life.nextTournamentAt,610000);
 assert.equal(life.readyForNext(609999),false);assert.equal(life.readyForNext(610000),true);
 const r=room();r.tournament.settle(seats);const s=socket('cooldown');r.onUserConnect(s,'NewPlayer');assert.ok(s.events.some(e=>e.event==='ROOM_DENIED'));assert.equal(r.userCount,0);
});
test('room countdown prevents dealing before ten seconds and starts only one loop',async t=>{
 let now=1000;t.mock.method(Date,'now',()=>now);const r:any=new HybridHoldemRoom(false,8,'tournament');let resume!:()=>void,wait=0,hands=0;
 r.sleep=(ms:number)=>{wait=ms;return new Promise<void>(resolve=>{resume=resolve;});};
 r.playOneHand=async()=>{hands++;r.tournament.beginHand(Date.now());r.isRunning=false;};
 r.onUserConnect(socket('one'),'One');r.onUserConnect(socket('two'),'Two');assert.equal(wait,10000);assert.equal(hands,0);assert.equal(r.tournament.startsAt,11000);assert.equal(r.tournament.startedAt,null);
 now=11000;resume();await new Promise(resolve=>setImmediate(resolve));assert.equal(hands,1);assert.equal(r.tournament.startedAt,11000);
});
test('empty countdown cancels without dealing or banning departed entrants',async()=>{
 const r:any=new HybridHoldemRoom(false,8,'tournament');let resume!:()=>void;
 r.sleep=()=>new Promise<void>(resolve=>{resume=resolve;});r.onUserConnect(socket('leave'),'Leave');r.onUserDisconnect('leave');resume();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(r.state.handNumber,0);assert.equal(r.isRunning,false);assert.equal(r.tournament.snapshot().status,'waiting');assert.equal(r.tournament.bannedNames.size,0);assert.ok(r.state.seats.every((s:any)=>s.isBot));
});

import {tournamentMoney} from '../src/lib/poker-tournament';
test('BB amounts round to one decimal and do not modify chip accounting',()=>{assert.equal(tournamentMoney(246,200),'1.2 BB');assert.equal(tournamentMoney(250,200),'1.3 BB');assert.equal(tournamentMoney(20000,200),'100 BB');assert.equal(tournamentMoney(1,200),'0 BB');});

import {tournamentShortStack} from '../src/lib/poker-tournament-shortstack';
import type {Card} from '../src/lib/poker-engine';
const hole=(ranks:string):Card[]=>[{rank:ranks[0] as Card['rank'],suit:'♠'},{rank:ranks[1] as Card['rank'],suit:'♥'}];
function shortSpot(bbStack=3,players=2,ranks='72',bb=200){
 const seats=Array.from({length:8},(_,seatId)=>({seatId,stack:seatId===0?Math.round(bbStack*bb):seatId<players?bb*20:0,currentBet:seatId===1?bb:0,totalBet:seatId===1?bb:0,inHand:seatId<players,folded:seatId>=players,allIn:false}));
 return {actor:{...seats[0],holeCards:hole(ranks)},seats,board:[] as Card[],bigBlind:bb,minRaise:bb*2,maxRaise:bbStack*bb,raiseLevel:0};
}
test('3BB heads-up open jams even the weakest hand, independently of character traits',()=>{
 const s=shortSpot();assert.equal(tournamentShortStack(s)!.action.action,'allin');
 const a={...s.actor,persona:{vpip:.01,aggression:0}},b={...s.actor,persona:{vpip:1,aggression:1}};
 assert.deepEqual(tournamentShortStack({...s,actor:a}),tournamentShortStack({...s,actor:b}));
});
test('3/5/10BB policies widen short-handed opens, use chip-exact sizes, and stop above 10BB',()=>{
 for(const players of [2,3,4])for(const chips of [3,5,10]){
  const s=shortSpot(chips,players,'A7'),d=tournamentShortStack(s)!;
  assert.equal(d.audit.band,chips);assert.equal(d.action.action,chips<=5?'allin':'raise');
  assert.equal(d.action.amount,chips<=5?chips*200:500);
 }
 assert.equal(tournamentShortStack(shortSpot(10.01,2,'AA')),null);
});
test('no short CPU folds a free option or a sub-0.1BB preflop call at escalating blinds',()=>{
 const free=shortSpot(10,4,'72');free.seats[1].currentBet=0;free.seats[1].totalBet=0;free.raiseLevel=1;
 assert.equal(tournamentShortStack(free)!.action.action,'check');
 for(const bb of [200,51200,819200]){
  const s=shortSpot(3,2,'72',bb);s.raiseLevel=2;s.actor.currentBet=bb-1;s.actor.totalBet=bb-1;Object.assign(s.seats[0],s.actor);
  const d=tournamentShortStack(s)!;assert.equal(d.action.action,'call');assert.equal(d.action.amount,1);
 }
});
test('closed short-all-in raising rights and all-in opponents allow calls, never illegal raises',()=>{
 const s=shortSpot(3,2,'AA');s.raiseLevel=2;s.maxRaise=200;
 let d=tournamentShortStack(s)!;assert.equal(d.action.action,'call');
 s.seats[1].stack=0;s.seats[1].allIn=true;s.maxRaise=600;d=tournamentShortStack(s)!;assert.equal(d.action.action,'call');
 s.actor.stack=100;Object.assign(s.seats[0],s.actor);assert.deepEqual(tournamentShortStack(s)!.action,{action:'allin',amount:100});
});
test('short-stack calls price only their eligible pot, not deep opponents unmatched side pots',()=>{
 const s=shortSpot(3,3,'72');s.raiseLevel=2;
 Object.assign(s.seats[1],{currentBet:100000,totalBet:100000,stack:0,allIn:true});
 Object.assign(s.seats[2],{currentBet:100000,totalBet:100000,stack:0,allIn:true});
 const d=tournamentShortStack(s)!;assert.equal(d.audit.eligiblePot,1800);assert.equal(d.audit.requiredEquity,1/3);assert.equal(d.action.action,'fold');
});
test('postflop cheap call rescue never replaces a value raise or calls a dead river hand',()=>{
 const s=shortSpot(5,2,'AA');s.board=[{rank:'A',suit:'♦'},{rank:'K',suit:'♦'},{rank:'Q',suit:'♣'},{rank:'J',suit:'♣'},{rank:'2',suit:'♣'}];s.raiseLevel=1;
 s.seats[1].currentBet=20;s.seats[1].totalBet=1000;s.actor.totalBet=500;Object.assign(s.seats[0],s.actor);
 assert.equal(tournamentShortStack(s),null);assert.equal(tournamentShortStack(s,{action:'raise',amount:200}),null);
 assert.equal(tournamentShortStack(s,{action:'fold',amount:0})!.action.action,'call');
 s.actor.holeCards=[{rank:'3',suit:'♥'},{rank:'2',suit:'♦'}];
 s.board=[{rank:'A',suit:'♠'},{rank:'K',suit:'♠'},{rank:'Q',suit:'♠'},{rank:'J',suit:'♠'},{rank:'2',suit:'♣'}];
 assert.equal(tournamentShortStack(s,{action:'fold',amount:0}),null);
});
test('room routes tournament short stacks through the native chip policy and records the audit',async()=>{
 const r=room();for(const seat of r.state.seats)Object.assign(seat,{stack:0,currentBet:0,totalBet:0,inHand:false,folded:true,allIn:false});
 Object.assign(r.state.seats[0],{stack:600,inHand:true,folded:false,holeCards:hole('72')});
 Object.assign(r.state.seats[1],{stack:4000,currentBet:200,totalBet:200,inHand:true,folded:false});r.state.phase='PREFLOP';r.state.board=[];r.state.raiseLevel=0;
 const d=await r.getDecision(r.state.seats[0],200,400,600,false);assert.equal(d.action,'allin');assert.equal(d.amount,600);assert.equal(r.pendingAudit.tournamentShortStack.band,3);
});
