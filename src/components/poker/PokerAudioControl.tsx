"use client";
import {useEffect, useState} from 'react';
import {playPokerSound, setPokerAudioHidden, setPokerAudioMuted, unlockPokerAudio} from '@/lib/poker-audio';

export function PokerAudioControl() {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('poker-audio-muted') === 'true';
    setMuted(saved); setPokerAudioMuted(saved);
    const visibility = () => setPokerAudioHidden(document.hidden);
    visibility();
    const buttonClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button,[role="button"],summary');
      if (!button || button.matches(':disabled,[aria-disabled="true"]') || button.closest('[data-poker-chip-action]')) return;
      unlockPokerAudio();
      void playPokerSound('button_press');
    };
    document.addEventListener('pointerdown', unlockPokerAudio);
    document.addEventListener('keydown', unlockPokerAudio);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('click', buttonClick, true);
    return () => {
      document.removeEventListener('pointerdown', unlockPokerAudio);
      document.removeEventListener('keydown', unlockPokerAudio);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('click', buttonClick, true);
    };
  }, []);
  return <button type="button" aria-label={muted ? '사운드 켜기' : '사운드 끄기'} aria-pressed={!muted}
    className="fixed bottom-2 left-2 z-[100] rounded-full border border-amber-300/40 bg-slate-950/85 px-2 py-1 text-xs text-amber-100"
    onClick={() => {
      const next = !muted; setMuted(next); setPokerAudioMuted(next);
      localStorage.setItem('poker-audio-muted', String(next)); unlockPokerAudio();
    }}>{muted ? '🔇' : '🔊'}</button>;
}
