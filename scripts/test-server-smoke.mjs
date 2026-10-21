// Real startup script + HTTP health + Socket.IO clients. No mocked game loop.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const service = path.resolve(__dirname,'../mini-services/poker-server');
const {io} = createRequire(path.join(service,'package.json'))('socket.io-client');
const port = 13003;
const origin = `http://127.0.0.1:${port}`;
const hosted = process.env.POKER_SMOKE_HOSTED === '1';
const historyToken=randomBytes(32).toString('hex');
const historyDir=mkdtempSync(path.join(tmpdir(),'holdem-smoke-history-'));
const historyEnv={HAND_HISTORY_ADMIN_TOKEN:historyToken,HAND_HISTORY_DIR:historyDir};
const server = hosted
 ? spawn(process.execPath,['scripts/start-hosted.mjs'],{
   cwd:path.resolve(service,'../..'),
   env:{...process.env,...historyEnv,PORT:String(port),HOLDEM_WEB_PORT:'13000',POKER_PORT:'13004'},
   stdio:['ignore','pipe','pipe'],
 })
 : spawn('bash',['./start.sh'],{cwd:service,env:{...process.env,...historyEnv,POKER_PORT:String(port),POKER_TEST_MODE:'0'},stdio:['ignore','pipe','pipe']});
let logs=''; server.stdout.on('data',s=>logs+=s);server.stderr.on('data',s=>logs+=s);
const delay = ms => new Promise(r=>setTimeout(r,ms));
const clients=[];
(async()=>{
 try {
  let health;
  for(let i=0;i<50;i++) {
   try {health=await fetch(origin+(hosted?'/healthz':'/health?XTransformPort='+port),{signal:AbortSignal.timeout(500)});if(health.ok)break;}catch{}
   await delay(100);
  }
  assert.ok(health?.ok,'health must succeed');
  if(hosted) {
   const html=await (await fetch(origin)).text();
   assert.match(html,/Island/,'web page must be served on the same origin');
   const asset=html.match(/src="([^"]+\.js[^"]*)"/);
   assert.ok(asset,'compiled JavaScript asset must exist');
   assert.equal((await fetch(new URL(asset[1],origin))).status,200);
  }
  const stats=[0,1,2].map(()=>({states:0,hands:new Set(),ownSeats:new Set(),actions:0,errors:[],seated:false}));
  for(let i=0;i<3;i++) {
   const client=io(origin,{transports:['polling'],reconnection:false,timeout:3000});clients.push(client);
   const sent=new Set();
   client.on('connect',()=>{client.emit('JOIN_ROOM',{name:'Smoke',tableSize:i===2?6:8});client.emit('JOIN_ROOM',{name:'Smoke',tableSize:i===2?6:8});});
   client.on('connect_error',e=>stats[i].errors.push(e.message));
   client.on('TABLE_STATE',st=>{
    const r=stats[i];if(st.seats.length!==(i===2?6:8))r.errors.push('wrong room size');r.states++;r.hands.add(st.handNumber);
    if(st.mySeatId>=0){r.seated=true;r.ownSeats.add(st.mySeatId);}
    if(st.phase!=='SHOWDOWN') {
     for(const seat of st.seats) {
      const successfulReveal=st.phase==='HAND_END' && st.winnerInfo &&
       st.bluffReveal===seat.seatId && seat.isBot && !seat.folded &&
       st.seats.filter(s=>s.inHand && !s.folded).length===1;
      if(!seat.isMe && !successfulReveal && seat.holeCards.some(c=>c!=='??')) r.errors.push('opponent cards leaked');
     }
    }
    if(st.isUserTurn){const key=st.handNumber+':'+st.phase+':'+st.totalPot+':'+st.callAmount;
     if(!sent.has(key)){sent.add(key);r.actions++;client.emit('PLAYER_ACTION',{action:st.callAmount?'call':'check',amount:st.callAmount});}}
   });
  }
  const deadline=Date.now()+120000;
  while(Date.now()<deadline && !stats.every(s=>s.seated && s.actions>0 && s.hands.size>=3)) {
   assert.equal(server.exitCode,null,'server exited early: '+logs);
   await delay(250);
  }
  for(const s of stats){assert.ok(s.seated);assert.ok(s.actions>0);assert.ok(s.hands.size>=3);assert.equal(s.ownSeats.size,1);assert.deepEqual(s.errors,[]);}
  const finalHealth=await (await fetch(origin+'/health?XTransformPort='+port)).json();
  assert.equal(finalHealth.users,3);
  const exportResult=await clients[0].timeout(5000).emitWithAck('GET_HAND_HISTORY');
  assert.ok(exportResult.hands.length>0,'public archive exists');
  assert.ok(!JSON.stringify(exportResult).includes('privateAudit'));
  assert.ok(!JSON.stringify(exportResult).includes('privatePlayerId'));
  assert.equal((await fetch(origin+'/api/hand-history/admin')).status,401);
  const analysis=await fetch(origin+'/api/hand-history/admin',{headers:{Authorization:'Bearer '+historyToken}});
  assert.equal(analysis.status,200);const full=await analysis.json();
  assert.ok(full.hands.some(h=>h.humans===1&&h.cpus===5),'six-seat mixed participants counted');
  assert.ok(full.hands.some(h=>h.humans===2&&h.cpus===6),'actual mixed participants counted');
  assert.ok(full.hands.some(h=>h.actions.some(a=>a.isBot&&a.privateAudit?.decisionPath)),'CPU decision audit exists');
  assert.ok(full.hands.every(h=>h.actions.every(a=>a.paid===a.stackBefore-a.stackAfter)));
  console.log(JSON.stringify({historyHands:full.hands.length,health:finalHealth,clients:stats.map(s=>({...s,hands:[...s.hands],ownSeats:[...s.ownSeats]}))}));
 } finally {clients.forEach(c=>c.disconnect());server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));rmSync(historyDir,{recursive:true,force:true});}
})().catch(e=>{console.error(e,logs);process.exitCode=1;});
