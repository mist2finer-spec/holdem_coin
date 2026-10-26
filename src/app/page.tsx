"use client";
import {useState,useCallback,useEffect} from 'react';
import {setPokerAudioScene} from '@/lib/poker-audio';
import {PokerAudioControl} from '@/components/poker/PokerAudioControl';
import dynamic from 'next/dynamic';
const HuntEntry = dynamic(()=>import('@/components/rpg/HuntEntry').then(m=>m.HuntEntry),{ssr:false});
import {TournamentLobbyButton} from '@/components/poker/TournamentLobbyButton';
import {LobbyPanel} from '@/components/poker/LobbyPanel';
import {PokerTable} from '@/components/poker/PokerTable';
import {PokerTableSocket} from '@/components/poker/PokerTableSocket';
import {ActionSkinButton} from '@/components/poker/ActionSkinButton';
import {toast} from 'sonner';
import '@/components/poker/island.css';
export default function Home() { return <><PokerAudioControl/><HomeContent/></>; }
function HomeContent() {
 const [screen,setScreen]=useState<'start'|'lobby'|'single'|'six'|'eight'|'hunt'|'tournament'>('start');
 const go=useCallback((next:typeof screen)=>{
  setPokerAudioScene(next==='start'?'start':next==='lobby'?'lobby':['single','six','eight','tournament'].includes(next)?'table':null);
  setScreen(next);
 },[]);
 useEffect(()=>{setPokerAudioScene(screen==='start'?'start':screen==='lobby'?'lobby':['single','six','eight','tournament'].includes(screen)?'table':null);},[screen]);
 const [name,setName]=useState('테스터1');
 const [repair,setRepair]=useState(false);
 const returnToLobby=useCallback(()=>go('lobby'),[go]);
 const notice=(msg:string,tone?:'info'|'win'|'lose')=>tone==='win'?toast.success(msg):tone==='lose'?toast.error(msg):toast(msg);
 if(screen==='hunt')return <HuntEntry onExit={()=>go('start')}/>;
 if(screen==='single')return <PokerTable userName={name.trim()||'플레이어'} onToast={notice} onMain={returnToLobby}/>;
 if(screen==='tournament')return <PokerTableSocket tournament tableSize={8} userName={name.trim()||'플레이어'} onToast={notice} onMain={returnToLobby}/>;
 if(screen==='six'||screen==='eight')return <PokerTableSocket tableSize={screen==='six'?6:8} userName={name.trim()||'플레이어'} onToast={notice} onMain={returnToLobby}/>;
 if(screen==='start')return <main className="island-start">
  <div className="island-sign-scene" aria-label="Island Hold’em">
   <div className="island-neon-glow" aria-hidden="true"/>
   <h1 className="sr-only">Island Hold’em</h1>
   <div className="island-entry-buttons">
    <ActionSkinButton skin="blue" onClick={()=>go('hunt')}>사냥하기</ActionSkinButton>
    <ActionSkinButton skin="red" onClick={()=>go('lobby')}>주점 입장</ActionSkinButton>
   </div>
  </div>
 </main>;
 return <main className="island-lobby">
  <button className="island-back" onClick={()=>go('start')}>← 처음으로</button>
  <div className="island-lobby-content">
   <div className="island-host" role="img" aria-label="안내인 홍"/>
   <section className="island-welcome">
    <div className="island-dialogue"><span>HONG · 홍</span><h1>어서오세요.<br/>어디로 모실까요?</h1></div>
    <LobbyPanel onName={setName}/>
    <div className="island-modes">
     <button onClick={()=>go('single')}><span>♠</span><strong>싱글 플레이</strong><small>AI 7명과 대전</small><em>SOLO TABLE</em></button>
     <button onClick={()=>go('six')}><span>♣</span><strong>6인 서버</strong><small>실시간 멀티플레이</small><em>6 SEATS</em></button>
     <button aria-disabled="true" onClick={()=>setRepair(true)}><span>♦</span><strong>8인 서버</strong><small>Under Repair</small><em>이용 불가</em></button>
    </div>
    <TournamentLobbyButton onEnter={()=>go('tournament')}/>

   </section>
  </div>
  {repair&&<div className="island-modal" onClick={()=>setRepair(false)}><section role="dialog" aria-modal="true" aria-labelledby="repair-title" onClick={e=>e.stopPropagation()}><h2 id="repair-title">Under Repair</h2><p>해당 모드는 현재 점검 중입니다.</p><button autoFocus onClick={()=>setRepair(false)}>확인</button></section></div>}
 </main>;
}
