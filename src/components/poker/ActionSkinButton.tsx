"use client";
import type {ButtonHTMLAttributes} from 'react';

type ActionSkin='red'|'blue'|'purple';
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{skin:ActionSkin};

export function ActionSkinButton({skin,className='',style,children,type='button',...props}:Props) {
  return <button {...props} type={type}
    className={`island-action island-action-${skin} relative min-w-0 w-full rounded-md font-bold text-[10px] sm:text-sm leading-tight touch-manipulation disabled:opacity-40 transition-[filter] duration-150 ${className}`}
    style={style}>
    <span className="relative flex h-full w-full flex-col items-center justify-center px-2 py-1">{children}</span>
  </button>;
}
