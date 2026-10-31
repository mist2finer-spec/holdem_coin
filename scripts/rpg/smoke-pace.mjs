import assert from 'node:assert/strict';
const base=process.env.RPG_SMOKE_URL||'http://127.0.0.1:3018';let cookie='';
async function post(body){const r=await fetch(base+'/api/rpg/rogue',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const v=await r.json();assert.equal(r.status,200,v.error);const c=r.headers.getSetCookie().find(s=>s.startsWith('rpg_guest='));if(c)cookie=c.split(';')[0];return v;}
const idle={x:0,y:0,auto:false},v=await post({action:'start',character:'hong'});let seq=0;
const command=input=>post({id:v.id,sequence:++seq,action:'tick',input});
const first=await command(idle),start=performance.now();let view=first;
for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,400));view=await command(idle);}
const wall=(performance.now()-start)/1000,simulation=view.elapsed-first.elapsed;
assert.ok(Math.abs(wall-simulation)<.25,`time dropped: wall=${wall}, simulation=${simulation}`);
const duplicate=await post({id:v.id,sequence:seq,action:'tick',input:{...idle,skill:0}});assert.deepEqual(duplicate,view);
console.log(JSON.stringify({result:'PACE_HTTP_PASSED',wallSeconds:+wall.toFixed(3),simulationSeconds:+simulation.toFixed(3),duplicateReplayed:true}));
