 'use client';
import type {CSSProperties} from 'react';
import {skillCooldown} from './skill-cooldown';
import './skill-cooldown.css';
export function SkillCooldownButton({name,icon,index,remaining,total,reserved,disabled,onClick}:{name:string;icon:string;index:number;remaining:number;total:number;reserved?:boolean;disabled?:boolean;onClick:()=>void}){
 const c=skillCooldown(remaining,total);
 return <button className={`hunt-skill skill-cooldown ${c.cooling?'is-cooling':'is-ready'}`} aria-label={`${name} 스킬${c.cooling?` · 재사용 ${c.label}초`:''}`} aria-pressed={!!reserved} disabled={disabled} title={c.cooling?'재사용 대기 중 · 누르면 다음 시전 예약':'스킬 시전'} onClick={onClick} data-cooldown={c.cooling?'active':'ready'}>
  <img src={`/rpg/${icon}.png`} alt=""/>
  {c.cooling&&<i className="skill-cooldown-sweep" aria-hidden="true" style={{'--cooldown-angle':`${c.fraction*360}deg`} as CSSProperties}/>}
  <span className="skill-cooldown-number">{c.cooling?c.label:index+1}</span>
  {reserved&&<b className="hunt-skill-reserved">예약</b>}
 </button>;
}
