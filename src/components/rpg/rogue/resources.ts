/** Test-run resources; do not spend the account's legacy campaign inventory. */
export const MANA={maximum:100,regen:10,cost:[8,10,12,14,8,10]} as const;
export const POTIONS={charges:3,healthFraction:.4,manaFraction:.5,cooldown:8} as const;
export type PotionKind='health'|'mana';
