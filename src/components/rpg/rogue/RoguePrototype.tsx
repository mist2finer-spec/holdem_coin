'use client';
import {useEffect,useRef,useState} from 'react';
import type {RogueView} from '../../../lib/rpg-rogue-service';
import type {RogueInput} from './engine';
import type {RogueMap} from './map';
import './rogue.css';
export function RoguePrototype({onExit}:{onExit:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>()),stick=useRef({x:0,y:0}),automatic=useRef(true),queue=useRef<Partial<RogueInput>[]>([]);
 const [view,setView]=useState<RogueView|null>(null),[map,setMap]=useState<RogueMap|null>(null),[state,setState]=useState('loading'),[error,setError]=useState(''),[run,setRun]=useState(0),[help,setHelp]=useState(false),[knob,setKnob]=useState({x:0,y:0});
 const enqueue=(command:Partial<RogueInput>)=>{if(queue.current.length<6)queue.current.push(command);};
 useEffect(()=>{
  const controller=new AbortController();let renderer:Awaited<ReturnType<typeof import('./renderer').createRogueRenderer>>|undefined,frame=0,timer:ReturnType<typeof setInterval>|undefined,inFlight=false,target:RogueView|null=null,last=0,sequence=0,id='',retry:Record<string,unknown>|null=null;
  const reset=()=>{keys.current.clear();stick.current={x:0,y:0};queue.current=[];setKnob({x:0,y:0});};reset();automatic.current=true;setState('loading');setError('');setView(null);setMap(null);
  const request=async(body:Record<string,unknown>)=>{const r=await fetch('/api/rpg/rogue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'던전 연결 오류');return data as RogueView;};
  const apply=(v:RogueView)=>{target=v;sequence=v.sequence;id=v.id;setView(v);};
  const pump=async()=>{if(inFlight||!id||controller.signal.aborted||target&&target.status!=='playing')return;inFlight=true;const k=keys.current,x=(k.has('d')||k.has('ArrowRight')?1:0)-(k.has('a')||k.has('ArrowLeft')?1:0),y=(k.has('s')||k.has('ArrowDown')?1:0)-(k.has('w')||k.has('ArrowUp')?1:0);
   const body=retry||{action:'tick',id,sequence:sequence+1,input:{x:document.hidden?0:x||stick.current.x,y:document.hidden?0:y||stick.current.y,auto:!document.hidden&&automatic.current,attack:!document.hidden&&k.has(' '),...queue.current.shift()}};
   try{const v=await request(body);if(controller.signal.aborted)return;retry=null;apply(v);setError('');}catch(e){if(!controller.signal.aborted){retry=body;setError(e instanceof Error?e.message:'연결 재시도 중');}}finally{inFlight=false;}
  };
  const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const key=e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase();if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight',' ','Shift','shift','j','1','2','3'].includes(key)){e.preventDefault();keys.current.add(key);}if(e.repeat)return;if(key==='j')enqueue({jump:true});else if(key==='shift')enqueue({dodge:true});else if(/^[1-3]$/.test(key))enqueue({skill:Number(key)-1});};
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase());
  const blur=()=>{reset();automatic.current=false;};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);
  (async()=>{const v=await request({action:'start',character:'hong'});if(!v.map)throw Error('던전 지도를 읽지 못했습니다.');setMap(v.map);renderer=await import('./renderer').then(m=>m.createRogueRenderer(canvas.current!,v.map!,controller.signal));if(controller.signal.aborted){renderer?.dispose();return;}apply(v);setState('ready');timer=setInterval(()=>void pump(),100);
   const loop=(now:number)=>{const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(target&&!document.hidden)renderer?.draw(target,dt);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
  })().catch(e=>{if(!controller.signal.aborted){setState('error');setError(String(e));}});
  return()=>{controller.abort();if(timer)clearInterval(timer);cancelAnimationFrame(frame);renderer?.dispose();reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);};
 },[run]);
 const active=state==='ready'&&view?.status==='playing';
 const move=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.32),y=(e.clientY-r.top-r.height/2)/(r.height*.32),length=Math.max(1,Math.hypot(x,y)),p={x:x/length,y:y/length};stick.current=Math.hypot(x,y)<.15?{x:0,y:0}:p;setKnob(stick.current);};
 const release=()=>{stick.current={x:0,y:0};setKnob(stick.current);};
 return <main className="rogue-shell">
  <header className="rogue-header"><button onClick={onExit}>← 캐릭터 선택</button><strong>촛불 미궁</strong><button onClick={()=>setHelp(!help)} aria-expanded={help}>?</button></header>
  <section className="rogue-stage" aria-label="상하좌우 로그라이크 던전"><canvas ref={canvas} aria-label="홍과 10개 방 던전" data-status={state}/>
   <div className="rogue-room"><small>RANDOM DUNGEON</small><strong>방 {(view?.room??0)+1} <span>/ 10</span></strong><span>탐색 {view?.visited.length??1} · 정리 {view?.cleared.length??0}</span></div>
   <div className="rogue-objective">{view?.mobs.every(m=>m.hp<=0)?'모든 방을 살핀 뒤 청록색 출구로':'방과 통로를 탐색하며 몬스터를 처치하세요'}</div>
   {state==='loading'&&<div className="rogue-overlay" role="status"><strong>10개의 방을 연결하는 중…</strong><span>원본 캐릭터와 몬스터를 불러옵니다.</span></div>}
   {(state==='error'||view?.status==='dead'||view?.status==='won')&&<div className="rogue-overlay" role="dialog" aria-label="던전 결과"><h2>{state==='error'?'연결 오류':view?.status==='won'?'미궁 탈출 성공':'전투 불능'}</h2><p>{state==='error'?error:`${view?.kills}마리 처치 · 테스트 골드 ${view?.gold}`}</p><button onClick={()=>setRun(n=>n+1)}>새 던전 생성</button><button onClick={onExit}>캐릭터 선택</button></div>}
   {help&&<div className="rogue-help"><strong>10개 방 자유 탐험</strong><p>WASD / 방향키 또는 원형 스틱으로 상하좌우 이동합니다. 가까운 적은 AUTO로 공격합니다.</p><p>Space 공격 · Shift 회피 · J 점프 · 1~3 스킬</p><p>몬스터는 다시 생성되지 않습니다. 10개 방을 정리하고 출구에 도착하면 완료됩니다.</p><button onClick={()=>setHelp(false)}>닫기</button></div>}
  </section>
  <section className="rogue-console" aria-label="로그라이크 조작">
   <div className="rogue-vitals"><span>HP</span><meter aria-label="홍 체력" min={0} max={view?.hero.maxHP??10000} value={view?.hero.hp??10000}/><span>✦ {view?.kills??0}</span><span>◈ {view?.gold??0}</span></div>
   <div className="rogue-skills">{[['대지 균열','SkillIcon_GroundRift'],['전방 충격','SkillIcon_HolyWrath2'],['회복','SkillIcon_VitalRecovery']].map(([label,icon],i)=><button key={label} aria-label={label} disabled={!active||(view?.cooldowns[i]??0)>0} onClick={()=>enqueue({skill:i})}><img src={'/rpg/'+icon+'.png'} alt=""/>{(view?.cooldowns[i]??0)>0&&<b>{Math.ceil(view!.cooldowns[i])}</b>}<span>{i+1} · {label}</span></button>)}</div>
   <div className="rogue-combat-controls"><div className="rogue-joystick" aria-label="상하좌우 이동" role="group" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span className="rogue-axis">✥</span><i style={{transform:`translate(${knob.x*30}px,${knob.y*30}px)`}}/></div><div className="rogue-buttons"><button aria-label="점프" disabled={!active||!view?.jumpReady} onClick={()=>enqueue({jump:true})}>↑<small>점프</small></button><button aria-label="회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true})}>↷<small>회피</small></button><button aria-label="일반 공격" disabled={!active} onClick={()=>enqueue({attack:true})}>⚔<small>공격</small></button></div></div>
   <div className="rogue-run-options"><button disabled={!active} aria-pressed={view?.auto??true} onClick={()=>{automatic.current=!automatic.current;}}>AUTO {view?.auto?'ON':'OFF'}</button><span>몬스터 {view?.mobs.filter(m=>m.hp>0).length??0} · 방 {view?.cleared.length??0}/10</span><button onClick={()=>setRun(n=>n+1)}>새 미궁</button></div>
   {error&&state==='ready'&&<p className="rogue-error" role="status">{error}</p>}
  </section>
  <footer className="rogue-footer">테스트 런 · 기존 성장/재화와 별도 <span>SEED {map?.seed??'—'}</span></footer>
 </main>;
}
