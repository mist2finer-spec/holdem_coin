import assert from 'node:assert/strict';
import {HybridHoldemRoom} from '../../mini-services/poker-server/index';
let seed=83021;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const room:any=new HybridHoldemRoom(false,8);
const inspect=()=>{
 const st=room.state;assert.equal(st.seats.length,8);
 for(const s of st.seats)for(const k of ['stack','currentBet','totalBet'])assert.ok(Number.isSafeInteger(s[k])&&s[k]>=0,`${k} invalid at seat ${s.seatId}`);
 assert.ok(Number.isFinite(st.pot)&&st.pot>=0,'invalid pot');
 const live=st.seats.filter((s:any)=>s.inHand&&!s.folded);
 const highest=Math.max(0,...live.map((s:any)=>s.currentBet));
 const pot=st.pot+st.seats.reduce((n:number,s:any)=>n+s.currentBet,0);
 for(const s of live){const call=Math.min(s.stack,Math.max(0,highest-s.currentBet));const odds=call/Math.max(1,pot+call);assert.ok(Number.isFinite(odds)&&odds>=0&&odds<=1,'invalid pot odds');}
};
let lastProgress='';
room.broadcastTableState=()=>{
 inspect();
 const h=room.currentHistory,step=h?.actions.length??0,key=`${h?.id}:${step}`;
 if(step>0&&key!==lastProgress){lastProgress=key;process.stdout.write(`HAND_PROGRESS ${room.state.handNumber} ${step}\n`);}
};
let joined=false;
room.sleep=async()=>{
 inspect();
 if(!joined&&room.state.phase==='PREFLOP'){
  joined=true;const before=JSON.stringify(room.state.seats);
  const socket={id:'validation-race',emit(){}};
  room.onUserConnect(socket,'Validation');room.onUserConnect(socket,'Validation');
  assert.equal(JSON.stringify(room.state.seats),before,'join mutated running hand');
  room.onUserDisconnect(socket.id);assert.equal(room.pendingJoinQueue.length,0);
  assert.equal(JSON.stringify(room.state.seats),before,'disconnect mutated running seats');
 }
 await new Promise<void>(r=>setImmediate(r));
};
(async()=>{
 for(let hand=1;hand<=20;hand++){
  process.stdout.write(`HAND_START ${hand}\n`);joined=false;
  await room.playOneHand();inspect();assert.equal(room.state.handNumber,hand);
  assert.ok(['HAND_END','SHOWDOWN'].includes(room.state.phase),'hand did not finish');
 }
 assert.equal(room.history.count,20);process.stdout.write('SIMULATION_PASSED\n');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
