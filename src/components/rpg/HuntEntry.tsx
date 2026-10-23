'use client';
import {useState} from 'react';
import {COMBAT_CHARACTERS,type CombatCharacterId} from './combat-characters';
import {HuntPrototype} from './HuntPrototype';
import './hunt-selection.css';
/** Entry selection is separate from the running engine: no hidden reset on outfit changes. */
export function HuntEntry({onExit}:{onExit?:()=>void}){
 const [selected,setSelected]=useState<CombatCharacterId|null>(null);
 const [entered,setEntered]=useState(false);
 if(entered&&selected)return <HuntPrototype key={selected} character={selected} onExit={()=>setEntered(false)}/>;
 const current=COMBAT_CHARACTERS.find(c=>c.id===selected);
 return <main className="hunt-selection">
  <header><a href="/" onClick={e=>{if(onExit){e.preventDefault();onExit();}}}>← 처음으로</a><span>ISLAND · ADVENTURE</span></header>
  <section className="hunt-selection-heading"><small>달빛 숲으로</small><h1>함께할 캐릭터를 선택하세요</h1><p>마음에 드는 여행자와 사냥을 시작하세요.</p></section>
  <div className="hunt-roster" role="group" aria-label="사냥 캐릭터 선택">
   {COMBAT_CHARACTERS.map(c=><button type="button" className={`hunt-roster-card ${selected===c.id?'is-selected':''}`} key={c.id} aria-pressed={selected===c.id} aria-label={`${c.label} 선택`} onClick={()=>setSelected(c.id)}>
    <img src={`/rpg/characters/${c.id}/illustration.jpg`} alt="" draggable={false}/><strong>{c.label}</strong><span>{selected===c.id?'선택됨':'선택'}</span>
   </button>)}
  </div>
  <footer className="hunt-selection-start"><div><strong>{current?.label||'캐릭터를 선택해 주세요'}</strong><small>달빛 숲 · 1–1</small></div><button type="button" disabled={!selected} onClick={()=>{if(selected)setEntered(true);}}>사냥 시작 →</button></footer>
 </main>;
}
