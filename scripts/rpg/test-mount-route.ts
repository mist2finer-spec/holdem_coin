import test from 'node:test';import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';import {POST} from '../../src/app/api/rpg/mount-sunday/route';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('mount API retains secure session, exact retries, restart invalidation and input validation',async()=>{
 process.env.POKER_TEST_MODE='1';process.env.RPG_SAVE_DIR=mkdtempSync(join(tmpdir(),'island-mount-route-'));
 const req=(body:unknown,cookie?:string,headers:any={})=>new NextRequest('http://localhost/api/rpg/mount-sunday',{method:'POST',headers:{host:'localhost','content-type':'application/json',...(cookie?{cookie}:{}),...headers},body:JSON.stringify(body)});
 const start=await POST(req({action:'start'}));assert.equal(start.status,200);const initial=await start.json(),cookie=start.headers.get('set-cookie')!.split(';')[0];assert(initial.map.mountSunday);assert.equal(start.headers.get('cache-control'),'no-store');
 const body={action:'tick',id:initial.id,sequence:1,knownBuildRevision:initial.buildRevision,input:{x:0,y:0,auto:false,readyZone:0}};
 const tick=await POST(req(body,cookie)),data=await tick.json();assert.equal(tick.status,200);assert.equal(tick.headers.get('set-cookie'),null);assert.equal(data.map,undefined);
 const retry=await POST(req(body,cookie));assert.deepEqual(await retry.json(),data);
 assert.equal((await POST(req({...body,input:{...body.input,readyZone:1}},cookie))).status,400);
 assert.equal((await POST(req({...body,sequence:3},cookie))).status,400);
 assert.equal((await POST(req({...body,sequence:2},'rpg_guest='+'a'.repeat(64)))).status,400);
 assert.equal((await POST(req(body,cookie,{origin:'https://evil.example'}))).status,403);
 assert.equal((await POST(req({padding:'x'.repeat(5000)},cookie))).status,413);
 const restarted=await POST(req({action:'start'},cookie));assert.equal(restarted.status,200);assert.notEqual((await restarted.json()).id,initial.id);
 assert.equal((await POST(req({...body,sequence:2},cookie))).status,400);
});
