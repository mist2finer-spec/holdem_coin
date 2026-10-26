"use client";
import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';
import {pokerSocketOptions} from '@/lib/lobby-client';
import {tournamentTime,type TournamentStatus} from '@/lib/poker-tournament';
type Status=TournamentStatus&{serverNow:number;handNumber:number};
export function TournamentLobbyButton({onEnter}:{onEnter:()=>void}){
 const [state,setState]=useState<Status|null>(null),[clock,setClock]=useState(0),[offset,setOffset]=useState(0);
 useEffect(()=>{
  const {host,options}=pokerSocketOptions(),socket=io(host,options);
  let alive=true,pending=false;
  const poll=async()=>{if(!socket.connected||pending)return;pending=true;try{const result:Status=await socket.timeout(5000).emitWithAck('GET_TOURNAMENT_STATUS');if(alive){setState(result);setOffset(result.serverNow-Date.now());setClock(Date.now());}}catch{}finally{pending=false;}};
  socket.on('connect',poll);const timer=setInterval(()=>{setClock(Date.now());void poll();},1000);
  return()=>{alive=false;clearInterval(timer);socket.disconnect();};
 },[]);
 const now=clock+offset,cooling=state?.status==='finished';
 const detail=!state?'서버 상태 확인 중':state.status==='waiting'?'입장 대기 · 입장하면 10초 후 시작':state.status==='countdown'?`시작까지 ${Math.max(0,Math.ceil(((state.startsAt??now)-now)/1000))}초`:cooling?`다음 대회까지 ${tournamentTime(Math.ceil(((state.nextTournamentAt??now)-now)/1000))}`:`진행 ${tournamentTime((now-(state.startedAt??now))/1000)} · Round ${state.level} · 핸드 #${state.handNumber} · ${state.remaining}/8명`;
 return <button className="island-tournament" disabled={!state||cooling} onClick={onEnter}><strong>8인 토너먼트</strong><span>{detail}<br/>100 BB · 5분 블라인드 · 리바인 불가</span></button>;
}
