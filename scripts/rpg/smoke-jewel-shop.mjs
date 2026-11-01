// Requires `npm run build`; starts an isolated disposable web+poker pair and removes its own save directory.
import {spawn} from 'node:child_process';import {mkdtempSync,rmSync,openSync,closeSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {io} from '../../mini-services/poker-server/node_modules/socket.io-client/build/esm-debug/index.js';
const dir=mkdtempSync(path.join(tmpdir(),'poe-shop-http-')),env={...process.env,RPG_SAVE_DIR:dir,HAND_HISTORY_DIR:path.join(dir,'history')},processes=[],logs=[];let socket;
function launch(args,port){const fd=openSync(path.join(dir,`${port}.log`),'a');logs.push(fd);const p=spawn(process.execPath,args,{cwd:process.cwd(),env:{...env,PORT:String(port),POKER_PORT:String(port),HOSTNAME:'127.0.0.1'},stdio:['ignore',fd,fd]});processes.push(p);p.on('error',e=>console.error(e.message));}
let cookie='';async function request(body){const r=await fetch('http://127.0.0.1:3210/api/rpg/'+(body.action==='view'?'items':'rogue'),{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const text=await r.text();if(!r.ok)throw Error(text);return [JSON.parse(text),text.length];}
try{
 launch(['.next/standalone/server.js'],3210);launch(['--import','./mini-services/poker-server/node_modules/tsx/dist/loader.mjs','mini-services/poker-server/index.ts'],3213);
 let inventory;for(let i=0;i<100;i++){try{[inventory]=await request({action:'view'});break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(inventory?.link,'web ready');
 socket=io('http://127.0.0.1:3213',{transports:['websocket'],reconnection:false,timeout:10000});await new Promise((resolve,reject)=>{socket.on('connect',resolve);socket.on('connect_error',reject);});
 const wallet=await socket.timeout(10000).emitWithAck('LOBBY_HELLO',{}),purchase={jewelId:'lethalpride',requestId:'smoke-request-00001',link:inventory.link};
 const first=await socket.timeout(10000).emitWithAck('LOBBY_BUY_JEWEL',purchase);assert.ok(!first.error,first.error);assert.equal(first.account.multi,wallet.multi-1800);assert.equal(first.items.jewels.length,1);
 await new Promise(r=>setTimeout(r,180));const retry=await socket.timeout(10000).emitWithAck('LOBBY_BUY_JEWEL',purchase);assert.equal(retry.account.multi,first.account.multi);assert.equal(retry.items.jewels.length,1);
 [inventory]=await request({action:'view'});assert.equal(inventory.jewels[0].instanceId,first.items.jewels[0].instanceId);
 let [v,startBytes]=await request({action:'start',character:'hong'});assert.equal(v.build.tree.nodes.length,780);const id=v.id,version=v.buildRevision;
 [v]=await request({action:'tick',id,sequence:1,knownBuildRevision:version,input:{x:0,y:0,auto:false,skill:0}});assert.ok(v.cooldowns[0]>0);assert.equal(v.cooldownTotals[0],v.cooldowns[0]);assert.equal(v.build.tree,undefined);
 [v]=await request({action:'tick',id,sequence:2,knownBuildRevision:version,input:{x:0,y:0,auto:false,paused:true}});const remaining=v.cooldowns[0];
 const [paused,tickBytes]=await request({action:'tick',id,sequence:3,knownBuildRevision:version,input:{x:0,y:0,auto:false,paused:true}});assert.equal(paused.cooldowns[0],remaining);assert.ok(tickBytes<startBytes*.5);
 console.log(JSON.stringify({ok:true,shop:'socket charge → committed SQLite → web inventory; duplicate retry once',nodes:780,cooldownTotal:v.cooldownTotals[0],paused:true,startBytes,tickBytes}));
}finally{socket?.disconnect();for(const p of processes)p.kill('SIGTERM');await Promise.all(processes.map(p=>new Promise(r=>p.exitCode!==null||p.signalCode!==null?r():p.once('exit',r))));for(const fd of logs)closeSync(fd);rmSync(dir,{recursive:true,force:true});}
