import assert from 'node:assert/strict';
const base=process.env.RPG_SMOKE_URL||'http://127.0.0.1:3017';let cookie='';
async function post(mode,body,status=200){const response=await fetch(`${base}/api/rpg/${mode}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await response.json();assert.equal(response.status,status,data.error);for(const c of response.headers.getSetCookie())if(c.startsWith('rpg_guest='))cookie=c.split(';')[0];return data;}
const input={x:0,y:0,auto:false};
const start=await post('rogue',{action:'start',character:'hong'});assert.equal(start.build.skills.length,6);assert.equal(start.build.budget,12);
const command=(sequence,action,status=200)=>post('rogue',{id:start.id,sequence,action,input},status);
const core=await command(1,'core-allocate-0_1');assert.equal(core.build.remaining,11);
const gem=await command(2,'gem-0-0-power');assert.ok(Math.abs(gem.build.skills[0].effect-1.06*1.3)<1e-10);
assert.deepEqual(await command(2,'gem-0-0-power'),gem);
await command(3,'core-refund-root',400);await command(3,'gem-5-0-power',400);
const echo=await command(3,'gem-0-1-echo');assert.equal(echo.build.skills[0].repeats,1);
const campaign=await post('session',{action:'start',character:'hong'});assert.deepEqual(campaign.build.state,echo.build.state);
const reset=await post('session',{id:campaign.id,sequence:1,action:'core-reset',input:{move:0,attack:false,auto:false}});assert.equal(reset.build.remaining,12);
const restart=await post('rogue',{action:'start',character:'hong'});assert.deepEqual(restart.build.state,reset.build.state);
await post('rogue',{id:restart.id,sequence:1,action:'gem-0-0-empty',input});await post('rogue',{id:restart.id,sequence:2,action:'gem-0-1-empty',input});
console.log('BUILD_HTTP_PASSED: routes, tags, graph, duplicate sequence, cross-mode save and re-entry');
