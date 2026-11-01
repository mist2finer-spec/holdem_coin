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
  class Source {output:any;buffer:any;loop=false;onended?:()=>void;stops:number[]=[];connect(g:Gain){this.output=g;return g;}start(){started.push(this);}stop(time=0){this.stops.push(time);}disconnect(){} }
  class Context {currentTime=10;destination={};createGain(){return new Gain();}createBufferSource(){return new Source();}async resume(){}async decodeAudioData(b:any){return b;}}
  const saved={window:globalThis.window,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  Object.assign(globalThis,{window:{},AudioContext:Context,fetch:async(url:string)=>({ok:true,arrayBuffer:async()=>url})});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  try {
    setPokerAudioScene('start');
    await playPokerSound('chip_raise');assert.equal(started.length,0); // no autoplay
    await playPokerSound('button_press');assert.equal(started.length,0);
    unlockPokerAudio();await flush();
    const main=started.find(s=>s.buffer.endsWith('choose_map.mp3'));
    const tv=started.find(s=>s.buffer.endsWith('tv_sound.mp3'));
    assert.ok(main?.loop&&tv?.loop);assert.ok(main.output.gain.value>tv.output.gain.value);
    setPokerAudioScene('lobby');await flush();assert.ok(main.stops.length&&tv.stops.length);
    const lobby=started.find(s=>s.loop&&s.buffer.endsWith('lobby_jazz.mp3'));
    assert.ok(lobby);assert.equal(lobby.output.gain.value,.24);
    await playPokerSound('chip_raise');assert.equal(started.at(-1),lobby); // chip effects remain table-only
    await playPokerSound('button_press');assert.ok(started.at(-1).buffer.endsWith('button_press.mp3'));
    assert.equal(started.at(-1).output.gain.value,.45);
    const navigationClick=playPokerSound('button_press');
    setPokerAudioScene('table');await navigationClick;await flush();assert.ok(lobby.stops.length);
    assert.ok(started.some(s=>s.buffer.endsWith('button_press.mp3')&&!s.stops.length));
    const table=started.filter(s=>s.loop&&s.buffer.endsWith('lobby_jazz.mp3')).at(-1);
    assert.equal(table.output.gain.value,.06);assert.ok(table.output.gain.value<lobby.output.gain.value);
    assert.ok(!started.some(s=>/\/(game_room|poker_room)\.mp3$/.test(s.buffer)));
    await playPokerSound('shuffle_card',1.5);
    const shuffle=started.at(-1);assert.equal(shuffle.loop,true);assert.deepEqual(shuffle.stops,[11.5]);
    await playPokerSound('taking_card');assert.ok(started.at(-1).buffer.endsWith('taking_card.mp3'));
    setPokerAudioMuted(true);const count=started.length;
    await playPokerSound('all_in_chip');assert.equal(started.length,count);
    await playPokerSound('button_press');assert.equal(started.length,count);
    setPokerAudioMuted(false);await flush();
    setPokerAudioHidden(true);const hiddenCount=started.length;
    await playPokerSound('chip_raise');assert.equal(started.length,hiddenCount);
    await playPokerSound('button_press');assert.equal(started.length,hiddenCount);
    setPokerAudioHidden(false);await flush();
    await playPokerSound('all_in_chip');assert.ok(started.at(-1).buffer.endsWith('all_in_chip.mp3'));
    setPokerAudioScene(null);const endCount=started.length;
    await playPokerSound('taking_card');assert.equal(started.length,endCount);
    await playPokerSound('button_press');assert.equal(started.length,endCount);
    setPokerAudioScene('lobby');await flush();
    const buttonCount=()=>started.filter(s=>s.buffer.endsWith('button_press.mp3')).length;
    const beforePending=buttonCount();
    const pendingButton=playPokerSound('button_press');
    setPokerAudioHidden(true);setPokerAudioHidden(false);await flush();
    await pendingButton;assert.equal(buttonCount(),beforePending);
    const exitButton=playPokerSound('button_press');
    setPokerAudioScene(null);setPokerAudioScene('lobby');await flush();
    await exitButton;assert.equal(buttonCount(),beforePending);
    setPokerAudioScene(null);
  } finally {Object.assign(globalThis,saved);}
});
