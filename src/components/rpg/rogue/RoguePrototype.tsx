'use client';
import {useEffect,useRef,useState} from 'react';
import type {RogueView} from '../../../lib/rpg-rogue-service';
import type {RogueInput} from './engine';
import type {RogueMap} from './map';
import '../hunt.css';
import './rogue.css';
const skills=[['대지 균열','SkillIcon_GroundRift'],['암흑 구체','SkillIcon_DarkHole'],['서리 폭풍','SkillIcon_Blizzard3'],['빛의 심판','SkillIcon_HolyWrath2'],['회오리','SkillIcon_Whirlwind'],['회복','SkillIcon_VitalRecovery']];
export function RoguePrototype({onExit}:{onExit:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>()),stick=useRef({x:0,y:0}),automatic=useRef(true),queue=useRef<Partial<RogueInput>[]>([]);
 const [view,setView]=useState<RogueView|null>(null),[map,setMap]=useState<RogueMap|null>(null),[state,setState]=useState('loading'),[error,setError]=useState(''),[run,setRun]=useState(0),[help,setHelp]=useState(false),[knob,setKnob]=useState({x:0,y:0}),[panel,setPanel]=useState<'weapons'|'growth'|'bag'|'quest'|null>(null);
 const uiBlocked=useRef(false);uiBlocked.current=help||panel!==null;
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
  const down=(e:KeyboardEvent)=>{if(uiBlocked.current)return;if(e.target instanceof HTMLElement&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const key=e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase();if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight',' ','Shift','shift','j','q','e','1','2','3','4','5','6'].includes(key)){e.preventDefault();keys.current.add(key);}if(e.repeat)return;if(key==='j')enqueue({jump:true});else if(key==='shift')enqueue({slide:true});else if(key==='q'||key==='e')enqueue({dodge:true,x:key==='q'?-1:1,y:0});else if(/^[1-6]$/.test(key))enqueue({skill:Number(key)-1});};
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
   <div className="rogue-room"><small>RANDOM DUNGEON</small><strong>방 {(view?.room??0)+1} <span>/ 10</span></strong><span>탐색 {view?.visited.length??1} · 정리 {view?.cleared.length??0}</span>{view?.auto&&<span>AUTO 목표 {Math.min(10,(view.autoRoom??0)+1)}번 방{view.autoRoom>=10?' → 출구':''}</span>}</div>
   <div className="rogue-objective">{view?.mobs.every(m=>m.hp<=0)?'모든 방을 살핀 뒤 청록색 출구로':'방과 통로를 탐색하며 몬스터를 처치하세요'}</div>
   {state==='loading'&&<div className="rogue-overlay" role="status"><strong>10개의 방을 연결하는 중…</strong><span>원본 캐릭터와 몬스터를 불러옵니다.</span></div>}
   {(state==='error'||view?.status==='dead'||view?.status==='won')&&<div className="rogue-overlay" role="dialog" aria-label="던전 결과"><h2>{state==='error'?'연결 오류':view?.status==='won'?'미궁 탈출 성공':'전투 불능'}</h2><p>{state==='error'?error:`${view?.kills}마리 처치 · 테스트 골드 ${view?.gold}`}</p><button onClick={()=>setRun(n=>n+1)}>새 던전 생성</button><button onClick={onExit}>캐릭터 선택</button></div>}
   {help&&<div className="rogue-help"><strong>10개 방 자유 탐험</strong><p>WASD / 방향키 또는 원형 스틱으로 상하좌우 이동합니다. AUTO는 1~10번 방을 순서대로 이동하며 사냥합니다.</p><p>Space 공격 · Q/E 회피 · J 점프 · Shift 슬라이딩 · 1~6 스킬</p><p>몬스터는 다시 생성되지 않습니다. 10개 방을 정리하고 출구에 도착하면 완료됩니다.</p><button onClick={()=>setHelp(false)}>닫기</button></div>}
  </section>
  <div className="rogue-lower hunt-lower">
  <section className="rogue-console hunt-console" aria-label="로그라이크 조작" inert={panel!==null}>
   <div className="hunt-vitals"><div><span>HP</span><meter aria-label="홍 체력" min={0} max={view?.hero.maxHP??10000} value={view?.hero.hp??10000}/></div><div><span>ROOM</span><progress aria-label="방 정리 진행" max={10} value={view?.cleared.length??0}/><small>{view?.cleared.length??0}/10</small></div></div>
   <div className="hunt-skill-row">{skills.map(([label,icon],i)=><button className="hunt-skill" key={label} aria-label={label} aria-pressed={view?.pendingSkill===i} disabled={!active} title="누르면 다음 시전 예약" onClick={()=>enqueue({skill:i})}><img src={'/rpg/'+icon+'.png'} alt=""/><span>{(view?.cooldowns[i]??0)>0?Math.ceil(view!.cooldowns[i]):i+1}</span>{view?.pendingSkill===i&&<b className="hunt-skill-reserved">예약</b>}</button>)}</div>
   <div className="hunt-mode-row"><span>테스트 런 · 방 {view?.cleared.length??0}/10</span><button disabled={!active} aria-pressed={view?.auto??true} onClick={()=>{automatic.current=!automatic.current;}}>AUTO {view?.auto?'ON':'OFF'}</button><button onClick={()=>setRun(n=>n+1)}>새 미궁</button></div>
   <div className="hunt-controls">
    <button className="hunt-dodge" aria-label="왼쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:-1,y:0})}>↶</button>
    <div className="rogue-mobility"><button aria-label="점프" title="점프 · J" disabled={!active||!view?.jumpReady} onClick={()=>enqueue({jump:true})}>↑</button><button aria-label="슬라이딩" title="슬라이딩 · Shift" disabled={!active||!view?.slideReady} onClick={()=>enqueue({slide:true})}>⇥</button></div>
    <div className="hunt-joystick" aria-label="상하좌우 이동" role="group" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span className="hunt-stick-rail">✥</span><i className="hunt-stick" style={{transform:`translate(${knob.x*30}px,${knob.y*30}px)`}}/></div>
    <button className="hunt-dodge" aria-label="오른쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:1,y:0})}>↷</button>
   </div>
   {error&&state==='ready'&&<p className="rogue-error" role="status">{error}</p>}
  </section>
  {panel&&<section className="hunt-window rogue-panel" role="dialog" aria-modal="true" aria-label={{weapons:'무기',growth:'성장 · 장비',bag:'가방',quest:'사냥 의뢰'}[panel]}><h2>{{weapons:'무기',growth:'성장 · 장비',bag:'가방',quest:'사냥 의뢰'}[panel]}</h2>
   {panel==='weapons'&&<><p>현재 로그라이크 테스트 무기: 홍의 도끼</p><p>원본 5타 콤보와 점프·슬라이딩 모션을 사용합니다.</p></>}
   {panel==='growth'&&<><p>테스트 HP 10,000 · 일반 공격 50</p><p>기존 성장·장비 저장은 유지됩니다. 이 테스트 런에는 영구 성장과 강화 구매를 연결하지 않았습니다.</p></>}
   {panel==='bag'&&<><p>이번 런 골드: {view?.gold??0}</p><p>던전 시드: {map?.seed??'—'}</p><p>몬스터 처치: {view?.kills??0}</p><p>기존 계정 재화와 분리된 테스트 기록입니다.</p></>}
   {panel==='quest'&&<><p>10개 방 정리 후 출구 도착</p><p>현재 정리: {view?.cleared.length??0}/10 · 남은 적: {view?.mobs.filter(m=>m.hp>0).length??0}</p><p>AUTO는 1번부터 10번 방 순서로 사냥하고 마지막에 출구로 이동합니다.</p></>}
   <button autoFocus onClick={()=>setPanel(null)}>닫기</button>
  </section>}
  </div>
  <footer className="rogue-footer hunt-footer"><button aria-pressed={panel==='weapons'} onClick={()=>setPanel(panel==='weapons'?null:'weapons')}>무기</button><button aria-pressed={panel==='growth'} onClick={()=>setPanel(panel==='growth'?null:'growth')}>성장 · 장비</button><button aria-pressed={panel==='bag'} onClick={()=>setPanel(panel==='bag'?null:'bag')}>가방</button><button aria-pressed={!panel} onClick={()=>setPanel(null)}>✦ 탐험</button><button aria-pressed={panel==='quest'} onClick={()=>setPanel(panel==='quest'?null:'quest')}>사냥 의뢰</button></footer>
 </main>;
}
