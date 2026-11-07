import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../../src/app/api/rpg/unity-boss/route';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Unity boss cookie is set at entry and not rewritten for every combat tick',async()=>{
 process.env.RPG_SAVE_DIR=mkdtempSync(join(tmpdir(),'island-boss-route-test-'));
 const request=(body:unknown,cookie?:string)=>new NextRequest('http://localhost/api/rpg/unity-boss',{method:'POST',headers:{host:'localhost','content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 const start=await POST(request({action:'start'}));assert.equal(start.status,200);const cookie=start.headers.get('set-cookie');assert.ok(cookie);const initial=await start.json();
 const tick=await POST(request({action:'tick',id:initial.id,sequence:1,knownBuildRevision:initial.buildRevision,input:{x:0,y:0,auto:false}},cookie!.split(';')[0]));
 assert.equal(tick.status,200);assert.equal(tick.headers.get('set-cookie'),null);const value=await tick.json();assert.equal(value.sequence,1);assert.equal(value.acceptedInput.auto,false);
 const restart=await POST(request({action:'start'},cookie!.split(';')[0]));assert.equal(restart.status,200);assert.ok(restart.headers.get('set-cookie'));
});
