"use client";
import { Card, cardColor } from "@/lib/poker-engine";

interface Props {
  card?: Card;
  hidden?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function PlayingCard({ card, hidden, size = "md", className = "" }: Props) {
  const sizes = {
    xs: { w: "w-6", h: "h-9", text: "text-xs", rank: "text-[9px]" },
    sm: { w: "w-8", h: "h-12", text: "text-xs", rank: "text-[10px]" },
    md: { w: "w-10", h: "h-14", text: "text-sm", rank: "text-xs" },
    lg: { w: "w-14", h: "h-20", text: "text-lg", rank: "text-sm" },
  };
  const s = sizes[size];

  if (hidden || !card) {
    return (
      <div className={`${s.w} ${s.h} rounded-md border-2 border-amber-700/70 bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 shadow-lg flex items-center justify-center ${className}`}>
        <div className="w-3/4 h-3/4 rounded-sm border-2 border-amber-500/40 flex items-center justify-center">
          <span className="text-amber-500/70 text-base font-bold">♠</span>
        </div>
      </div>
    );
  }

  const isRed = card.suit === "♥" || card.suit === "♦";
  const colorClass = isRed ? "text-rose-600" : "text-slate-900";
  const rankDisplay = card.rank === "T" ? "10" : card.rank;

  return (
    <div className={`${s.w} ${s.h} rounded-md border-2 border-amber-950/30 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg flex flex-col justify-between p-0.5 relative overflow-hidden ${className}`}>
      <div className={`flex flex-col items-start leading-none ${colorClass}`}>
        <span className={`${s.rank} font-bold`}>{rankDisplay}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
        <span className={s.text}>{card.suit}</span>
      </div>
      <div className={`${size==="xs"?"hidden":"flex"} flex-col items-end leading-none rotate-180 ${colorClass}`}>
        <span className={`${s.rank} font-bold`}>{rankDisplay}</span>
      </div>
    </div>
  );
}
