/**
 * holdem_coin :: ChipIcon React component
 * ─────────────────────────────────────────────────────────────────────────
 * Renders a single chip sprite from /ui/chips/.
 * Independent from the Leaderboard component (per user choice "완전 분리").
 *
 * Props:
 *   - chipId?: ChipId        — explicit chip id (e.g. 'Chip_05')
 *   - index?: number         — 1..10, alternative selector
 *   - amount?: number        — auto-pick chip tier based on stake amount
 *   - size?: number          — pixel size (default 64)
 *   - showLabel?: boolean    — show "Chip_NN" label below image
 *   - className?: string
 * ─────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  CHIPS,
  CHIP_BY_ID,
  CHIP_BY_INDEX,
  pickChipByAmount,
  type ChipId,
  type ChipMeta,
} from '../../data/chips';

export interface ChipIconProps {
  chipId?: ChipId;
  index?: number;
  amount?: number;
  size?: number;
  showLabel?: boolean;
  className?: string;
  alt?: string;
}

function resolveChip(props: ChipIconProps): ChipMeta | undefined {
  if (props.chipId)              return CHIP_BY_ID[props.chipId];
  if (typeof props.index === 'number') return CHIP_BY_INDEX[props.index];
  if (typeof props.amount === 'number') return pickChipByAmount(props.amount);
  return CHIPS[0];
}

export const ChipIcon: React.FC<ChipIconProps> = ({
  chipId,
  index,
  amount,
  size = 64,
  showLabel = false,
  className = '',
  alt,
}) => {
  const chip = resolveChip({ chipId, index, amount });
  if (!chip) {
    return null;
  }
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <img
        src={chip.url}
        alt={alt ?? chip.alt}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-md"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          background: 'rgba(0,0,0,0.5)',
        }}
      />
      {showLabel && (
        <span className="mt-1 font-mono text-xs text-amber-300/80">
          {chip.id}
        </span>
      )}
    </div>
  );
};

export default ChipIcon;
