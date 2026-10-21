/**
 * holdem_coin :: Demo store catalog
 * ─────────────────────────────────────────────────────────────────────────
 * Sample shop items that showcase the uploaded assets. Each entry maps to
 * a real image file in /ui/shop/.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { StoreItemData } from '../components/Store/StoreItem';

export const DEMO_STORE_ITEMS: StoreItemData[] = [
  {
    id: 'avatar_1',
    name: 'Knight Badge',
    nameKo: '기사 훈장',
    category: 'avatar',
    imageUrl: '/ui/shop/avatars/avatar_1.png',
    price: 250_000,
    priceChip: 'Chip_04',
    rarity: 'rare',
    description: 'A badge of honor for seasoned players. Unlocks the knight avatar frame.',
  },
  {
    id: 'weapone_1',
    name: 'Rune Sword',
    nameKo: '룬 검',
    category: 'weapon',
    imageUrl: '/ui/shop/weapons/weapone_1.jpg',
    price: 750_000,
    priceChip: 'Chip_06',
    rarity: 'epic',
    description: 'A legendary blade inscribed with ancient runes. Increases chip stack glow effect.',
  },
  {
    id: 'armor_1',
    name: 'Ring of Embers',
    nameKo: '잔불의 반지',
    category: 'armor',
    imageUrl: '/ui/shop/armor/armor_1.png',
    price: 500_000,
    priceChip: 'Chip_05',
    rarity: 'epic',
    description: 'A glowing ring forged from molten gold. Reduces chip loss on bad beats.',
  },
  {
    id: 'acce_1',
    name: 'Amber Earrings',
    nameKo: '호박귀걸이',
    category: 'accessory',
    imageUrl: '/ui/shop/accessories/acce_1.png',
    price: 120_000,
    priceChip: 'Chip_03',
    rarity: 'rare',
    description: 'Teardrop amber earrings with golden filigree. Adds +5 style points.',
  },
];
