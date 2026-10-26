'use client';
import {HuntGrowth} from './HuntGrowth';
import {HuntArmory} from './HuntArmory';
import {Shield} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {HuntEngine} from './hunt-engine';
import {COMBAT_CHARACTERS} from './combat-characters';
import {huntLoadout} from './hunt-loadouts';
import {HUNT_QUESTS,POTION_PRICE} from './hunt-progression';
import type {BattleView,HuntInput,HuntAction} from '../../lib/rpg-service';
import './hunt.css';
const skills=[['대지 균열','SkillIcon_GroundRift'],['암흑 구체','SkillIcon_DarkHole'],['서리 폭풍','SkillIcon_Blizzard3'],['빛의 심판','SkillIcon_HolyWrath2'],['회오리','SkillIcon_Whirlwind'],['회복','SkillIcon_VitalRecovery']];
type Queued=Partial<HuntInput>&{action?:HuntAction};
export function HuntPrototype({onExit,character='hong'}:{onExit?:()=>void;character?:string}){
 const router=useRouter();
 const canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>()),direction=useRef(0),held=useRef(false),auto=useRef(false),queue=useRef<Queued[]>([]);
 const [view,setView]=useState<BattleView|null>(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[menu,setMenu]=useState(false),[dialog,setDialog]=useState<'growth'|'bag'|'quest'|'weapons'|null>(null),[stick,setStick]=useState(0);
 const enqueue=(command:Queued)=>{if(queue.current.length<8)queue.current.push(command);};
 useEffect(()=>{
  const controller=new AbortController();let frame=0,timer:ReturnType<typeof setInterval>|undefined,renderer:Awaited<ReturnType<typeof import('./hunt-renderer').createHuntRenderer>>|undefined;
  const game=new HuntEngine(huntLoadout(character).combo);let target:BattleView|null=null,sequence=0,id='',inFlight=false,last=0;
  let retry:Record<string,unknown>|null=null;
  const reset=()=>{keys.current.clear();direction.current=0;held.current=false;auto.current=false;queue.current=[];setStick(0);};reset();
  const apply=(value:BattleView)=>{
   const first=target===null;target=value;sequence=value.sequence;id=value.id;
   game.hp=value.hp;game.elapsed=value.elapsed;game.action=value.action;game.actionSerial=value.actionSerial;game.animationSpeed=value.animationSpeed;game.facing=value.facing;
   game.heroHitUntil=value.heroHitUntil;game.lastHeroDamage=value.lastHeroDamage;game.cooldowns=value.cooldowns;game.auto=value.auto;
   value.enemies.forEach((e,i)=>{const mob=game.enemies[i],x=mob.x,same=mob.serial===e.serial;Object.assign(mob,e);if(!first&&same)mob.x=x;});
   if(value.dead){held.current=false;auto.current=false;keys.current.clear();direction.current=0;setDialog(null);}
   setView(value);
  };
  const request=async(body:Record<string,unknown>)=>{
   const response=await fetch('/api/rpg/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   const value=await response.json();return {ok:response.ok,value};
  };
  const pump=async()=>{
   if(inFlight||!id||controller.signal.aborted)return;
   inFlight=true;
   const k=keys.current,move=(k.has('ArrowRight')||k.has('d')?1:0)-(k.has('ArrowLeft')||k.has('a')?1:0);
   const command=retry?{}:queue.current.shift()||{},action=command.action||'tick';
   const body=retry||{action,id,sequence:sequence+1,input:{move:document.hidden?0:move||direction.current,attack:!document.hidden&&(held.current||k.has(' ')),auto:!document.hidden&&auto.current,...command}};
   try{
    const {ok,value}=await request(body);
    if(controller.signal.aborted)return;
    if(!ok){retry=null;if(body.action!=='tick'){setNotice(value.error);return;}throw Error(value.error||'서버 연결 오류');}
    retry=null;apply(value);setNotice('');
   }catch(e){if(!controller.signal.aborted){retry=body;setNotice(e instanceof Error?e.message:'연결을 재시도하고 있습니다.');}}
   finally{inFlight=false;}
  };
  const keydown=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLElement&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
   if(['ArrowLeft','ArrowRight',' ','a','d','q','e','f','1','2','3','4','5','6'].includes(e.key)){e.preventDefault();keys.current.add(e.key);}
   if(e.repeat)return;
   if(e.key===' ')enqueue({basic:true});else if(/^[1-6]$/.test(e.key))enqueue({skill:Number(e.key)-1});else if(e.key==='q'||e.key==='e')enqueue({dodge:e.key==='q'?-1:1});else if(e.key==='f')enqueue({parry:true});
  };
  const keyup=(e:KeyboardEvent)=>keys.current.delete(e.key);
  const visibility=()=>{reset();last=0;};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
  (async()=>{
   const {ok,value}=await request({action:'start',character});
   if(!ok)throw Error(value.error||'사냥터 입장 실패');
   const r=await import('./hunt-renderer').then(m=>m.createHuntRenderer(canvas.current!,controller.signal,character));
   renderer=r;if(controller.signal.aborted){r.dispose();return;}
   apply(value);auto.current=true;game.x=value.x;setStatus('ready');timer=setInterval(()=>void pump(),100);
   const loop=(now:number)=>{
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;
    if(target&&!document.hidden){game.x+=(target.x-game.x)*(1-Math.exp(-dt*35));game.elapsed+=dt;game.enemies.forEach((mob,i)=>{mob.x+=(target!.enemies[i].x-mob.x)*(1-Math.exp(-dt*35));});r.draw(game,dt,target);}
    frame=requestAnimationFrame(loop);
   };frame=requestAnimationFrame(loop);
  })().catch(e=>{if(!controller.signal.aborted){setStatus('error');setError(String(e));}});
  return()=>{controller.abort();if(timer)clearInterval(timer);cancelAnimationFrame(frame);renderer?.dispose();reset();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);};
 },[character]);
 const active=status==='ready'&&!!view&&!view.dead;
 const quest=view?HUNT_QUESTS[view.progress.questTier]:null;
 const exit=()=>{if(onExit)onExit();else router.push('/');};
 const endStick=()=>{direction.current=0;setStick(0);};
 return <main className="hunt-shell">
  <header className="hunt-header"><button className="hunt-back" onClick={exit}>← 캐릭터 선택</button><span className="hunt-prototype">사냥 프로토타입</span>
   <div className="hunt-currencies"><span><img src="/rpg/mat_gold.png" alt="골드"/>{(view?.progress.gold??0).toLocaleString()}</span><span title="영혼석">◆ {(view?.progress.soulGem??0).toLocaleString()}</span></div></header>
  <section className="hunt-stage" aria-label="달빛 숲 사냥터"><canvas ref={canvas} aria-label="전사와 최대 7마리 슬라임" data-status={status}/>
   <div className="hunt-identity"><img src={`/rpg/characters/${character}/portrait.png`} alt="선택한 캐릭터 초상화"/><div><small>Lv. {view?.progress.level??1} · {view?.loadout??'여행자'}</small><strong>{COMBAT_CHARACTERS.find(c=>c.id===character)?.label}</strong><span>무기 +{(view?.progress.weaponLevel??1)-1} · 방어구 +{(view?.progress.armorLevel??1)-1}</span>{(dialog==='weapons'||dialog==='growth')&&<meter className="armory-stage-hp" aria-label="전투 체력" min="0" max={view?.maxHP??10000} value={view?.hp??10000}/>}</div></div>
   <div className="hunt-location"><small>CHAPTER 01</small><h1>달빛 숲 <span>1–1</span></h1><p><i/>{view?.dead?'복귀 대기':view?.auto?'자동 사냥 중':'자유 탐험'} · 처치 {view?.progress.kills??0}</p></div>
   <button className="hunt-menu-toggle" aria-label="메뉴" aria-expanded={menu} onClick={()=>setMenu(!menu)}>☰</button>
   {menu&&<nav className="hunt-drawer" aria-label="사냥 메뉴"><button onClick={()=>{setDialog('weapons');setMenu(false);}}>무기</button><button onClick={()=>setNotice('A/D 이동 · Space 공격 · Q/E 회피 · F 패링 · 숫자 1–6 스킬')}>조작 안내</button><button onClick={()=>{setDialog('bag');setMenu(false);}}>가방 · 물약</button><button onClick={()=>{setDialog('quest');setMenu(false);}}>사냥 의뢰</button><button onClick={exit}>캐릭터 선택으로</button></nav>}
   {status==='loading'&&<div className="hunt-loading" role="status"><span/><strong>숲으로 향하는 중…</strong></div>}
   {status==='error'&&<div className="hunt-loading" role="alert"><strong>사냥터에 연결하지 못했습니다.</strong><small>{error}</small><button onClick={()=>location.reload()}>다시 시도</button><button onClick={exit}>돌아가기</button></div>}
   {view?.dead&&<div className="hunt-loading" role="dialog" aria-modal="true" aria-label="전투 불능"><strong>전투 불능</strong><small>획득한 성장과 재화는 저장됐습니다.</small><button disabled={!view.reviveReady} onClick={()=>enqueue({action:'revive'})}>{view.reviveReady?'안전한 위치로 복귀':'복귀 준비 중…'}</button><button onClick={exit}>캐릭터 선택으로</button></div>}
   <div className="hunt-stage-caption"><span>✦ 시작의 숲</span></div>
  </section>
  {dialog==='weapons'?<HuntArmory view={view} active={active} onCommand={action=>enqueue({action})} onClose={()=>setDialog(null)}/>:dialog==='growth'?<HuntGrowth view={view} active={active} onCommand={action=>enqueue({action})} onClose={()=>setDialog(null)}/>:<section className="hunt-console" aria-label="전투 조작">
   {notice&&<p className="hunt-notice" role="status">{notice} <button onClick={()=>location.reload()}>다시 입장</button></p>}
   <div className="hunt-vitals"><div><span>HP</span><meter min="0" aria-label="체력" max={view?.maxHP??10000} value={view?.hp??10000}/></div><div><span>EXP</span><progress max={Math.max(1,view?.xpRequired??1000)} value={view?.progress.xp??0}/><small>{view?.xpRequired?`${Math.floor((view.progress.xp/view.xpRequired)*100)}%`:'MAX'}</small></div></div>
   <div className="hunt-skill-row">{skills.map(([name,icon],i)=><button className="hunt-skill" key={name} aria-label={`${name} 스킬`} disabled={!active||(view?.cooldowns[i]??0)>0||!view?.progress.skillEnabled[i]} onClick={()=>enqueue({skill:i})}><img src={`/rpg/${icon}.png`} alt=""/><span>{(view?.cooldowns[i]??0)>0?Math.ceil(view!.cooldowns[i]):i+1}</span></button>)}</div>
   <div className="hunt-mode-row"><span>게스트 진행 저장</span><button disabled={!active||!view?.potionReady} onClick={()=>enqueue({action:'potion'})}>물약 {view?.progress.potions??0}</button><button className={view?.auto?'is-on':''} disabled={!active} aria-pressed={view?.auto??false} onClick={()=>{auto.current=!auto.current;}}>AUTO {view?.auto?'ON':'OFF'}</button></div>
   <div className="hunt-controls"><button className="hunt-dodge" disabled={!active} onClick={()=>enqueue({dodge:-1})} aria-label="왼쪽 회피">↶</button>
    <div className="hunt-joystick" role="group" aria-label="좌우 이동" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect(),v=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.35)));setStick(v);direction.current=Math.abs(v)<.18?0:v;}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.getBoundingClientRect(),v=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.35)));setStick(v);direction.current=Math.abs(v)<.18?0:v;}} onPointerUp={endStick} onPointerCancel={endStick} onLostPointerCapture={endStick}><span className="hunt-stick-rail">‹ ─── ›</span><span className="hunt-stick" style={{transform:`translateX(${stick*38}px)`}}/></div>

    <button className="hunt-parry" disabled={!active} onClick={()=>enqueue({parry:true})} aria-label="패링"><Shield/></button>
    <button className="hunt-dodge" disabled={!active} onClick={()=>enqueue({dodge:1})} aria-label="오른쪽 회피">↷</button></div>
  </section>}
  {notice&&dialog&&<p className="development-notice" role="status">{notice}</p>}<footer className="hunt-footer"><button onClick={()=>setDialog('weapons')}>무기</button><button onClick={()=>setDialog('growth')}>성장 · 장비</button><button onClick={()=>setDialog('bag')}>가방</button><strong>✦ 탐험</strong><button onClick={()=>setDialog('quest')}>사냥 의뢰</button></footer>
  {dialog&&dialog!=='weapons'&&dialog!=='growth'&&<div className="hunt-modal" onClick={()=>setDialog(null)}><section role="dialog" aria-modal="true" aria-labelledby="hunt-growth-title" onClick={e=>e.stopPropagation()}><h2 id="hunt-growth-title">{dialog==='bag'?'가방 · 회복 물약':'사냥 의뢰'}</h2>
   {dialog==='bag'&&<><p>골드 {view?.progress.gold??0} · 물약 {view?.progress.potions??0}개</p><p>회복 물약: 최대 HP의 40% 회복 · 재사용 2초</p><button disabled={!active||!view?.potionReady} onClick={()=>enqueue({action:'potion'})}>물약 사용</button><button disabled={!active||!view||view.progress.gold<POTION_PRICE||view.progress.potions>=99} onClick={()=>enqueue({action:'buy-potion'})}>물약 구매 · {POTION_PRICE} 골드</button><p>훈련 무기 +{(view?.progress.weaponLevel??1)-1} · 방어구 +{(view?.progress.armorLevel??1)-1}</p></>}
   {dialog==='quest'&&<>{quest?<><p>{quest.name}</p><p>슬라임 처치 {Math.min(view?.progress.kills??0,quest.kills)} / {quest.kills}</p><p>보상: {quest.gold} 골드 · {quest.soulGem} 영혼석</p><button disabled={!view||(view.progress.kills<quest.kills)} onClick={()=>enqueue({action:'quest'})}>의뢰 보상 받기</button></>:<p>모든 사냥 의뢰를 완료했습니다.</p>}</>}
   <button autoFocus onClick={()=>setDialog(null)}>닫기</button></section></div>}
 </main>;
}
