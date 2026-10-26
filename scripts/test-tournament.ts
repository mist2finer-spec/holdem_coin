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
 r.state.seats[0].stack=0;r.tournament.settle(r.state.seats);r.state.seats[1].stack=12345;
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
