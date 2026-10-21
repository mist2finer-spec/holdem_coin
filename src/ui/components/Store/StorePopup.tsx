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

const CATEGORIES: {id:StoreItemCategory;labelKo:string}[] = [
  {id:'weapon',labelKo:'무기'},
  {id:'armor',labelKo:'방어구'},
  {id:'accessory',labelKo:'액세서리'},
  {id:'avatar',labelKo:'아바타'},
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
  const [activeCat, setActiveCat] = useState<StoreItemCategory>(items[0]?.category || 'weapon');

  const filtered = useMemo(
    () => items.filter(i => i.category === activeCat),
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
        className="store-window relative z-10 w-full max-w-3xl overflow-hidden rounded-lg shadow-2xl"
        style={{
          backgroundImage: `url(/ui/store/store_01.png)`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <header className="store-heading"><h2>{title}</h2></header>

        {/* Category tabs */}
        <div className="store-categories" aria-label="아이템 분류">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              aria-pressed={activeCat===c.id}
            >
              {c.labelKo}
            </button>
          ))}
        </div>

        {/* Item grid (scrollable) */}
        <div className="store-item-scroll">
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
