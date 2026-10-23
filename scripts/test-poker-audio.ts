import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pokerActionSound,setPokerAudioScene,setPokerAudioMuted,setPokerAudioHidden,unlockPokerAudio,playPokerSound} from '../src/lib/poker-audio';

test('audio follows confirmed actions, scene changes, shuffle duration, mute and visibility',async()=>{
  assert.equal(pokerActionSound('CALL 200'),'chip_raise');
  assert.equal(pokerActionSound('RAISE 500'),'chip_raise');
  assert.equal(pokerActionSound('BET 500'),'chip_raise');
  assert.equal(pokerActionSound('ALL-IN 5,000'),'all_in_chip');
  assert.equal(pokerActionSound('fold'),null);
  assert.equal(pokerActionSound('CHECK'),null);
  const started:any[]=[];
  class Gain {gain={value:1,setValueAtTime(){}};connect(){return this;}disconnect(){} }
  class Source {buffer:any;loop=false;onended?:()=>void;stops:number[]=[];connect(){return new Gain();}start(){started.push(this);}stop(time=0){this.stops.push(time);}disconnect(){} }
  class Context {currentTime=10;destination={};createGain(){return new Gain();}createBufferSource(){return new Source();}async resume(){}async decodeAudioData(b:any){return b;}}
  const saved={window:globalThis.window,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  Object.assign(globalThis,{window:{},AudioContext:Context,fetch:async(url:string)=>({ok:true,arrayBuffer:async()=>url})});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  try {
    setPokerAudioScene('lobby');
    await playPokerSound('chip_raise');assert.equal(started.length,0); // no autoplay
    unlockPokerAudio();await flush();
    assert.ok(started.some(s=>s.loop&&s.buffer.endsWith('game_room.mp3')));
    const lobby=started[0];
    setPokerAudioScene('table');await flush();assert.ok(lobby.stops.length);
    assert.ok(started.some(s=>s.loop&&s.buffer.endsWith('poker_room.mp3')));
    await playPokerSound('shuffle_card',1.5);
    const shuffle=started.at(-1);assert.equal(shuffle.loop,true);assert.deepEqual(shuffle.stops,[11.5]);
    await playPokerSound('taking_card');assert.ok(started.at(-1).buffer.endsWith('taking_card.mp3'));
    setPokerAudioMuted(true);const count=started.length;
    await playPokerSound('all_in_chip');assert.equal(started.length,count);
    setPokerAudioMuted(false);await flush();
    setPokerAudioHidden(true);const hiddenCount=started.length;
    await playPokerSound('chip_raise');assert.equal(started.length,hiddenCount);
    setPokerAudioHidden(false);await flush();
    await playPokerSound('all_in_chip');assert.ok(started.at(-1).buffer.endsWith('all_in_chip.mp3'));
    setPokerAudioScene(null);const endCount=started.length;
    await playPokerSound('taking_card');assert.equal(started.length,endCount);
  } finally {Object.assign(globalThis,saved);}
});
