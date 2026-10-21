/**
 * holdem_coin :: StoreItem React component
 * ─────────────────────────────────────────────────────────────────────────
 * Renders a single shop item tile (avatar / weapon / armor / accessory).
 * Each item shows its image inside a gold-framed tile, plus a price chip
 * (using the Chip_01 family as currency indicator).
 *
 * Click → opens the parent store popup (store_01.png background).
 * ─────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import type { ChipId } from '../../data/chips';

export type StoreItemCategory = 'avatar' | 'weapon' | 'armor' | 'accessory';

export interface StoreItemData {
  id: string;
  name: string;
  nameKo?: string;
  category: StoreItemCategory;
  imageUrl: string;
  price: number;            // in same units as currency (K)
  priceChip?: ChipId;       // which chip icon to show as the price chip (default Chip_01)
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  description?: string;
}

export interface StoreItemProps {
  item: StoreItemData;
  onClick?: (item: StoreItemData) => void;
  className?: string;
}

const RARITY_RING: Record<string, string> = {
  common:    'ring-gray-400/40',
  rare:      'ring-blue-400/50',
  epic:      'ring-purple-400/60',
  legendary: 'ring-yellow-400/80',
};

const RARITY_LABEL: Record<string, { en: string; ko: string }> = {
  common:    { en: 'COMMON',    ko: '일반' },
  rare:      { en: 'RARE',       ko: '희귀' },
  epic:      { en: 'EPIC',       ko: '에픽' },
  legendary: { en: 'LEGENDARY',  ko: '전설' },
};

const CHIP_URL = '/src/ui/assets/chips/';

export const StoreItem: React.FC<StoreItemProps> = ({
  item,
  onClick,
  className = '',
}) => {
  const rarity = item.rarity || 'common';
  const rarityInfo = RARITY_LABEL[rarity];
  const priceChip = item.priceChip || 'Chip_01';

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={`
        store-item group relative flex flex-col
        bg-gradient-to-b from-amber-950/60 to-black/60
        rounded-lg p-3 text-left transition-all duration-200
        hover:from-amber-900/70 hover:to-black/70 hover:-translate-y-0.5
        focus:outline-none focus:ring-2 focus:ring-amber-300/60
        ring-1 ${RARITY_RING[rarity]}
        ${className}
      `}
      aria-label={`${item.name} · ${rarityInfo.ko} · ${item.price} K`}
    >
      {/* Item image (square, fills the tile's upper portion) */}
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black/60 mb-2">
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-contain transition-transform group-hover:scale-105"
        />
        {/* Rarity badge (top-left corner) */}
        <div className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-200">
          {rarityInfo.en}
        </div>
      </div>

      {/* Item name */}
      <div className="flex flex-col">
        <span
          className="truncate font-serif text-sm text-amber-50"
          title={item.name}
        >
          {item.name}
        </span>
        {item.nameKo && (
          <span className="text-[10px] tracking-wider text-amber-300/50">
            {item.nameKo} · {rarityInfo.ko}
          </span>
        )}
      </div>

      {/* Price row with chip icon */}
      <div className="mt-2 flex items-center justify-end gap-1">
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{
            background: 'linear-gradient(180deg, #ffe27a 0%, #d4a017 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {item.price.toLocaleString('en-US')}
        </span>
        <img
          src={`${CHIP_URL}${priceChip}.png`}
          alt=""
          className="h-5 w-5 object-contain"
          aria-hidden
        />
      </div>
    </button>
  );
};

export default StoreItem;
