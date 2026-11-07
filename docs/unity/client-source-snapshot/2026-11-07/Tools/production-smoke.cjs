const assert=require('node:assert/strict'),fs=require('node:fs');
const base='https://holdem-coin-tavern.onrender.com';
(async()=>{
 const health=await fetch(base+'/healthz',{signal:AbortSignal.timeout(30000)});assert.equal(health.status,200);
 const release=await(await fetch(base+'/api/release')).json();assert.equal(release.revision,'7adb404f47ea73383f26651a8eaaa261ed4bc823');
 const first=await fetch(base+'/api/rpg/unity-boss',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start'}),signal:AbortSignal.timeout(30000)});assert.equal(first.status,200);const cookie=first.headers.get('set-cookie').split(';')[0];let state=await first.json();assert.equal(state.protocol,'island-unity-boss-v2');assert.equal(state.map.rooms.length,2);
 const seen=new Set();let requests=0,warnBorn=null,blastDelay=null,previous=state.elapsed;const began=Date.now();
 while(Date.now()-began<90000){await new Promise(r=>setTimeout(r,100));const r=await fetch(base+'/api/rpg/unity-boss',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({action:'tick',id:state.id,sequence:state.sequence+1,knownBuildRevision:state.buildRevision,input:{x:0,y:0,auto:true}}),signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);state=await r.json();assert.equal(state.acceptedInput.auto,true);assert.equal(state.acceptedInput.x,0);requests++;assert.ok(state.elapsed>=previous);previous=state.elapsed;seen.add(state.phase);seen.add(state.hero.action);if(state.warning){seen.add('warning');warnBorn=state.warning.born;}
  const explosion=state.fx?.find(f=>f.kind==='explosion');if(explosion&&warnBorn!==null){blastDelay=explosion.born-warnBorn;seen.add('explosion');}if(state.room===1)seen.add('boss-room');
  if(requests%75===0)console.log(JSON.stringify({requests,elapsed:state.elapsed,phase:state.phase,action:state.hero.action}));
  if(seen.has('warning')&&seen.has('knockdown')&&seen.has('getup'))break;
 }
 for(const key of ['bridge','boss-room','warning','explosion','knockdown','getup'])assert.ok(seen.has(key),key+' must be observed');assert.ok(Math.abs(blastDelay-2)<.021);assert.ok(state.hero.hp>0);assert.equal(state.training,true);
 const report={status:'PASS',health:health.status,release,protocol:state.protocol,requests,seconds:(Date.now()-began)/1000,simulationSeconds:state.elapsed,observed:[...seen],warningToExplosionSeconds:blastDelay,playerHP:state.hero.hp,bossHP:state.mobs.find(m=>m.unityBoss).hp,training:true,permanentReward:false,acceptedInputVerified:true,tickCookieRewrites:0};fs.writeFileSync('C:/Users/SHK/island-combat-stability-20261107/evidence/production-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
