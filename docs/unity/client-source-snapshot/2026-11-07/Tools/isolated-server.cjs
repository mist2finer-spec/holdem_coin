const http=require('http'),fs=require('fs'),{performance}=require('perf_hooks');
process.env.POKER_TEST_MODE='1';
const root=__dirname+'/repo/';process.chdir(root);
require(root+'mini-services/poker-server/node_modules/tsx/dist/cjs/index.cjs');
const {createGameStorage}=require(root+'src/lib/game-storage.ts');
const {UnityBossService}=require(root+'src/lib/rpg-unity-boss-service.ts');
const storage=createGameStorage(':memory:'),service=new UnityBossService(storage.progress,storage.items);
const account='c'.repeat(64);let delay=150,count=0,jitter=0,dropEvery=0,attempts=0,drops=0;const times=[],bytes=[];
http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.url.startsWith('/control')){const q=new URL(req.url,'http://localhost').searchParams;delay=Math.max(0,Math.min(1000,Number(q.get('rtt')||150)));jitter=Number(q.get('jitter')||0);dropEvery=Number(q.get('dropEvery')||0);res.end(JSON.stringify({rtt:delay,jitter,dropEvery}));return;}
 if(req.url==='/health'){res.end(JSON.stringify({isolated:true,requests:count,rtt:delay,drops}));return;}
 if(req.url!=='/api/rpg/unity-boss'){res.statusCode=404;res.end('{}');return;}
 try{let raw='';for await(const c of req){raw+=c;if(raw.length>8192)throw Error('Request too large');}const b=JSON.parse(raw);
  attempts++;const latency=Math.max(0,delay+(attempts%2?jitter:-jitter));await new Promise(r=>setTimeout(r,latency/2));const t=performance.now();
  const reply=b.action==='start'?service.start(account):service.command(account,b.id,b.sequence,b.input,b.action,b.knownBuildRevision);
  const body=JSON.stringify(reply);times.push(performance.now()-t);bytes.push(Buffer.byteLength(body));count++;
  await new Promise(r=>setTimeout(r,latency/2));if(dropEvery>0&&b.action!=='start'&&attempts%dropEvery===0){drops++;res.destroy();return;}
  res.setHeader('Set-Cookie','rpg_guest='+account+'; Path=/api/rpg');res.end(body);
  if(count%30===0)fs.writeFileSync(__dirname+'/evidence/server-cost.json',JSON.stringify({count,times,bytes}));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
}).listen(18093,'127.0.0.1',()=>console.log('Isolated boss service :18093 with controlled RTT'));
