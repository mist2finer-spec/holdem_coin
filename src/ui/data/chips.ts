/**
 * holdem_coin :: Chip sprite registry
 * ─────────────────────────────────────────────────────────────────────────
 * Auto-generated enum + metadata for the 10 AI-generated chip sprites.
 * Import paths assume the project is served from web root.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type ChipId =
  | 'Chip_01' | 'Chip_01_a' | 'Chip_01_b'
  | 'Chip_02' | 'Chip_03' | 'Chip_04' | 'Chip_05'
  | 'Chip_06' | 'Chip_07' | 'Chip_08' | 'Chip_09' | 'Chip_10';

export interface ChipMeta {
  id: ChipId;
  index: number;
  url: string;
  /** Approximate visual description, useful for alt text or screen readers. */
  alt: string;
  /** Optional tier (used by the UI to pick the right chip for a stake size). */
  tier: 'small' | 'medium' | 'large' | 'jackpot';
}

const CHIP_BASE = '/ui/chips';

export const CHIPS: readonly ChipMeta[] = [
  { id: 'Chip_01',   index: 1,  url: `${CHIP_BASE}/Chip_01.png`,   alt: 'Single red game token (original)',           tier: 'small' },
  { id: 'Chip_01_a', index: 1.1, url: `${CHIP_BASE}/Chip_01_a.png`, alt: 'Single blue game token (color variant a)',   tier: 'small' },
  { id: 'Chip_01_b', index: 1.2, url: `${CHIP_BASE}/Chip_01_b.png`, alt: 'Single purple game token (color variant b)', tier: 'small' },
  { id: 'Chip_02',   index: 2,  url: `${CHIP_BASE}/Chip_02.png`,   alt: 'Stack of two tokens: blue on red',           tier: 'small' },
  { id: 'Chip_03',   index: 3,  url: `${CHIP_BASE}/Chip_03.png`,   alt: 'Stack of two tokens: green on red',          tier: 'small' },
  { id: 'Chip_04',   index: 4,  url: `${CHIP_BASE}/Chip_04.png`,   alt: 'Stack of five mixed-color tokens',           tier: 'medium' },
  { id: 'Chip_05',   index: 5,  url: `${CHIP_BASE}/Chip_05.png`,   alt: 'Stack of six purple and gold tokens',        tier: 'medium' },
  { id: 'Chip_06',   index: 6,  url: `${CHIP_BASE}/Chip_06.png`,   alt: 'Tall column of eight red tokens',            tier: 'medium' },
  { id: 'Chip_07',   index: 7,  url: `${CHIP_BASE}/Chip_07.png`,   alt: 'Multiple side-by-side multi-color stacks',   tier: 'large' },
  { id: 'Chip_08',   index: 8,  url: `${CHIP_BASE}/Chip_08.png`,   alt: 'Multi-height colorful stacks with gold',     tier: 'large' },
  { id: 'Chip_09',   index: 9,  url: `${CHIP_BASE}/Chip_09.png`,   alt: 'Rich arrangement of red, green, blue stacks',tier: 'large' },
  { id: 'Chip_10',   index: 10, url: `${CHIP_BASE}/Chip_10.png`,   alt: 'Jackpot pile of gold, silver, rainbow tokens',tier: 'jackpot' },
] as const;

export const CHIP_BY_ID: Record<ChipId, ChipMeta> = Object.fromEntries(
  CHIPS.map(c => [c.id, c]),
) as Record<ChipId, ChipMeta>;

export const CHIP_BY_INDEX: Record<number, ChipMeta> = Object.fromEntries(
  CHIPS.map(c => [c.index, c]),
);

/** Pick a chip tier for a given stake amount (in same units as Leaderboard `amount`). */
export function pickChipByAmount(amount: number): ChipMeta {
  if (amount <  500_000) return CHIP_BY_ID.Chip_01;
  if (amount <  1_000_000) return CHIP_BY_ID.Chip_02;
  if (amount <  2_000_000) return CHIP_BY_ID.Chip_03;
  if (amount <  5_000_000) return CHIP_BY_ID.Chip_04;
  if (amount <  8_000_000) return CHIP_BY_ID.Chip_05;
  if (amount < 12_000_000) return CHIP_BY_ID.Chip_06;
  if (amount < 20_000_000) return CHIP_BY_ID.Chip_07;
  if (amount < 30_000_000) return CHIP_BY_ID.Chip_08;
  if (amount < 50_000_000) return CHIP_BY_ID.Chip_09;
  return CHIP_BY_ID.Chip_10;
}
