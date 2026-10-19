import type { CSSProperties } from "react";

interface Props {
  amount: number;
  name: string;
  position: { top: string; left: string };
}

// Anchor chips to the table, independently of the avatar/name/stack height.
// Pull each seat towards the centre while keeping clear of the board and pot.
export function TableBet({ amount, name, position }: Props) {
  if (amount <= 0) return null;
  const seatTop = parseFloat(position.top);
  const top = 50 + (seatTop - 50) * 0.55;
  const mobileTop = seatTop > 35 && seatTop < 60 ? "calc(42% + 48px)" : `${top}%`;
  const left = 50 + (parseFloat(position.left) - 50) * 0.62;
  return (
    <div
      className="absolute top-[var(--bet-mobile-top)] sm:top-[var(--bet-top)] z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ "--bet-top": `${top}%`, "--bet-mobile-top": mobileTop, left: `${left}%` } as CSSProperties}
      aria-label={`${name} 베팅 ${amount.toLocaleString()} 칩`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-rose-400/70 bg-slate-950/95 px-1.5 py-0.5 sm:px-2.5 sm:py-1 shadow-lg whitespace-nowrap">
        <span aria-hidden="true" className="flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-full border-2 border-dashed border-rose-200 bg-rose-700 text-[7px] text-white">◆</span>
        <span className="text-[10px] sm:text-xs font-black text-amber-100 tabular-nums">{amount.toLocaleString()}</span>
      </div>
    </div>
  );
}
