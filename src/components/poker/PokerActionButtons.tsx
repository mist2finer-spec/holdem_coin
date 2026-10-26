"use client";
import {useState} from 'react';
import {RaiseMultiplierButton} from './RaiseMultiplierButton';
import {ActionSkinButton} from './ActionSkinButton';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {potFractionSizing} from '@/lib/poker-sizing';
import type {ActionType} from '@/lib/poker-engine';

export function PokerActionButtons({currentBet,call,stack,minRaise,maxRaise,pot,formatMoney=(n:number)=>n.toLocaleString(),bigBlind,onSubmit}:{
 currentBet:number;call:number;stack:number;minRaise:number;maxRaise:number;pot:number;
 formatMoney?:(n:number)=>string;bigBlind?:number;
 onSubmit:(action:ActionType,amount:number)=>void;
}) {
 const [open,setOpen]=useState(false);
 const [custom,setCustom]=useState('');
 const submit=(action:ActionType,amount:number)=>{setOpen(false);onSubmit(action,amount);};
 const customAmount=bigBlind?Math.round(Number(custom)*bigBlind):Number(custom);
 const validCustom=custom.trim()!==''&&Number.isSafeInteger(customAmount)&&customAmount>=minRaise&&customAmount<=maxRaise&&maxRaise>currentBet+call&&stack>call;
 return <div className="poker-action-row" aria-label="배팅 액션">
  <ActionSkinButton skin="red" className="poker-main-action" onClick={()=>submit('fold',0)}>FOLD</ActionSkinButton>
  <ActionSkinButton skin="blue" className="poker-main-action" onClick={()=>submit(call>0?'call':'check',Math.min(call,stack))}>
   {call>0?<><span>CALL</span><span className="text-[10px]">{formatMoney(Math.min(call,stack))}</span></>:'CHECK'}
  </ActionSkinButton>
  <RaiseMultiplierButton currentBet={currentBet} call={call} stack={stack} minRaise={minRaise} maxRaise={maxRaise} formatMoney={formatMoney} onSubmit={submit}/>
  <Popover open={open} onOpenChange={setOpen}>
   <PopoverTrigger asChild>
    <ActionSkinButton skin="purple" className="poker-main-action" disabled={stack<=0} aria-label="POT BET OR ALL-IN 메뉴 열기">
     <span className="text-[9px] sm:text-xs">POT BET<br/>OR ALL-IN <span aria-hidden="true">{open?'▾':'▴'}</span></span>
    </ActionSkinButton>
   </PopoverTrigger>
   <PopoverContent side="top" align="end" sideOffset={8} collisionPadding={8}
    className="poker-pot-menu w-44 sm:w-52 p-2 bg-slate-950 border-amber-700 text-amber-100"
    aria-label="팟 베팅 또는 올인 선택">
    <p className="text-[10px] text-center mb-2 text-amber-200/80">금액을 눌러 베팅</p>
    <div className="grid gap-1.5">
     <ActionSkinButton skin="red" className="h-11" disabled={stack>call&&maxRaise<=currentBet+call} onClick={()=>submit('allin',stack)}>ALL-IN · {formatMoney(stack)}</ActionSkinButton>
     {[{f:3/4,label:'3/4 POT'},{f:1/2,label:'1/2 POT'},{f:1/4,label:'1/4 POT'}].map(({f,label})=>{
      const size=potFractionSizing(currentBet,call,stack,minRaise,maxRaise,pot,f);
      return <ActionSkinButton key={label} skin="purple" className="h-11" disabled={!size.canRaise}
       onClick={()=>submit(size.allIn?'allin':'raise',size.allIn?stack:size.target)}
       title={`현재 팟 ${formatMoney(pot)} · 최소 레이즈 ${formatMoney(minRaise)}`}>
       <span>{label} · {size.allIn?'ALL-IN':formatMoney(size.target)}</span>
       {size.belowMinimum&&<span className="text-[8px]">최소 {formatMoney(minRaise)} 미만</span>}
      </ActionSkinButton>;
     })}
    </div>
    <details className="mt-2 text-[10px]"><summary className="cursor-pointer py-1">직접 금액 입력</summary>
     <form className="mt-1 flex gap-1" onSubmit={e=>{e.preventDefault();if(validCustom)submit('raise',customAmount);}}>
      <input aria-label={bigBlind?"레이즈 총액 (BB)":"레이즈 총액"} placeholder={bigBlind?"BB 단위":"칩 단위"} inputMode="decimal" type="number" min={bigBlind?Math.ceil(minRaise/bigBlind*10)/10:minRaise} max={bigBlind?Math.floor(maxRaise/bigBlind*10)/10:maxRaise} step={bigBlind?0.1:1} value={custom}
       onChange={e=>setCustom(e.target.value)} className="min-w-0 w-full rounded border border-amber-800 bg-slate-900 p-2"/>
      <button className="rounded bg-amber-700 px-2 disabled:opacity-40" disabled={!validCustom}>베팅</button>
     </form>
    </details>
   </PopoverContent>
  </Popover>
 </div>;
}
