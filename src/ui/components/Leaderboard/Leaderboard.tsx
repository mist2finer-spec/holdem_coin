/**
 * holdem_coin :: Leaderboard React component (UI-only)
 * ─────────────────────────────────────────────────────────────────────────
 * Gold casino leaderboard with dynamic expansion.
 *
 * Props:
 *   - players: Player[]            — list of players (sorted desc by amount by parent)
 *   - title?: string               — header title (default "LEADERBOARD")
 *   - titleKo?: string             — Korean title (default "리더보드")
 *   - maxVisible?: number         — how many entries to show at once (default 7)
 *   - currency?: 'K' | '$' | string— currency suffix
 *   - frameImage?: string          — gold frame image URL (default: assets/leaderboard/Leaderboard_1_x4.png)
 *   - onRowClick?: (p, idx) => void
 *
 * Responsive:
 *   - Mobile  (< 640px):  compact row height 56px, max visible 5
 *   - Tablet  (< 1024):  standard row height 72px, max visible 7
 *   - Desktop:           expanded row height 88px, max visible 10
 *
 * Bilingual labels: each row shows "Player" + "플레이어" alongside name.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState, useEffect } from 'react';

export interface Player {
  id: string | number;
  name: string;
  amount: number;       // in K (thousands) or whatever unit `currency` denotes
  avatarUrl?: string;
  isCurrentUser?: boolean;
  trend?: 'up' | 'down' | 'same' | 'new';
}

export interface LeaderboardProps {
  players: Player[];
  title?: string;
  titleKo?: string;
  maxVisible?: number;
  currency?: string;
  frameImage?: string;
  highlightTop3?: boolean;
  onRowClick?: (player: Player, index: number) => void;
  className?: string;
}

const DEFAULT_FRAME = '/src/ui/assets/leaderboard/Leaderboard_1_x4.png';

const RANK_STYLES: Record<number, { crown: string; ring: string; label: string }> = {
  1: { crown: '👑', ring: 'ring-yellow-300',  label: '1st' },
  2: { crown: '🥈', ring: 'ring-gray-300',   label: '2nd' },
  3: { crown: '🥉', ring: 'ring-amber-600',  label: '3rd' },
};

function formatAmount(amount: number, currency: string): string {
  // amount is already in K (thousands); format with commas
  const s = amount.toLocaleString('en-US');
  return currency === 'K' ? `${s} K` : `${s} ${currency}`;
}

function useResponsiveMaxVisible(defaultMax: number): number {
  const [max, setMax] = useState(defaultMax);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640)       setMax(Math.min(defaultMax, 5));
      else if (w < 1024) setMax(Math.min(defaultMax, 7));
      else               setMax(Math.min(defaultMax, 10));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [defaultMax]);
  return max;
}

function useExpandedCount(total: number, initial: number): [number, () => void, () => void] {
  const [count, setCount] = useState(initial);
  useEffect(() => { setCount(initial); }, [initial, total]);
  const expand  = () => setCount(c => Math.min(c + 5, total));
  const collapse = () => setCount(initial);
  return [count, expand, collapse];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  title = 'LEADERBOARD',
  titleKo = '리더보드',
  maxVisible = 7,
  currency = 'K',
  frameImage = DEFAULT_FRAME,
  highlightTop3 = true,
  onRowClick,
  className = '',
}) => {
  const responsiveMax = useResponsiveMaxVisible(maxVisible);
  const [visibleCount, expand, collapse] = useExpandedCount(players.length, responsiveMax);

  const sorted = useMemo(
    () => [...players].sort((a, b) => b.amount - a.amount),
    [players],
  );
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const isExpanded = visibleCount > responsiveMax;

  return (
    <div
      className={`leaderboard relative mx-auto w-full max-w-md ${className}`}
      role="region"
      aria-label={`${title} / ${titleKo}`}
      style={{
        // Use the gold-frame image as a CSS background with border-image
        // so it stretches fluidly with the list height.
        borderImage: `url(${frameImage}) 30 round`,
        borderStyle: 'solid',
        borderWidth: '18px',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, #1a0e08 0%, #2b1a0d 50%, #1a0e08 100%)',
        boxShadow: '0 0 24px rgba(218,165,32,0.35), inset 0 0 16px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 text-center">
        <h2
          className="font-serif text-2xl font-bold tracking-wider"
          style={{
            background: 'linear-gradient(180deg, #ffe27a 0%, #d4a017 50%, #8b6914 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          {title}
        </h2>
        <p className="text-xs tracking-[0.3em] text-amber-200/70">{titleKo}</p>
      </div>

      {/* List */}
      <ol
        className="space-y-1 px-2 pb-2"
        style={{ minHeight: '120px' /* prevents collapse when few entries */ }}
      >
        {visible.map((p, idx) => {
          const rank = idx + 1;
          const rs = RANK_STYLES[rank];
          const isTop3 = highlightTop3 && rank <= 3;
          return (
            <li
              key={p.id}
              onClick={() => onRowClick?.(p, idx)}
              className={`
                group flex items-center gap-3 rounded-md px-3 py-2
                transition-all duration-200 hover:bg-amber-500/10
                ${p.isCurrentUser ? 'bg-amber-500/15 ring-1 ring-amber-400/60' : ''}
                ${onRowClick ? 'cursor-pointer' : ''}
              `}
              style={{
                background: isTop3
                  ? 'linear-gradient(90deg, rgba(218,165,32,0.18) 0%, rgba(0,0,0,0) 80%)'
                  : undefined,
                minHeight: '56px',
              }}
            >
              {/* Rank badge */}
              <div
                className={`
                  flex h-8 w-8 flex-shrink-0 items-center justify-center
                  rounded-full text-sm font-bold
                  ${rs ? `ring-2 ${rs.ring} bg-amber-900/40` : 'bg-black/40 text-amber-200/70'}
                `}
                aria-label={`Rank ${rank}`}
              >
                {rs ? <span aria-hidden>{rs.crown}</span> : rank}
              </div>

              {/* Avatar */}
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt=""
                  className="h-9 w-9 flex-shrink-0 rounded-full ring-1 ring-amber-300/30"
                />
              ) : (
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-700 to-amber-900 text-xs font-bold text-amber-100 ring-1 ring-amber-300/30"
                  aria-hidden
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Name + label */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className="truncate font-serif text-base text-amber-50"
                  title={p.name}
                >
                  {p.name}
                </span>
                <span className="text-[10px] tracking-wider text-amber-300/60">
                  Player · 플레이어
                </span>
              </div>

              {/* Trend */}
              {p.trend && p.trend !== 'same' && (
                <span
                  aria-label={`trend: ${p.trend}`}
                  className="text-xs"
                  style={{
                    color: p.trend === 'up'   ? '#4ade80'
                         : p.trend === 'down' ? '#f87171'
                         : '#a78bfa',
                  }}
                >
                  {p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '★'}
                </span>
              )}

              {/* Amount */}
              <div className="flex flex-shrink-0 flex-col items-end">
                <span
                  className="font-mono text-base font-bold tabular-nums"
                  style={{
                    background: 'linear-gradient(180deg, #ffe27a 0%, #d4a017 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {formatAmount(p.amount, currency)}
                </span>
              </div>
            </li>
          );
        })}

        {/* Empty slots (kept min-height stable when list is short) */}
        {visible.length < responsiveMax && Array.from({ length: responsiveMax - visible.length }).map((_, i) => (
          <li
            key={`empty-${i}`}
            className="flex h-14 items-center justify-center rounded-md border border-dashed border-amber-300/10 text-amber-300/20"
          >
            —
          </li>
        ))}
      </ol>

      {/* Expand / collapse controls */}
      {hasMore && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={expand}
            className="rounded-full border border-amber-400/50 bg-amber-900/30 px-4 py-1 text-xs text-amber-100 transition hover:bg-amber-700/40"
          >
            ▼ 더 보기 · Show more ({sorted.length - visibleCount})
          </button>
        </div>
      )}
      {isExpanded && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={collapse}
            className="rounded-full border border-amber-400/30 px-4 py-1 text-xs text-amber-200/70 transition hover:bg-amber-900/20"
          >
            ▲ 접기 · Collapse
          </button>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
