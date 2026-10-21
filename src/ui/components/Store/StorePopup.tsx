/**
 * holdem_coin :: StorePopup React component
 * ─────────────────────────────────────────────────────────────────────────
 * Full-screen modal that opens when user clicks the Store button.
 * Uses store_01.png (parchment-style background with top banner and 3 diamonds)
 * as the popup's background template.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │   ◇  [Banner: STORE / 상점]  ◇ ◇         │
 *   │                                          │
 *   │   ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
 *   │   │item│ │item│ │item│ │item│  (grid)   │
 *   │   └────┘ └────┘ └────┘ └────┘           │
 *   │   ...                                    │
 *   │                                  [× Close]│
 *   └─────────────────────────────────────────┘
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo, useEffect } from 'react';
import { StoreItem, type StoreItemData, type StoreItemCategory } from './StoreItem';

export interface StorePopupProps {
  open: boolean;
  items: StoreItemData[];
  onClose?: () => void;
  onItemClick?: (item: StoreItemData) => void;
  title?: string;
  titleKo?: string;
  className?: string;
}

const CATEGORIES: { id: StoreItemCategory | 'all'; label: string; labelKo: string }[] = [
  { id: 'all',        label: 'ALL',         labelKo: '전체' },
  { id: 'avatar',     label: 'AVATAR',      labelKo: '아바타' },
  { id: 'weapon',     label: 'WEAPON',      labelKo: '무기' },
  { id: 'armor',      label: 'ARMOR',       labelKo: '방어구' },
  { id: 'accessory',  label: 'ACCESSORY',   labelKo: '액세서리' },
];

export const StorePopup: React.FC<StorePopupProps> = ({
  open,
  items,
  onClose,
  onItemClick,
  title = 'STORE',
  titleKo = '상점',
  className = '',
}) => {
  const [activeCat, setActiveCat] = useState<StoreItemCategory | 'all'>(items[0]?.category || 'all');

  const filtered = useMemo(
    () => activeCat === 'all' ? items : items.filter(i => i.category === activeCat),
    [items, activeCat],
  );

  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose?.();};
    document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);};
  },[open,onClose]);
  if (!open) return null;

  const handleClose = () => onClose?.();

  return (
    <div
      className={`store-popup fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} / ${titleKo}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Popup body with parchment background */}
      <div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-lg shadow-2xl"
        style={{
          backgroundImage: `url(/ui/store/store_01.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Top banner (matches store_01.png's built-in banner) */}
        <div className="pt-12 pb-3 text-center">
          <h2
            className="font-serif text-3xl font-bold tracking-[0.3em]"
            style={{
              background: 'linear-gradient(180deg, #4a2c0e 0%, #1a0a02 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 1px 0 rgba(255, 220, 130, 0.5)',
            }}
          >
            {title}
          </h2>
          <p className="text-xs tracking-[0.4em] text-amber-900/70 mt-1">{titleKo}</p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-2 px-6 mb-3">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={`
                px-3 py-1 rounded-full text-[11px] tracking-wider transition
                ${activeCat === c.id
                  ? 'bg-amber-900/80 text-amber-50 ring-1 ring-amber-400/50'
                  : 'bg-amber-100/40 text-amber-900/70 hover:bg-amber-200/60'}
              `}
            >
              {c.label} · {c.labelKo}
            </button>
          ))}
        </div>

        {/* Item grid (scrollable) */}
        <div className="px-6 pb-6 max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(item => (
              <StoreItem key={item.id} item={item} onClick={onItemClick} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-amber-900/50 text-sm">
              해당 카테고리에 표시할 아이템이 없습니다 · No items in this category
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-amber-200 hover:bg-black/80 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
          aria-label="Close store popup · 상점 닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default StorePopup;
