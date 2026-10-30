import test from 'node:test';
import assert from 'node:assert/strict';
import {HuntEngine} from '../../src/components/rpg/hunt-engine';
import {HUNT_JUMP,jumpVisual} from '../../src/components/rpg/hunt-jump';
import {isClearLanding} from '../../src/components/rpg/hunt-collision';
import {RpgService,parseHuntInput} from '../../src/lib/rpg-service';
import {RpgStore} from '../../src/lib/rpg-store';
import {DEFAULT_HUNT_BALANCE} from '../../src/components/rpg/hunt-progression';
const step=(g:HuntEngine,n:number)=>{for(let i=0;i<n;i++)g.step(.01,0);};
test('jump leaves ground, uses five native poses, lands and rejects repeated airborne inputs',()=>{
 const g=new HuntEngine();g.enemies.forEach(e=>e.hp=0);const origin=g.x;
 assert.equal(g.jump(1),true);assert.equal(g.jump(1),false);assert.equal(g.attack(),false);assert.equal(g.dodge(1),false);
 const j=g.jumpState!;assert.equal(jumpVisual(j,j.startedAt).height,0);assert.equal(jumpVisual(j,j.startedAt+j.duration).height,0);
 assert.equal(jumpVisual(j,j.startedAt+j.duration/2).height,HUNT_JUMP.height);
 assert.deepEqual([.05,.2,.5,.8,.95].map(t=>jumpVisual(j,j.startedAt+j.duration*t).pose),['jump1','jump2','jump3','jump4','jump5']);
 step(g,90);assert.equal(g.jumpState,null);assert.equal(g.x,origin+HUNT_JUMP.distance);assert.equal(g.jump(),false);step(g,20);assert.equal(g.jump(),true);
});
test('jump shares bounded crossing and recomputes an occupied landing',()=>{
 const g=new HuntEngine();g.x=600;g.enemies.forEach((e,i)=>{e.hp=i<4?100:0;e.x=640+i*40;});assert.equal(g.jump(1),true);step(g,90);assert.equal(g.x,600);
 const h=new HuntEngine();h.enemies.forEach(e=>e.hp=0);h.jump(1);const dest=h.jumpState!.destination;h.enemies[0].hp=100;h.enemies[0].x=dest;step(h,90);assert.equal(isClearLanding(h.x,h.enemies),true);
 for(const bad of [NaN,Infinity,2])assert.equal(new HuntEngine().jump(bad),false);
});
test('service blocks locked characters and owns jump timing with idempotent retries',()=>{
 const store=new RpgStore(':memory:');let now=0;const service=new RpgService(store,DEFAULT_HUNT_BALANCE,()=>now);
 try{
  assert.throws(()=>service.start('g','white-bob'),/홍만/);const v=service.start('g','hong');const input={move:0,attack:false,auto:false,jump:true};
  const a=service.command('g',v.id,1,input);assert.ok(a.jump);assert.deepEqual(service.command('g',v.id,1,input),a);
  assert.throws(()=>service.command('g',v.id,2,{...input,jump:false},'equip-sword'),/착지/);
  now=300;const b=service.command('g',v.id,2,{...input,jump:false});assert.ok(b.jump);assert.ok(b.elapsed<=.301);
  assert.throws(()=>parseHuntInput({...input,jump:1}));
 }finally{store.close();}
});

test('manual jump reservation survives an attack and starts before auto combat resumes',()=>{
 const g=new HuntEngine();g.enemyX=g.x+40;g.setAuto(true);assert.equal(g.attack(),true);assert.equal(g.requestJump(),true);
 let airborne=false;for(let i=0;i<120;i++){g.step(.01,0);if(g.jumpState){airborne=true;break;}}assert.equal(airborne,true);
});
