"use client";
import {useState,useCallback} from 'react';
import dynamic from 'next/dynamic';
const HuntPrototype = dynamic(()=>import('@/components/rpg/HuntPrototype').then(m=>m.HuntPrototype),{ssr:false});
import {LobbyPanel} from '@/components/poker/LobbyPanel';
import {PokerTable} from '@/components/poker/PokerTable';
import {PokerTableSocket} from '@/components/poker/PokerTableSocket';
import {ActionSkinButton} from '@/components/poker/ActionSkinButton';
import {toast} from 'sonner';
import '@/components/poker/island.css';
export default function Home() {
 const [screen,setScreen]=useState<'start'|'lobby'|'single'|'six'|'eight'|'hunt'>('start');
 const [name,setName]=useState('테스터1');
 const [repair,setRepair]=useState(false);
 const returnToLobby=useCallback(()=>setScreen('lobby'),[]);
 const notice=(msg:string,tone?:'info'|'win'|'lose')=>tone==='win'?toast.success(msg):tone==='lose'?toast.error(msg):toast(msg);
 if(screen==='hunt')return <HuntPrototype onExit={()=>setScreen('start')}/>;
 if(screen==='single')return <PokerTable userName={name.trim()||'플레이어'} onToast={notice} onMain={returnToLobby}/>;
 if(screen==='six'||screen==='eight')return <PokerTableSocket tableSize={screen==='six'?6:8} userName={name.trim()||'플레이어'} onToast={notice} onMain={returnToLobby}/>;
 if(screen==='start')return <main className="island-start">
  <div className="island-sign-scene" aria-label="Island Hold’em">
   <div className="island-neon-glow" aria-hidden="true"/>
   <h1 className="sr-only">Island Hold’em</h1>
   <div className="island-entry-buttons">
    <ActionSkinButton skin="blue" onClick={()=>setScreen('hunt')}>사냥하기</ActionSkinButton>
    <ActionSkinButton skin="red" onClick={()=>setScreen('lobby')}>주점 입장</ActionSkinButton>
   </div>
  </div>
  {repair&&<div className="island-modal" onClick={()=>setRepair(false)}><section role="dialog" aria-modal="true" aria-labelledby="hunting-title" onClick={e=>e.stopPropagation()}><h2 id="hunting-title">사냥하기 · 준비 중</h2><p>RPG 사냥 콘텐츠를 준비하고 있습니다.</p><button autoFocus onClick={()=>setRepair(false)}>확인</button></section></div>}
 </main>;
 return <main className="island-lobby">
  <button className="island-back" onClick={()=>setScreen('start')}>← 처음으로</button>
  <div className="island-lobby-content">
   <div className="island-host" role="img" aria-label="안내인 홍"/>
   <section className="island-welcome">
    <div className="island-dialogue"><span>HONG · 홍</span><h1>어서오세요.<br/>어디로 모실까요?</h1></div>
    <LobbyPanel onName={setName}/>
    <div className="island-modes">
     <button onClick={()=>setScreen('single')}><span>♠</span><strong>싱글 플레이</strong><small>AI 7명과 대전</small><em>SOLO TABLE</em></button>
     <button onClick={()=>setScreen('six')}><span>♣</span><strong>6인 서버</strong><small>실시간 멀티플레이</small><em>6 SEATS</em></button>
     <button aria-disabled="true" onClick={()=>setRepair(true)}><span>♦</span><strong>8인 서버</strong><small>Under Repair</small><em>이용 불가</em></button>
    </div>
    <button className="island-tournament" onClick={()=>setRepair(true)}><strong>6인 토너먼트</strong><span>50 BB 시작 · 준비 중</span></button>

   </section>
  </div>
  {repair&&<div className="island-modal" onClick={()=>setRepair(false)}><section role="dialog" aria-modal="true" aria-labelledby="repair-title" onClick={e=>e.stopPropagation()}><h2 id="repair-title">Under Repair</h2><p>해당 모드는 현재 점검 중입니다.</p><button autoFocus onClick={()=>setRepair(false)}>확인</button></section></div>}
 </main>;
}
