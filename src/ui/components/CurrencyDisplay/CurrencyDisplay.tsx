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
import {formatCurrency} from '@/lib/format-currency';

export interface CurrencyDisplayProps {
  amount: number;
  currency?: string;             // default 'K'
  chipId?: 'Chip_01' | 'Chip_01_a' | 'Chip_01_b';  // which chip icon to use as the diamond cover
  onRechargeClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';     // responsive scaling
}

const CHIP_URLS = {
  Chip_01:   '/ui/chips/Chip_01.png',
  Chip_01_a: '/ui/chips/Chip_01_a.png',
  Chip_01_b: '/ui/chips/Chip_01_b.png',
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({amount,currency='싱글',chipId='Chip_01',onRechargeClick}) => (
 <div className="lobby-currency" role="group" aria-label={`${currency} 잔고 ${amount.toLocaleString('en-US')}`}>
  <img src={CHIP_URLS[chipId]} alt=""/><div><strong>{formatCurrency(amount)}</strong><small>{currency}</small></div>
  <button onClick={onRechargeClick} aria-label={`${currency} 충전`}><img src="/ui/currency/plus_01.png" alt=""/></button>
 </div>
);
export default CurrencyDisplay;
