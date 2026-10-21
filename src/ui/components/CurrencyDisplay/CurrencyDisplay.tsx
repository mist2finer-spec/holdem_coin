/**
 * holdem_coin :: CurrencyDisplay React component
 * ─────────────────────────────────────────────────────────────────────────
 * Renders a single currency indicator inside the gold-framed currency_bg.png
 * template. The diamond (rhombus) cutout on the left is overlaid by a chip
 * icon, large enough to fully cover it. The plus button on the right links
 * to the recharge flow.
 *
 * Layout (matches currency_bg.png):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  [DIAMOND]   ───────────────────  ───────────  [+ PLUS]  │
 *   │  chip        currency amount    currency label           │
 *   │              "1,234,567 K"       "HOLDEM COIN"            │
 *   └──────────────────────────────────────────────────────────┘
 *                ↑ currency_bg.png background
 *
 * The diamond area is at x≈5-79 / y≈8-99 in the original 248×109 image.
 * We upscale bg 4× (992×436), so diamond becomes ~300×368px area.
 * The chip is rendered at ~140px diameter so it fully covers the diamond.
 *
 * Click handler: when user clicks the plus button, `onRechargeClick` fires.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React from 'react';

export interface CurrencyDisplayProps {
  amount: number;
  currency?: string;             // default 'K'
  chipId?: 'Chip_01' | 'Chip_01_a' | 'Chip_01_b';  // which chip icon to use as the diamond cover
  onRechargeClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';     // responsive scaling
}

const CHIP_URLS = {
  Chip_01:   '/src/ui/assets/chips/Chip_01.png',
  Chip_01_a: '/src/ui/assets/chips/Chip_01_a.png',
  Chip_01_b: '/src/ui/assets/chips/Chip_01_b.png',
};

const SIZE_PRESETS = {
  sm: { container: 'h-12',   chip: 36,  text: 'text-sm',  sub: 'text-[10px]' },
  md: { container: 'h-16',   chip: 56,  text: 'text-lg',  sub: 'text-xs'    },
  lg: { container: 'h-24',   chip: 96,  text: 'text-2xl', sub: 'text-sm'    },
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency = 'K',
  chipId = 'Chip_01',
  onRechargeClick,
  className = '',
  size = 'md',
}) => {
  const preset = SIZE_PRESETS[size];
  const formatted = amount.toLocaleString('en-US');

  return (
    <div
      className={`currency-display relative inline-flex items-center ${preset.container} ${className}`}
      role="group"
      aria-label={`Holdem coin balance: ${formatted} ${currency}`}
      style={{
        backgroundImage: `url(/src/ui/assets/currency/currency_bg_x4.png)`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        padding: '0 1.5rem 0 1.5rem',
        minWidth: size === 'lg' ? '360px' : size === 'md' ? '260px' : '180px',
      }}
    >
      {/* Chip icon overlaid on the diamond area (left side) */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
        style={{ width: preset.chip, height: preset.chip }}
      >
        <img
          src={CHIP_URLS[chipId]}
          alt={`${chipId} chip`}
          width={preset.chip}
          height={preset.chip}
          className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        />
      </div>

      {/* Amount + label (centered) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center ml-12 mr-8">
        <span
          className={`font-mono font-bold tabular-nums gold-amount ${preset.text}`}
          style={{
            background: 'linear-gradient(180deg, #ffe27a 0%, #d4a017 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {formatted} {currency}
        </span>
        <span className={`${preset.sub} tracking-[0.3em] text-amber-300/60 uppercase`}>
          Holdem Coin
        </span>
      </div>

      {/* Plus button (recharge link) — right side */}
      <button
        type="button"
        onClick={onRechargeClick}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
        aria-label="Recharge currency / 재화 충전"
        title="재화 충전 · Recharge"
        style={{ width: preset.chip * 0.7, height: preset.chip * 0.7 }}
      >
        <img
          src="/src/ui/assets/currency/plus_01.png"
          alt=""
          className="w-full h-full object-contain"
        />
      </button>
    </div>
  );
};

export default CurrencyDisplay;
