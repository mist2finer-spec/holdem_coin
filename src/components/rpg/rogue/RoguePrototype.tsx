'use client';
import {useEffect,useRef,useState} from 'react';
import {BuildInventory} from '../BuildInventory';
import {GemCorePanel} from '../GemCorePanel';
import type {RogueAction} from '../../../lib/rpg-rogue-service';
import type {RogueView} from '../../../lib/rpg-rogue-service';
import type {RogueInput} from './engine';
import type {RogueMap} from './map';
import {ResourceHud} from './ResourceHud';
import {roguePollDelay} from './pace';
import {SCENERY_LABELS} from './scenery';
import {THEME_LABELS} from './encounters';
import {PASSAGE_LABEL} from './traversal';
import '../hunt.css';
import './rogue.css';
const skills=[['대지 균열','SkillIcon_GroundRift'],['암흑 구체','SkillIcon_DarkHole'],['서리 폭풍','SkillIcon_Blizzard3'],['빛의 심판','SkillIcon_HolyWrath2'],['회오리','SkillIcon_Whirlwind'],['회복','SkillIcon_VitalRecovery']];
export function RoguePrototype({onExit}:{onExit:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>()),stick=useRef({x:0,y:0}),automatic=useRef(true),queue=useRef<(Partial<RogueInput>&{action?:RogueAction})[]>([]);
 const [view,setView]=useState<RogueView|null>(null),[map,setMap]=useState<RogueMap|null>(null),[state,setState]=useState('loading'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[run,setRun]=useState(0),[help,setHelp]=useState(false),[knob,setKnob]=useState({x:0,y:0}),[panel,setPanel]=useState<'weapons'|'growth'|'training'|'bag'|'quest'|null>(null);
 const flush=useRef(()=>{});
 const uiBlocked=useRef(false);uiBlocked.current=help||panel!==null;
 const enqueue=(command:Partial<RogueInput>)=>{if(queue.current.length<6){queue.current.push(command);flush.current();}};
 useEffect(()=>{
  const controller=new AbortController();let renderer:Awaited<ReturnType<typeof import('./renderer').createRogueRenderer>>|undefined,frame=0,timer:ReturnType<typeof setTimeout>|undefined,inFlight=false,target:RogueView|null=null,last=0,sequence=0,id='',retry:Record<string,unknown>|null=null,lastSent=0,retryDelay=0,retryAt=0;
  const reset=()=>{keys.current.clear();stick.current={x:0,y:0};queue.current=[];setKnob({x:0,y:0});};reset();automatic.current=true;setState('loading');setError('');setView(null);setMap(null);
  const request=async(body:Record<string,unknown>)=>{
   const requestController=new AbortController(),abort=()=>requestController.abort();
   if(controller.signal.aborted)abort();else controller.signal.addEventListener('abort',abort,{once:true});
   const timeout=setTimeout(abort,body.action==='start'?20000:5000);
   try{const r=await fetch('/api/rpg/rogue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:requestController.signal});const data=await r.json();if(!r.ok){const e=new Error(data.error||'던전 연결 오류') as Error&{terminal?:boolean};e.terminal=r.status<500;throw e;}return data as RogueView;}
   finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);}
  };
  const apply=(v:RogueView)=>{target=v;sequence=v.sequence;id=v.id;setView(v);};
  const input=():RogueInput=>{const k=keys.current,x=(k.has('d')||k.has('ArrowRight')?1:0)-(k.has('a')||k.has('ArrowLeft')?1:0);return {paused:uiBlocked.current,x:document.hidden||uiBlocked.current?0:x||stick.current.x,y:0,auto:!document.hidden&&!uiBlocked.current&&automatic.current,attack:!document.hidden&&!uiBlocked.current&&k.has(' ')};};
  const schedule=()=>{if(controller.signal.aborted||!id||inFlight||target&&target.status!=='playing')return;if(timer)clearTimeout(timer);timer=setTimeout(()=>void pump(),roguePollDelay(lastSent,performance.now(),retryAt,document.hidden));};
  flush.current=schedule;
  const pump=async()=>{if(inFlight||!id||controller.signal.aborted||target&&target.status!=='playing')return;inFlight=true;lastSent=performance.now();
   const command=retry?{}:queue.current.shift()??{};
   const body=retry||{action:command.action??'tick',id,sequence:sequence+1,input:{...input(),...command,...(command.potion?{attack:false}:{})}};
   try{const v=await request(body);if(controller.signal.aborted)return;retry=null;retryDelay=0;retryAt=0;if(canvas.current)canvas.current.dataset.rttMs=String(Math.round(performance.now()-lastSent));apply(v);setError('');if(body.action!=='tick')setNotice('');}catch(e){if(!controller.signal.aborted){const terminal=(e as Error&{terminal?:boolean}).terminal;retry=terminal?null:body;retryDelay=terminal?0:Math.min(1000,Math.max(200,retryDelay*2));retryAt=terminal?0:performance.now()+retryDelay;const message=e instanceof Error?e.message:'연결 재시도 중';if(terminal&&/세션|다시 입장|다른 창/.test(message)){id='';setState('error');setError(message);}else if(terminal&&body.action!=='tick')setNotice(message);else setError(message);}}finally{inFlight=false;schedule();}
  };
  const down=(e:KeyboardEvent)=>{if(uiBlocked.current)return;if(e.target instanceof HTMLElement&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const key=e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase();if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight',' ','Shift','shift','j','q','e','z','x','1','2','3','4','5','6'].includes(key)){e.preventDefault();keys.current.add(key);}flush.current();if(e.repeat)return;if(key==='j'||key==='w'||key==='ArrowUp')enqueue({jump:true,branch:'upper'});else if(key==='s'||key==='ArrowDown')enqueue({jump:true,branch:'lower'});else if(key==='shift')enqueue({slide:true});else if(key==='q'||key==='e')enqueue({dodge:true,x:key==='q'?-1:1,y:0});else if(key==='z'||key==='x')enqueue({potion:key==='z'?'health':'mana'});else if(/^[1-6]$/.test(key))enqueue({skill:Number(key)-1});};
  const up=(e:KeyboardEvent)=>{keys.current.delete(e.key.toLowerCase().startsWith('arrow')?e.key:e.key.toLowerCase());flush.current();};
  const blur=()=>{reset();automatic.current=false;flush.current();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);
  (async()=>{const v=await request({action:'start',character:'hong'});if(!v.map)throw Error('던전 지도를 읽지 못했습니다.');setMap(v.map);renderer=await import('./renderer').then(m=>m.createRogueRenderer(canvas.current!,v.map!,controller.signal));if(controller.signal.aborted){renderer?.dispose();return;}apply(v);setState('ready');schedule();
   const loop=(now:number)=>{const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(target&&!document.hidden)renderer?.draw(target,dt,input());frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
  })().catch(e=>{if(!controller.signal.aborted){setState('error');setError(String(e));}});
  return()=>{controller.abort();flush.current=()=>{};if(timer)clearTimeout(timer);cancelAnimationFrame(frame);renderer?.dispose();reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);};
 },[run]);
 useEffect(()=>{if(help||panel){keys.current.clear();stick.current={x:0,y:0};queue.current=[];setKnob({x:0,y:0});flush.current();}},[help,panel]);
 const sendAction=(action:RogueAction)=>{if(queue.current.length<6){queue.current.push({action});flush.current();}};
 const active=state==='ready'&&view?.status==='playing';
 const clearedRoom=view?.cleared.at(-1);
 const boss=view?.mobs.find(m=>m.boss&&m.hp>0&&m.room===view.room);
 const remaining=view?.mobs.filter(m=>m.room===view.room&&m.hp>0).length??0;
 const passage=view?.gate?PASSAGE_LABEL[view.gate.passage]:'이동';
 const statusText=view?.phase==='traversing'?`${passage} 통과 · 다음 구역으로 이동`:
  view?.phase==='exit-ready'?view.gate?`${view.auto?'AUTO · ':''}오른쪽 출구에서 ${passage}${view.gate.near?' 버튼을 누르세요':'로 통과'}`:'오른쪽 최종 출구로 이동':
  `${(view?.room??0)+1}번 구역 · 생성 ${view?.wave.spawned??0}/${view?.wave.target??0} · 남은 적 ${remaining}${view?.auto?' · AUTO 전투':''}`;

 const move=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.32),y=(e.clientY-r.top-r.height/2)/(r.height*.32),length=Math.max(1,Math.hypot(x,y)),p={x:x/length,y:y/length};stick.current=Math.abs(x)<.15?{x:0,y:0}:{x:p.x,y:0};setKnob(stick.current);flush.current();};
 const release=()=>{stick.current={x:0,y:0};setKnob(stick.current);flush.current();};
 return <main className="rogue-shell rogue-vardian">
  <header className="rogue-header"><button onClick={onExit} aria-label="캐릭터 선택으로 돌아가기">‹</button><div><small>LABYRINTH · PROTOTYPE</small><strong>촛불 미궁</strong></div><span className="rogue-gold" title="이번 탐험의 테스트 골드">◈ {(view?.gold??0).toLocaleString()} <small>G</small></span><button onClick={()=>setHelp(!help)} aria-label="조작 도움말" aria-expanded={help}>?</button></header>
  <section className="rogue-stage" aria-label="구역 진행형 촛불 던전"><canvas ref={canvas} aria-label="홍과 10개 전투 구역" data-status={state} onClick={()=>{if(active&&!help&&!panel)enqueue({attack:true});}}/>
   <div className="rogue-room"><small>CHAMBER</small><strong>{String((view?.room??0)+1).padStart(2,'0')} <span>/ 10</span></strong><span>{boss?'슬라임 군주':view?.phase==='exit-ready'?'출구 개방':`${SCENERY_LABELS[map?.rooms[view?.room??0]?.scenery??'crypt']} · ${THEME_LABELS[map?.rooms[view?.room??0]?.theme??'red']}`}</span></div>
   {view?.defense&&view.defense.maxShield!=='0'&&<div className="rogue-es" role="progressbar" aria-label="에너지 보호막" aria-valuenow={Math.round(view.defense.shieldPercent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${view.defense.shieldPercent}%`}}/><span>{view.defense.chaosImmune?'카오스 면역 · 체력 1':'에너지 보호막'}</span></div>}
   <ResourceHud hp={view?.hero.hp??10000} maxHP={view?.hero.maxHP??10000} mana={view?.resources?.mana??100} maxMana={view?.resources?.maxMana??100} potions={view?.resources?.potions??{health:3,mana:3}} cooldowns={view?.resources?.potionCooldowns??{health:0,mana:0}} active={!!active&&!help&&!panel} onDrink={potion=>enqueue({potion})}/>
   {boss&&<div className="rogue-boss"><span>슬라임 군주</span><meter aria-label="슬라임 군주 체력" min={0} max={boss.maxHP} value={boss.hp}/></div>}
   {clearedRoom!==undefined&&<div key={clearedRoom} className="rogue-clear" aria-live="polite"><small>CHAMBER CLEAR</small><strong>{clearedRoom+1}번 구역 정리</strong></div>}
   {view?.phase==='exit-ready'&&view.choices.length>1&&view.gate?.near&&<div className="rogue-branches" aria-label="갈림길 선택"><button disabled={!active} onClick={()=>{automatic.current=false;enqueue({jump:true,branch:'upper',auto:false});}}>↑ 위쪽 길</button><button disabled={!active} onClick={()=>{automatic.current=false;enqueue({jump:true,branch:'lower',auto:false});}}>↓ 아래쪽 길</button></div>}
   <div className="rogue-objective"><span>{statusText}</span><div className="rogue-room-track" aria-label={`선택 경로 정리 ${view?.cleared.length??0} / 7`}>{Array.from({length:10},(_,i)=><i key={i} className={view?.cleared.includes(i)?'cleared':view?.room===i?'current':''}>{i+1}</i>)}</div></div>
   {state==='loading'&&<div className="rogue-overlay" role="status"><strong>전투 구역과 통과로를 준비하는 중…</strong><span>원본 캐릭터와 몬스터를 불러옵니다.</span></div>}
   {(state==='error'||view?.status==='dead'||view?.status==='won')&&<div className="rogue-overlay" role="dialog" aria-label="던전 결과"><h2>{state==='error'?'연결 오류':view?.status==='won'?'미궁 탈출 성공':'전투 불능'}</h2><p>{state==='error'?error:`${view?.kills}마리 처치 · 테스트 골드 ${view?.gold}`}</p><button onClick={()=>setRun(n=>n+1)}>새 던전 생성</button><button onClick={onExit}>캐릭터 선택</button></div>}
   {help&&<div className="rogue-help"><strong>촛불 미궁 · 조작 안내</strong><p>A/D · 좌우 방향키 또는 스틱으로 좌우 이동합니다. 상하 이동 입력은 사용하지 않습니다. 높이 변화는 연결 구간의 점프·하강에서만 일어납니다. AUTO는 구역별 전투 후 틈 건너기·하강·상승 점프와 낮은 통로 슬라이딩으로 다음 구역에 진입합니다.</p><p>전투 화면 터치 / Space 기본 공격 · Q/E 좌우 회피 · J 점프 · Shift 슬라이딩 · 1~6 스킬 · Z 체력 물약 · X 마나 물약</p><p>맵의 길이·높낮이·벽·장식은 시드마다 달라집니다. 입구 쪽에 후퇴할 공간이 있고 새 몬스터는 플레이어 가까이에 생성되지 않습니다. 구역마다 처음 30마리, 초기 수를 포함해 총 150~200마리가 약 55초 동안 출현합니다. 처치 제한 시간은 없습니다. 모든 적을 처치하면 출구가 열립니다. 갈림길은 위·아래 중 선택하며 AUTO는 위로 갑니다. W/↑는 위쪽, S/↓는 아래쪽 길입니다. 어느 길이든 공통 보스로 합류하고 선택 경로 7구역을 정리하면 탈출합니다.</p><button onClick={()=>setHelp(false)}>닫기</button></div>}
  </section>
  <div className="rogue-lower hunt-lower">
  <section className="rogue-console hunt-console" aria-label="로그라이크 조작" inert={panel!==null}>

   <div className="hunt-skill-row">{(view?.build.actives?.map(a=>[a.name,'SkillIcon_'+a.icon])??skills).map(([label,icon],i)=><button className="hunt-skill" key={label} aria-label={label} aria-pressed={view?.pendingSkill===i} disabled={!active} title="누르면 다음 시전 예약" onClick={()=>enqueue({skill:i})}><img src={'/rpg/'+icon+'.png'} alt=""/><span>{(view?.cooldowns[i]??0)>0?Math.ceil(view!.cooldowns[i]):i+1}</span>{view?.pendingSkill===i&&<b className="hunt-skill-reserved">예약</b>}</button>)}</div>
   <div className="hunt-mode-row"><span>게스트 빌드 저장 · <b>{view?.kills??0} 처치</b></span><button disabled={!active} aria-pressed={view?.auto??true} onClick={()=>{automatic.current=!automatic.current;flush.current();}}>AUTO {view?.auto?'ON':'OFF'}</button></div>
   <div className="hunt-controls">
    <button className="hunt-dodge" aria-label="왼쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:-1,y:0})}>↶<small>회피</small></button>
    <div className="rogue-mobility"><button className={view?.gate?.ready&&view.gate.near&&view.gate.kind==='jump'?'gate-ready':''} aria-label="점프" title="점프 · J" disabled={!active||!view?.jumpReady} onClick={()=>enqueue({jump:true})}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 26h20M16 22V7m-7 7 7-7 7 7"/></svg><small>점프</small></button><button className={view?.gate?.ready&&view.gate.near&&view.gate.kind==='slide'?'gate-ready':''} aria-label="슬라이딩" title="슬라이딩 · Shift" disabled={!active||!view?.slideReady} onClick={()=>enqueue({slide:true})}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26h24M5 21h15l7-6-7-6m-11 6h17M5 9h6"/></svg><small>슬라이드</small></button></div>
    <div className="hunt-joystick" aria-label="좌우 이동" role="group" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span className="hunt-stick-rail">↔</span><i className="hunt-stick" style={{transform:`translate(${knob.x*30}px,${knob.y*30}px)`}}/></div>
    <button className="hunt-dodge" aria-label="오른쪽 회피" disabled={!active||!view?.dodgeReady} onClick={()=>enqueue({dodge:true,x:1,y:0})}>↷<small>회피</small></button>
   </div>
   {error&&state==='ready'&&<p className="rogue-error" role="status">{error}</p>}
  </section>
  {panel&&<section className="hunt-window rogue-panel" role="dialog" aria-modal="true" aria-label={{weapons:'무기',growth:'젬 · 코어',training:'골드 성장',bag:'가방',quest:'사냥 의뢰'}[panel]}>{panel!=='growth'&&<h2>{{weapons:'무기',growth:'젬 · 코어',training:'골드 성장',bag:'가방',quest:'사냥 의뢰'}[panel]}</h2>}
   {panel==='weapons'&&<><button onClick={()=>setPanel('training')}>성장 · 골드 능력치</button><p>현재 로그라이크 테스트 무기: 홍의 도끼</p><p>원본 5타 콤보와 점프·슬라이딩 모션을 사용합니다.</p></>}
   {panel==='growth'&&view&&<GemCorePanel view={view.build} error={notice||error} onCommand={action=>{if(queue.current.length<6){queue.current.push({action});flush.current();}}} onClose={()=>setPanel(null)}/>}
   {panel==='training'&&view?.growth&&<><p>보유 골드: {view.growth.gold.toLocaleString()} G · 공격 수련 Lv.{view.growth.attack} · 체력 수련 Lv.{view.growth.health}</p><p>기존 바르디안 훈련 비용곡선 적용. 공격 수련은 전투 피해, 체력 수련은 받는 피해 감소에 적용됩니다. 현재 테스트 기본 체력은 10,000이며, 생명력 노드와 카오스 면역은 별도로 적용됩니다. 처치 EXP로 레벨과 특성 포인트도 증가합니다.</p><button disabled={view.growth.gold<view.growth.attackCost||!view.growth.attackCost} onClick={()=>sendAction('train-attack')}>공격력 수련 · {view.growth.attackCost} G</button><button disabled={view.growth.gold<view.growth.healthCost||!view.growth.healthCost} onClick={()=>sendAction('train-health')}>체력 수련 · {view.growth.healthCost} G</button><p>{notice||error}</p></>}
   {panel==='bag'&&<><button className="inventory-close" aria-label="가방 닫기" onClick={()=>setPanel(null)}>✕</button><BuildInventory onChanged={()=>{queue.current.push({action:'items-refresh'});flush.current();}}/></>}
   {panel==='quest'&&<><p>상·하 갈림길을 선택해 공통 보스 격파 후 탈출</p><p>현재 정리: {view?.cleared.length??0}/7 · 현재 구역 남은 적: {remaining}</p><p>AUTO 경로: 1 → 2 → 4 → 5 → 7 → 8 → 10. 아래쪽 길도 같은 보스로 이어집니다. 구역마다 총 150~200마리, 처치 시간 제한 없음.</p></>}
   {panel!=='growth'&&panel!=='bag'&&<button autoFocus onClick={()=>setPanel(null)}>닫기</button>}
  </section>}
  </div>
  <footer className="rogue-footer hunt-footer"><button aria-pressed={panel==='weapons'} onClick={()=>setPanel(panel==='weapons'?null:'weapons')}>무기 · 성장</button><button aria-pressed={panel==='growth'} onClick={()=>setPanel(panel==='growth'?null:'growth')}>젬 · 코어</button><button aria-pressed={panel==='bag'} onClick={()=>setPanel(panel==='bag'?null:'bag')}>가방</button><button aria-pressed={!panel} onClick={()=>setPanel(null)}>✦ 탐험</button><button aria-pressed={panel==='quest'} onClick={()=>setPanel(panel==='quest'?null:'quest')}>사냥 의뢰</button></footer>
 </main>;
}
