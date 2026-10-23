'use client';
import {useEffect, useRef, useState} from 'react';
import {HuntEngine} from './hunt-engine';
import './hunt.css';
const skills = [
 ['대지 균열','SkillIcon_GroundRift','1'],['암흑 구체','SkillIcon_DarkHole','2'],['서리 폭풍','SkillIcon_Blizzard3','3'],
 ['빛의 심판','SkillIcon_HolyWrath2','4'],['회오리','SkillIcon_Whirlwind','5'],['회복','SkillIcon_VitalRecovery','6'],
];
const menus = [['출석','달빛 숲에 오신 것을 환영합니다. 출석 보상은 다음 버전에 연결됩니다.'],['우편','도착한 우편이 없습니다.'],['설정','이 프로토타입은 소리 없이 실행됩니다. 키보드 A/D 또는 ←/→로 이동하고 Space로 공격합니다.'],['공지','사냥 화면 프로토타입입니다. 전투·재화·경험치는 테스트용이며 계정에 저장되지 않습니다.']];
const initial = () => ({hp:100,xp:0,coins:0,kills:0,auto:false,paused:false,cooldowns:[0,0,0,0,0,0],x:620,action:'stay1'});
export function HuntPrototype({onExit}: {onExit?:()=>void}) {
 const canvas = useRef<HTMLCanvasElement>(null), engine = useRef<HuntEngine|null>(null), direction = useRef(0), keys = useRef(new Set<string>()),attackPointer=useRef(false);
 const [view,setView] = useState(initial), [status,setStatus] = useState('loading'), [error,setError] = useState(''), [menu,setMenu] = useState(false), [dialog,setDialog] = useState<[string,string]|null>(null);
 const [stick,setStick] = useState(0);
 useEffect(()=>{
  const controller = new AbortController(); let frame=0; let renderer: Awaited<ReturnType<typeof import('./hunt-renderer').createHuntRenderer>>|undefined;
  const game = new HuntEngine();engine.current=game;let last=0,lastUI=0;
  const reset=()=>{keys.current.clear();direction.current=0;attackPointer.current=false;game.clearInput();setStick(0);};
  const keydown=(e:KeyboardEvent)=>{
   if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
   if(['ArrowLeft','ArrowRight',' ','a','d','q','e','1','2','3','4','5','6'].includes(e.key)){e.preventDefault();keys.current.add(e.key);}
   if(e.repeat)return;
   if(e.key===' ')game.attack();else if(/^[1-6]$/.test(e.key))game.attack(Number(e.key)-1);else if(e.key==='q'||e.key==='e')game.dodge(e.key==='q'?-1:1);
  };
  const keyup=(e:KeyboardEvent)=>keys.current.delete(e.key);
  const visibility=()=>{reset();last=0;};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
  import('./hunt-renderer').then(m=>m.createHuntRenderer(canvas.current!,controller.signal)).then(r=>{
   if(controller.signal.aborted){r.dispose();return;}renderer=r;setStatus('ready');
   const loop=(now:number)=>{
    if(document.hidden){last=0;frame=requestAnimationFrame(loop);return;}
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;
    const k=keys.current, movement=(k.has('ArrowRight')||k.has('d')?1:0)-(k.has('ArrowLeft')||k.has('a')?1:0);
    game.attackHeld=k.has(' ')||attackPointer.current;
    game.step(dt,movement||direction.current);r.draw(game,game.paused?0:dt);
    if(now-lastUI>100){setView({hp:game.hp,xp:game.xp,coins:game.coins,kills:game.kills,auto:game.auto,paused:game.paused,cooldowns:[...game.cooldowns],x:Math.round(game.x),action:game.action});lastUI=now;}
    frame=requestAnimationFrame(loop);
   };frame=requestAnimationFrame(loop);
  }).catch(e=>{if(!controller.signal.aborted){setStatus('error');setError(String(e));}});
  return()=>{controller.abort();cancelAnimationFrame(frame);renderer?.dispose();engine.current=null;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const active=status==='ready'&&!view.paused;
 const stickMove=(e:React.PointerEvent<HTMLDivElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect(), value=Math.max(-1,Math.min(1,(e.clientX-rect.left-rect.width/2)/(rect.width*.35)));
  setStick(value);direction.current=Math.abs(value)<.18?0:value;
 };
 const endStick=()=>{direction.current=0;setStick(0);};
 return <main className="hunt-shell">
  <header className="hunt-header">
   <a className="hunt-back" href="/" onClick={e=>{if(onExit){e.preventDefault();onExit();}}}>← 처음으로</a><span className="hunt-prototype">사냥 프로토타입</span>
   <div className="hunt-currencies"><span><img src="/rpg/mat_gold.png" alt="골드"/>{view.coins.toLocaleString()}</span><span><img src="/rpg/mat_arcanegem.png" alt="보석"/>0</span></div>
  </header>
  <section className="hunt-stage" aria-label="달빛 숲 사냥터">
   <canvas ref={canvas} aria-label="이동하는 전사와 최대 7마리 슬라임" data-status={status} data-position={view.x} data-action={view.action}/>
   <div className="hunt-identity"><img src="/rpg/Portrait_Hero_005.png" alt="전사 초상화"/><div><small>Lv. 1 · 견습 전사</small><strong>숲의 여행자</strong><span>⚔ 전투력 1,250</span></div></div>
   <div className="hunt-location"><small>CHAPTER 01</small><h1>달빛 숲 <span>1–1</span></h1><p><i/>{view.paused?'휴식 중':view.auto?'자동 사냥 중':'자유 탐험'} · 처치 {view.kills}</p></div>
   <button className="hunt-menu-toggle" aria-label="메뉴" aria-expanded={menu} onClick={()=>setMenu(!menu)}>☰</button>
   {menu&&<nav className="hunt-drawer" aria-label="사냥 메뉴">{menus.map(([title,body])=><button key={title} onClick={()=>{setDialog([title,body]);setMenu(false);}}>{title}</button>)}</nav>}
   {status==='loading'&&<div className="hunt-loading" role="status"><span/><strong>숲으로 향하는 중…</strong><small>캐릭터와 배경을 불러오고 있습니다.</small></div>}
   {status==='error'&&<div className="hunt-loading" role="alert"><strong>리소스를 불러오지 못했습니다.</strong><small>{error}</small><button onClick={()=>location.reload()}>다시 시도</button></div>}
   <div className="hunt-stage-caption"><span>✦ 시작의 숲</span><small>최대 7마리 · 탐험하며 슬라임을 처치해 보세요</small></div>
  </section>
  <section className="hunt-console" aria-label="전투 조작">
   <div className="hunt-vitals"><div><span>HP</span><meter min="0" max="100" value={view.hp}/><small>{view.hp}/100</small></div><div><span>EXP</span><progress max="100" value={view.xp%100}/><small>{view.xp%100}%</small></div></div>
   <div className="hunt-skill-row">{skills.map(([name,icon,key],i)=><button className="hunt-skill" key={name} aria-label={`${name} 스킬`} disabled={!active||view.cooldowns[i]>0} onClick={()=>engine.current?.attack(i)}><img src={`/rpg/${icon}.png`} alt=""/><span>{view.cooldowns[i]>0?Math.ceil(view.cooldowns[i]):key}</span><small>{name}</small></button>)}</div>
   <div className="hunt-mode-row"><span>TEST MODE · 진행은 저장되지 않습니다</span><button disabled={status!=='ready'} onClick={()=>{if(engine.current){engine.current.paused=!engine.current.paused;engine.current.clearInput();keys.current.clear();attackPointer.current=false;direction.current=0;setStick(0);}}}>{view.paused?'▶ 계속':'Ⅱ 휴식'}</button><button className={view.auto?'is-on':''} disabled={status!=='ready'} aria-pressed={view.auto} onClick={()=>engine.current?.setAuto(!engine.current.auto)}>AUTO {view.auto?'ON':'OFF'}</button></div>
   <div className="hunt-controls">
    <button className="hunt-dodge" disabled={!active} onClick={()=>engine.current?.dodge(-1)} aria-label="왼쪽 회피">↶<small>회피 · Q</small></button>
    <div className="hunt-joystick" role="group" aria-label="좌우 이동" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);stickMove(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))stickMove(e);}} onPointerUp={endStick} onPointerCancel={endStick} onLostPointerCapture={endStick}><span className="hunt-stick-rail">‹ ─── ›</span><span className="hunt-stick" style={{transform:`translateX(${stick*38}px)`}}/><small>A / D · ← / →</small></div>
    <button className="hunt-attack" disabled={!active}
     onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);attackPointer.current=true;engine.current?.attack();}}
     onPointerUp={()=>{attackPointer.current=false;}} onPointerCancel={()=>{attackPointer.current=false;}}
     onLostPointerCapture={()=>{attackPointer.current=false;}}
     onClick={e=>{if(e.detail===0)engine.current?.attack();}} aria-label="기본 공격, 길게 누르면 연속 공격">⚔<small>공격 · SPACE</small></button>
    <button className="hunt-dodge" disabled={!active} onClick={()=>engine.current?.dodge(1)} aria-label="오른쪽 회피">↷<small>회피 · E</small></button>
   </div>
  </section>
  <footer className="hunt-footer"><span>성장</span><span>소지품</span><strong>✦ 탐험</strong><span>소환</span><span>상점</span></footer>
  {dialog&&<div className="hunt-modal" onClick={()=>setDialog(null)}><section role="dialog" aria-modal="true" aria-labelledby="hunt-dialog-title" onClick={e=>e.stopPropagation()}><h2 id="hunt-dialog-title">{dialog[0]}</h2><p>{dialog[1]}</p><button autoFocus onClick={()=>setDialog(null)}>닫기</button></section></div>}
 </main>;
}
