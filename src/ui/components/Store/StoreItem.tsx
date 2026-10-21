import React from 'react';
import type {ChipId} from '../../data/chips';
import {formatCurrency} from '@/lib/format-currency';
export type StoreItemCategory='avatar'|'weapon'|'armor'|'accessory';
export interface StoreItemData {id:string;name:string;nameKo?:string;category:StoreItemCategory;imageUrl:string;price:number;priceChip?:ChipId;rarity?:'common'|'rare'|'epic'|'legendary';description?:string;}
export interface StoreItemProps {item:StoreItemData;onClick?:(item:StoreItemData)=>void;className?:string;}
export const StoreItem:React.FC<StoreItemProps>=({item,onClick,className=''})=>(
 <article className={`store-item relative ${className}`}>
  <img src={item.imageUrl} alt={item.nameKo||item.name} loading="lazy" className="block w-full rounded-md"/>
  <button type="button" onClick={()=>onClick?.(item)} aria-label={`${item.nameKo||item.name} 가격 ${formatCurrency(item.price)}`}
   className="absolute bottom-[10%] left-[10%] w-[80%] h-[17%] flex items-center justify-center gap-1 rounded text-white font-black text-base sm:text-lg bg-slate-900/50">
   <img src={`/ui/chips/${item.priceChip||'Chip_01'}.png`} alt="" className="h-5 w-5 object-contain"/>{formatCurrency(item.price)}
  </button>
 </article>
);
export default StoreItem;
