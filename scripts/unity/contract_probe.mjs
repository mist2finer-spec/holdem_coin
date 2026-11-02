/** Headless real-server Engine.IO polling probe, matching PollingSocket wire frames. */
import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'island-unity-probe-'));
const port=43103,base=`http://127.0.0.1:${port}`;
const processServer=spawn(process.execPath,['--import','./mini-services/poker-server/node_modules/tsx/dist/loader.mjs','mini-services/poker-server/index.ts'],{cwd:process.cwd(),env:{...process.env,POKER_PORT:String(port),POKER_TEST_MODE:'0',RPG_SAVE_DIR:path.join(scratch,'rpg'),HAND_HISTORY_DIR:path.join(scratch,'hands')},stdio:['ignore','ignore','pipe']});
let stderr='';processServer.stderr.on('data',c=>stderr=(stderr+c).slice(-2000));
const clients=[];
async function client(){
 const response=await fetch(base+'/socket.io/?EIO=4&transport=polling');const opened=await response.text();assert.equal(opened[0],'0');const sid=JSON.parse(opened.slice(1)).sid,url=base+'/socket.io/?EIO=4&transport=polling&sid='+sid;
 const send=async p=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:p});assert.ok(r.ok);};
 const read=async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(5000)});assert.ok(r.ok);const packets=(await r.text()).split('\x1e');for(const p of packets)if(p==='2')await send('3');return packets;};
 await send('40');assert.ok((await read()).some(p=>p.startsWith('40')));await send('421["LOBBY_HELLO",{}]');let ack=(await read()).find(p=>p.startsWith('431'));assert.ok(ack);assert.ok(JSON.parse(ack.slice(3))[0].token);
 const c={send,read};clients.push(c);return c;
}
try{
 let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/health')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,stderr);
 const one=await client();await one.send('42["JOIN_ROOM",{"name":"Unity","tableSize":6}]');const packets=await one.read();const table=packets.filter(p=>p.startsWith('42[')).map(p=>JSON.parse(p.slice(2))).find(p=>p[0]==='TABLE_STATE')?.[1];assert.equal(table.seats.length,6);
 for(const s of table.seats)if(!s.isMe)assert.ok(s.holeCards.length===0||s.holeCards.every(c=>c==='??'));
 const two=await client();await two.send('42["JOIN_ROOM",{"name":"Other","tableSize":8}]');const denied=await two.read();assert.ok(denied.some(p=>p.includes('SYSTEM_NOTICE')&&p.includes('Under Repair')));assert.ok(!denied.some(p=>p.includes('TABLE_STATE')));
 console.log('UNITY_POLLING_PROBE_PASSED handshake, ack, 6-seat multiplayer, private cards, disabled 8-seat cash restriction');
}finally{for(const c of clients)try{await c.send('1');}catch{}processServer.kill('SIGTERM');await new Promise(resolve=>{if(processServer.exitCode!==null)resolve();else processServer.once('exit',resolve);});fs.rmSync(scratch,{recursive:true,force:true});}
