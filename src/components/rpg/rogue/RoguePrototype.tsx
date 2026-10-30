'use client';
import {useEffect,useRef,useState} from 'react';
import type {RogueView} from '../../../lib/rpg-rogue-service';
import type {RogueInput} from './engine';
import type {RogueMap} from './map';
import {PASSAGE_LABEL} from './traversal';
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
 useEffect(()=>{if(help||panel){keys.current.clear();stick.current={x:0,y:0};queue.current=[];setKnob({x:0,y:0});}},[help,panel]);
 const active=state==='ready'&&view?.status==='playing';
 const clearedRoom=view?.cleared.at(-1);
 const boss=view?.mobs.find(m=>m.boss&&m.hp>0&&m.room===view.room);
 const remaining=view?.mobs.filter(m=>m.room===view.room&&m.hp>0).length??0;
 const passage=view?.gate?PASSAGE_LABEL[view.gate.passage]:'이동';
 const statusText=view?.phase==='traversing'?`${passage} 통과 · 다음 구역으로 이동`:
  view?.phase==='exit-ready'?view.gate?`${view.auto?'AUTO · ':''}오른쪽 출구에서 ${passage}${view.gate.near?' 버튼을 누르세요':'로 통과'}`:'오른쪽 최종 출구로 이동':
  `${(view?.room??0)+1}번 구역 · 남은 적 ${remaining}${view?.auto?' · AUTO 전투':''}`;

 const move=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.32),y=(e.clientY-r.top-r.height/2)/(r.height*.32),length=Math.max(1,Math.hypot(x,y)),p={x:x/length,y:y/length};stick.current=Math.hypot(x,y)<.15?{x:0,y:0}:p;setKnob(stick.current);};
 const release=()=>{stick.current={x:0,y:0};setKnob(stick.current);};
 return <main className="rogue-shell rogue-vardian">
  <header className="rogue-header"><button onClick={onExit} aria-label="캐릭터 선택으로 돌아가기">‹</button><div><small>LABYRINTH · PROTOTYPE</small><strong>촛불 미궁</strong></div><span className="rogue-gold" title="이번 탐험의 테스트 골드">◈ {(view?.gold??0).toLocaleString()} <small>G</small></span><button onClick={()=>setHelp(!help)} aria-label="조작 도움말" aria-expanded={help}>?</button></header>
  <section className="rogue-stage" aria-label="구역 진행형 촛불 던전"><canvas ref={canvas} aria-label="홍과 10개 전투 구역" data-status={state} onClick={()=>{if(active&&!help&&!panel)enqueue({attack:true});}}/>
   <div className="rogue-room"><small>CHAMBER</small><strong>{String((view?.room??0)+1).padStart(2,'0')} <span>/ 10</span></strong><span>{boss?'슬라임 군주':view?.phase==='exit-ready'?'출구 개방':'촛불의 전투 구역'}</span></div>
   {boss&&<div className="rogue-boss"><span>슬라임 군주</span><meter aria-label="슬라임 군주 체력" min={0} max={boss.maxHP} value={boss.hp}/></div>}
   {clearedRoom!==undefined&&<div key={clearedRoom} className="rogue-clear" aria-live="polite"><small>CHAMBER CLEAR</small><strong>{clearedRoom+1}번 구역 정리</strong></div>}
   <div className="rogue-objective"><span>{statusText}</span><div className="rogue-room-track" aria-label={`구역 정리 ${view?.cleared.length??0} / 10`}>{Array.from({length:10},(_,i)=><i key={i} className={view?.cleared.includes(i)?'cleared':view?.room===i?'current':''}>{i+1}</i>)}</div></div>
   {state==='loading'&&<div className="rogue-overlay" role="status"><strong>전투 구역과 통과로를 준비하는 중…</strong><span>원본 캐릭터와 몬스터를 불러옵니다.</span></div>}
   {(state==='error'||view?.status==='dead'||view?.status==='won')&&<div className="rogue-overlay" role="dialog" aria-label="던전 결과"><h2>{state==='error'?'연결 오류':view?.status==='won'?'미궁 탈출 성공':'전투 불능'}</h2><p>{state==='error'?error:`${view?.kills}마리 처치 · 테스트 골드 ${view?.gold}`}</p><button onClick={()=>setRun(n=>n+1)}>새 던전 생성</button><button onClick={onExit}>캐릭터 선택</button></div>}
   {help&&<div className="rogue-help"><strong>촛불 미궁 · 조작 안내</strong><p>WASD / 방향키 또는 원형 스틱으로 상하좌우 이동합니다. AUTO는 구역별 전투 후 틈 건너기·하강·상승 점프와 낮은 통로 슬라이딩으로 다음 구역에 진입합니다.</p><p>전투 화면 터치 / Space 기본 공격 · Q/E 좌우 회피 · J 점프 · Shift 슬라이딩 · 1~6 스킬</p><p>구역에 들어가면 몬스터가 한 무리 생성됩니다. 모두 처치하면 오른쪽 출구가 열립니다. 출구의 원형 발판 가까이에서 점프 또는 슬라이딩 버튼을 누르세요. 높은 구간에서는 중간 발판을 거쳐 연속으로 올라갑니다. 10구역 정리 후 탈출합니다.</p><button onClick={()=>setHelp(false)}>닫기</button></div>}
  </section>
  <div className="rogue-lower hunt-lower">
  <section className="rogue-console hunt-console" aria-label="로그라이크 조작" inert={panel!==null}>
   <div className="hunt-vitals"><div><span>HP</span><meter aria-label="홍 체력" min={0} max={view?.hero.maxHP??10000} value={view?.hero.hp??10000}/></div><div><span>ROOM</span><progress aria-label="방 정리 진행" max={10} value={view?.cleared.length??0}/><small>{view?.cleared.length??0}/10</small></div></div>
   <div className="hunt-skill-row">{skills.map(([label,icon],i)=><button className="hunt-skill" key={label} aria-label={label} aria-pressed={view?.pendingSkill===i} disabled={!active} title="누르면 다음 시전 예약" onClick={()=>enqueue({skill:i})}><img src={'/rpg/'+icon+'.png'} alt=""/><span>{(view?.cooldowns[i]??0)>0?Math.ceil(view!.cooldowns[i]):i+1}</span>{view?.pendingSkill===i&&<b className="hunt-skill-reserved">예약</b>}</button>)}</div>
   <div className="hunt-mode-row"><span>처치 <b>{view?.kills??0}</b> · 정리 <b>{view?.cleared.length??0}/10</b></span><button disabled={!active} aria-pressed={view?.auto??true} onClick={()=>{automatic.current=!automatic.current;}}>AUTO {view?.auto?'ON':'OFF'}</button></div>
   <div className="hunt-controls">
    <button className="hunt-dodge" aria-label="왼쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:-1,y:0})}>↶<small>회피</small></button>
    <div className="rogue-mobility"><button className={view?.gate?.ready&&view.gate.near&&view.gate.kind==='jump'?'gate-ready':''} aria-label="점프" title="점프 · J" disabled={!active||!view?.jumpReady} onClick={()=>enqueue({jump:true})}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 26h20M16 22V7m-7 7 7-7 7 7"/></svg><small>점프</small></button><button className={view?.gate?.ready&&view.gate.near&&view.gate.kind==='slide'?'gate-ready':''} aria-label="슬라이딩" title="슬라이딩 · Shift" disabled={!active||!view?.slideReady} onClick={()=>enqueue({slide:true})}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26h24M5 21h15l7-6-7-6m-11 6h17M5 9h6"/></svg><small>슬라이드</small></button></div>
    <div className="hunt-joystick" aria-label="상하좌우 이동" role="group" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span className="hunt-stick-rail">✥</span><i className="hunt-stick" style={{transform:`translate(${knob.x*30}px,${knob.y*30}px)`}}/></div>
    <button className="hunt-dodge" aria-label="오른쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:1,y:0})}>↷<small>회피</small></button>
   </div>
   {error&&state==='ready'&&<p className="rogue-error" role="status">{error}</p>}
  </section>
  {panel&&<section className="hunt-window rogue-panel" role="dialog" aria-modal="true" aria-label={{weapons:'무기',growth:'성장 · 장비',bag:'가방',quest:'사냥 의뢰'}[panel]}><h2>{{weapons:'무기',growth:'성장 · 장비',bag:'가방',quest:'사냥 의뢰'}[panel]}</h2>
   {panel==='weapons'&&<><p>현재 로그라이크 테스트 무기: 홍의 도끼</p><p>원본 5타 콤보와 점프·슬라이딩 모션을 사용합니다.</p></>}
   {panel==='growth'&&<><p>테스트 HP 10,000 · 일반 공격 50</p><p>기존 성장·장비 저장은 유지됩니다. 이 테스트 런에는 영구 성장과 강화 구매를 연결하지 않았습니다.</p></>}
   {panel==='bag'&&<><p>이번 런 골드: {view?.gold??0}</p><p>던전 시드: {map?.seed??'—'}</p><p>몬스터 처치: {view?.kills??0}</p><p>기존 계정 재화와 분리된 테스트 기록입니다.</p></>}
   {panel==='quest'&&<><p>10개 전투 구역 정리 후 탈출</p><p>현재 정리: {view?.cleared.length??0}/10 · 현재 구역 남은 적: {remaining}</p><p>AUTO는 1~10구역 순서로 사냥하며 열린 출구를 점프·슬라이딩으로 통과합니다.</p></>}
   <button autoFocus onClick={()=>setPanel(null)}>닫기</button>
  </section>}
  </div>
  <footer className="rogue-footer hunt-footer"><button aria-pressed={panel==='weapons'} onClick={()=>setPanel(panel==='weapons'?null:'weapons')}>무기</button><button aria-pressed={panel==='growth'} onClick={()=>setPanel(panel==='growth'?null:'growth')}>성장 · 장비</button><button aria-pressed={panel==='bag'} onClick={()=>setPanel(panel==='bag'?null:'bag')}>가방</button><button aria-pressed={!panel} onClick={()=>setPanel(null)}>✦ 탐험</button><button aria-pressed={panel==='quest'} onClick={()=>setPanel(panel==='quest'?null:'quest')}>사냥 의뢰</button></footer>
 </main>;
}
