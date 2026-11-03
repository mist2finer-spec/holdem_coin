// Requires a production build and Playwright+Chromium. Uses isolated local saves.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'poker-profile-smoke-'));
const output=process.env.PROFILE_SCREENSHOTS||path.join(os.tmpdir(),'poker-profile-screenshots'),children=[],errors=[];
fs.mkdirSync(output,{recursive:true});
let browser;
function launch(args,env){const fd=fs.openSync(path.join(temp,'process-'+children.length+'.log'),'a');const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,RPG_SAVE_DIR:path.join(temp,'save'),HAND_HISTORY_DIR:path.join(temp,'history'),POKER_RESTART_INTERVAL_MS:'0',...env},stdio:['ignore',fd,fd]});fs.closeSync(fd);children.push(child);return child;}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Not ready: '+url);}
async function images(page){await page.evaluate(()=>Promise.all(Array.from(document.querySelectorAll('.poker-profile-art')).map(i=>i.decode())));}
async function inBounds(page){const result=await page.evaluate(()=>{const screen=document.querySelector('.poker-device-screen').getBoundingClientRect();return Array.from(document.querySelectorAll('.poker-player-profile')).map(e=>{const b=e.getBoundingClientRect();return {character:e.dataset.character,ok:b.left>=screen.left-.5&&b.right<=screen.right+.5&&b.top>=screen.top-.5&&b.bottom<=screen.bottom+.5};});});assert.ok(result.length>0);assert.ok(result.every(r=>r.ok),JSON.stringify(result));}
try{
 launch([require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','-p','3000'],{});
 launch(['--import','./mini-services/poker-server/node_modules/tsx/dist/loader.mjs','mini-services/poker-server/index.ts'],{PORT:'3003',POKER_TEST_MODE:'0'});
 await Promise.all([ready('http://127.0.0.1:3000/'),ready('http://127.0.0.1:3003/health')]);
 const headlessShell=process.env.PROFILE_BROWSER;
 browser=await chromium.launch({headless:true,...(headlessShell?{executablePath:headlessShell,args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu']}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/?screen=poker');
 if(process.env.PROFILE_FONT){await page.addStyleTag({content:`@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64,${fs.readFileSync(process.env.PROFILE_FONT).toString('base64')}) format('truetype')} body,button,input{font-family:'Noto Sans KR',Arial,sans-serif}`});}
 await page.getByRole('button',{name:/싱글 플레이/}).click();await page.locator('.poker-profile-seat').nth(7).waitFor();await images(page);
 assert.equal(await page.locator('.poker-profile-seat').count(),8);assert.equal(await page.locator('.poker-profile-seat img[src*="-table/"]').count(),0);
 for(const [width,height] of [[390,844],[375,667],[320,568],[430,932],[1440,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await inBounds(page);
  await page.screenshot({path:path.join(output,`single-${width}x${height}.png`)});
 }
 console.log('PROFILE_SINGLE_LAYOUT_PASSED five viewport sizes, eight seats');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'← 로비로'}).click();await page.locator('.island-modes button').filter({hasText:'6인 서버'}).click();await page.locator('.poker-profile-seat').nth(5).waitFor();await images(page);assert.equal(await page.locator('.poker-profile-seat').count(),6);await inBounds(page);await page.screenshot({path:path.join(output,'server-six.png')});
 console.log('PROFILE_SERVER_SIX_PASSED');
 await page.getByRole('button',{name:'← 로비로'}).click();await page.getByRole('button',{name:/8인 토너먼트/}).click();await page.locator('.poker-profile-seat').nth(7).waitFor();await images(page);assert.equal(await page.locator('.poker-profile-seat').count(),8);await inBounds(page);assert.ok((await page.locator('.poker-profile-chips').allTextContents()).some(t=>t.includes('BB')));await page.screenshot({path:path.join(output,'tournament-eight.png')});
 assert.deepEqual(errors,[]);console.log('PROFILE_TOURNAMENT_PASSED BB chips; no page errors');console.log('SCREENSHOTS',output);
}catch(error){for(let i=0;i<children.length;i++){const file=path.join(temp,'process-'+i+'.log');if(fs.existsSync(file))console.error(fs.readFileSync(file,'utf8').slice(-1600));}throw error;
}finally{
 await browser?.close();for(const child of children)child.kill('SIGTERM');
 await Promise.all(children.map(child=>new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},3000);child.once('exit',()=>{clearTimeout(timer);resolve();});})));
 // Screenshots outside temp are retained; isolated server saves are always removed.
 fs.rmSync(temp,{recursive:true,force:true});
}
