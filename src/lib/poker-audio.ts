// Browser-only audio, shared by solo and multiplayer. No audio enters the engine.
export type PokerSound = 'chip_raise' | 'all_in_chip' | 'shuffle_card' | 'taking_card';
export type PokerAudioScene = 'start' | 'lobby' | 'table' | null;
const file = (name: string) => `/audio/poker/${name}.mp3`;
let context: AudioContext | undefined;
let master: GainNode | undefined;
let scene: PokerAudioScene = null;
const music = new Set<AudioBufferSourceNode>();
let musicRequest = 0;
let dealRequest = 0;
let unlocked = false;
let muted = false;
let hidden = false;
const buffers = new Map<string, Promise<AudioBuffer>>();
const effects = new Map<AudioBufferSourceNode, PokerSound>();

function buffer(name: string) {
  if (!buffers.has(name)) buffers.set(name, fetch(file(name)).then(r => {
    if (!r.ok) throw new Error('Audio unavailable');
    return r.arrayBuffer();
  }).then(b => context!.decodeAudioData(b)).catch(error => { buffers.delete(name); throw error; }));
  return buffers.get(name)!;
}
function stopEffects() {
  for (const source of effects.keys()) { try { source.stop(); } catch {} }
  effects.clear();
}
async function startMusic() {
  const request = ++musicRequest;
  for(const source of music) source.stop(); music.clear();
  if (!context || !unlocked || !scene || muted || hidden) return;
  const tracks: ReadonlyArray<readonly [string,number]> = scene === 'start'
    ? [['choose_map',.42],['tv_sound',.22]] : [[scene === 'lobby'?'game_room':'poker_room',.24]];
  await Promise.all(tracks.map(async([track,volume])=>{
    try {
      const data = await buffer(track);
      if (request !== musicRequest || muted || hidden || !context) return;
      const source = context.createBufferSource();
      const gain = context.createGain(); gain.gain.value = volume;
      source.buffer = data; source.loop = true;
      source.onended = () => { music.delete(source); source.disconnect(); gain.disconnect(); };
      source.connect(gain).connect(master!); source.start(); music.add(source);
    } catch { /* Audio failure never blocks navigation. */ }
  }));
}
export function setPokerAudioScene(next: PokerAudioScene) {
  if (scene === next) return;
  scene = next; stopEffects(); void startMusic();
}
export function setPokerAudioMuted(next: boolean) {
  muted = next;
  if (master && context) master.gain.setValueAtTime(muted || hidden ? 0 : 1, context.currentTime);
  stopEffects(); void startMusic();
}
export function setPokerAudioHidden(next: boolean) {
  hidden = next;
  if (master && context) master.gain.setValueAtTime(muted || hidden ? 0 : 1, context.currentTime);
  stopEffects(); void startMusic();
}
// Call directly from a trusted pointer/keyboard gesture (mobile autoplay policy).
export function unlockPokerAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!context) {
      context = new AudioContext(); master = context.createGain(); master.connect(context.destination);
      master.gain.value = muted || hidden ? 0 : 1;
    }
    void context.resume().then(() => {
      if (!unlocked) {
        unlocked = true;
        for (const name of ['chip_raise','all_in_chip','shuffle_card','taking_card']) void buffer(name).catch(() => {});
        void startMusic();
      }
    }).catch(() => {});
  } catch { /* AudioContext may be unavailable. */ }
}
export async function playPokerSound(name: PokerSound, duration?: number) {
  if (!context || !unlocked || muted || hidden || scene !== 'table') return;
  const isDeal = name === 'shuffle_card' || name === 'taking_card';
  const deal = isDeal ? ++dealRequest : dealRequest;
  if (name === 'taking_card') {
    for (const [source, kind] of effects) if (kind === 'shuffle_card') { try { source.stop(); } catch {} effects.delete(source); }
  }
  const requested = musicRequest;
  try {
    const data = await buffer(name);
    if (!context || requested !== musicRequest || (isDeal && deal !== dealRequest) || muted || hidden || scene !== 'table') return;
    const source = context.createBufferSource(); const gain = context.createGain();
    gain.gain.value = .65; source.buffer = data;
    source.connect(gain).connect(master!);
    // Shuffle is looped/cut to the exact table-clear interval, even for a short clip.
    source.loop = duration !== undefined;
    effects.set(source, name);
    source.onended = () => { effects.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(); if (duration !== undefined) source.stop(context.currentTime + duration);
  } catch {}
}
export function pokerActionSound(action: string): PokerSound | null {
  const normalized = action.toLowerCase().replace(/[\s_-]/g, '');
  if (normalized.startsWith('allin') || normalized.startsWith('올인')) return 'all_in_chip';
  if (['raise', 'call', 'bet', '레이즈', '콜', '벳'].some(a => normalized.startsWith(a))) return 'chip_raise';
  return null;
}
