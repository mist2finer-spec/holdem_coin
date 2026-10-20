"use client";
import {useState} from 'react';
import {raiseSizing} from '@/lib/poker-sizing';
import type {ActionType} from '@/lib/poker-engine';

export function RaiseMultiplierButton({currentBet,call,stack,minRaise,maxRaise,onSubmit}:{
  currentBet:number;call:number;stack:number;minRaise:number;maxRaise:number;
  onSubmit:(action:ActionType,amount:number)=>void;
}) {
  // Integer tenths avoid labels such as 3.3000000000000003X.
  const [tenths,setTenths]=useState(30);
  const size=raiseSizing(currentBet,call,stack,minRaise,maxRaise,tenths);
  return <div className="relative flex-1 min-w-0">
    <button type="button" aria-label="레이즈 배율 증가" disabled={!size.canRaise||size.selected>=size.maxTenths}
      onClick={()=>setTenths(Math.min(size.maxTenths,size.selected+1))}
      className="absolute bottom-full mb-0.5 left-1/2 -translate-x-1/2 h-6 w-10 text-lg leading-none text-rose-500 hover:text-rose-300 disabled:opacity-30"
    >▲</button>
    <button type="button" disabled={!size.canRaise}
      onClick={()=>onSubmit(size.allIn?'allin':'raise',size.allIn?stack:size.target)}
      title={`${size.label} · 총 ${size.target.toLocaleString()}칩${size.allIn?' · ALL-IN':''}`}
      className="w-full h-8 sm:h-10 rounded-md border border-orange-300 bg-orange-600 hover:bg-orange-500 text-orange-50 font-bold text-[10px] sm:text-sm disabled:opacity-40"
    ><span className="block leading-tight">{size.label}{size.allIn?' ALL-IN':''}</span><span className="block text-[8px] sm:text-[10px] leading-tight opacity-90">총 {size.target.toLocaleString()}</span></button>
    <button type="button" aria-label="레이즈 배율 감소" disabled={!size.canRaise||size.selected<=30}
      onClick={()=>setTenths(Math.max(30,size.selected-1))}
      className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 h-6 w-10 text-lg leading-none text-rose-500 hover:text-rose-300 disabled:opacity-30"
    >▼</button>
  </div>;
}
