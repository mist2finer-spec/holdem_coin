'use client';
import {useState} from 'react';
import {COMBAT_CHARACTERS,isHuntPlayable,type CombatCharacterId} from './combat-characters';
import {RoguePrototype} from './rogue/RoguePrototype';
import {HuntPrototype} from './HuntPrototype';
import {HUNT_MAPS,type HuntMapId} from './hunt-map';
import './hunt-selection.css';
import './hunt-phone.css';
/** Entry selection is separate from the running engine: no hidden reset on outfit changes. */
export function HuntEntry({onExit}:{onExit?:()=>void}){
 return <div className="hunt-device-stage"><div className="hunt-device" aria-label="세로형 RPG 게임 화면"><div className="hunt-device-screen"><HuntEntryContent onExit={onExit}/></div></div></div>;
}
function HuntEntryContent({onExit}:{onExit?:()=>void}){
 const [selected,setSelected]=useState<CombatCharacterId|null>(null);
 const [entered,setEntered]=useState(false);
 const [map,setMap]=useState<HuntMapId>('rogue-dungeon');
 if(entered&&selected&&map==='rogue-dungeon')return <RoguePrototype onExit={()=>setEntered(false)}/>;
 if(entered&&selected)return <HuntPrototype key={selected+map} character={selected} mapId={map} onExit={()=>setEntered(false)}/>;
 const current=COMBAT_CHARACTERS.find(c=>c.id===selected);
 return <main className="hunt-selection">
  <header><a href="/" onClick={e=>{if(onExit){e.preventDefault();onExit();}}}>← 처음으로</a><span>ISLAND · ADVENTURE</span></header>
  <section className="hunt-selection-heading"><small>달빛 숲으로</small><h1>함께할 캐릭터를 선택하세요</h1><p>사냥으로 성장하고 장비를 강화하세요. 가방과 사냥 의뢰도 이용할 수 있습니다.</p></section>
  <div className="hunt-roster" role="group" aria-label="사냥 캐릭터 선택">
   {COMBAT_CHARACTERS.map(c=><button type="button" className={`hunt-roster-card ${selected===c.id?'is-selected':''}`} key={c.id} disabled={!isHuntPlayable(c.id)} aria-pressed={selected===c.id} aria-label={`${c.label} 선택`} onClick={()=>setSelected(c.id)}>
    <img src={`/rpg/characters/${c.id}/illustration.jpg`} alt="" draggable={false}/><strong>{c.label}</strong><span>{!isHuntPlayable(c.id)?'선택 불가':selected===c.id?'선택됨':'선택'}</span>
   </button>)}
  </div>
  <label className="hunt-map-choice">테스트 맵<select aria-label="사냥 맵 선택" value={map} onChange={e=>setMap(e.target.value as HuntMapId)}>{HUNT_MAPS.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select></label>
  {map==='rogue-dungeon'&&<p className="hunt-map-note">상하좌우 자유 탐험 · 10개 방 무작위 생성 · 처치한 몬스터는 다시 나오지 않습니다. 테스트 재화는 기존 저장과 별도입니다.</p>}
  {map==='candle-dungeon'&&<p className="hunt-map-note">원본 Map002_001의 비주얼 복원 · 몬스터와 성장 진행은 현재 테스트 전투를 사용합니다.</p>}
  <footer className="hunt-selection-start"><div><strong>{current?.label||'캐릭터를 선택해 주세요'}</strong><small>{map==='rogue-dungeon'?'촛불 미궁 · 10개 방':map==='forest'?'시작의 숲 · 1–1':'촛불 지하 회랑 · 1–1'}</small></div><button type="button" disabled={!selected} onClick={()=>{if(selected)setEntered(true);}}>사냥 시작 →</button></footer>
 </main>;
}
