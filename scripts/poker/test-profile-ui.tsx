import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {renderToStaticMarkup} from 'react-dom/server';
import {PokerPlayerProfile,pokerProfile,profileLevel} from '../../src/components/poker/PokerPlayerProfile';
import {SalonSeat,SALON_EIGHT_POSITIONS} from '../../src/components/poker/SalonSeat';
import manifest from '../../public/poker/profiles/manifest.json';

test('all nine identities resolve to distinct original illustration profiles',async()=>{
 assert.equal(new Set(manifest.characters.map(c=>c.portrait)).size,9);
 assert.equal(new Set(manifest.characters.map(c=>c.asset)).size,9);
 for(const c of manifest.characters){
  assert.equal(pokerProfile(c.portrait).id,c.id);
  assert.ok(fs.existsSync(path.join('public',c.source)));
  const {data,info}=await sharp(path.join('public',c.asset)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,512);assert.equal(info.height,512);
  const alpha=(x:number,y:number)=>data[(y*512+x)*4+3];
  assert.equal(alpha(0,0),0);assert.equal(alpha(511,0),0);
  assert.ok(alpha(256,38)>0,`${c.id}: crown extends above circle top y=48`);
  assert.ok(alpha(256,260)>0);
 }
 assert.equal(pokerProfile(999).id,'hong');assert.equal(profileLevel(),1);assert.equal(profileLevel(NaN),1);assert.equal(profileLevel(-1),1);assert.equal(profileLevel(423.8),423);
});
test('dealer and blind coexist, nickname is escaped, chip and level values stay dynamic',()=>{
 const html=renderToStaticMarkup(<PokerPlayerProfile portrait={3} name={'<script>bad</script>'} chips="1.3 BB" level={423} dealer blind="SB" active/>);
 assert.ok(html.includes('딜러 D'));assert.ok(html.includes('스몰 블라인드'));assert.ok(html.includes('★423'));assert.ok(html.includes('1.3 BB'));
 assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('&lt;script&gt;'));
});
test('opponent cards stay masked until reveal; folded opponents hide cards while player retains own',()=>{
 const seat={name:'상대',stack:1000,isUser:false,folded:false,holeCards:[{rank:'A',suit:'♥'},{rank:'K',suit:'♣'}]} as const;
 const draw=(isUser:boolean,folded:boolean,showCards:boolean)=>renderToStaticMarkup(<SalonSeat seat={{...seat,isUser,folded,holeCards:[...seat.holeCards]}} position={SALON_EIGHT_POSITIONS[1]} isActive={false} isDealer={false} isSmallBlind={false} isBigBlind={false} showCards={showCards}/>);
 assert.ok(!draw(false,false,false).includes('>A<'));assert.ok(draw(false,false,true).includes('>A<'));
 assert.ok(!draw(false,true,true).includes('>A<'));assert.ok(draw(true,true,false).includes('>A<'));
});
