# RPG data tables

Editable runtime data: `src/components/rpg/data/hunt-tables.json`.

| Table | Key / references | Runtime consumer |
| --- | --- | --- |
| assets | id, skeleton path, ground slots, animation clips | hunt-renderer |
| attacks | id, damage, defense factor, windup, reach, recovery | hunt-engine |
| monsters | id → assetId / attackId; HP, movement, pursuit, respawn, rewards | hunt-engine / default hunt balance |
| stages | id → monsterId; width, spawn positions, active limit, forward recycling | combat rules / service / hunt-engine |

Current verified web asset: `Enemy_Slime_01_R` (JSON + atlas + PNG). It has only `attack1`, `die1`, `run1`, `stay1`. Hurt falls back to `stay1`; numeric damage feedback is retained. No nonexistent damage animation or unidentified native GUID is claimed.

Current stats preserve the previous prototype: 100 HP, 12 base damage, 45 base movement, 360 pursuit radius, 0.55-second attack windup, 1.3-second recovery, 2-second respawn. Global weapon tempo scales movement as before. Default rewards are 25 gold / 12 XP / 2 soul gems. An explicitly supplied external HuntBalance still overrides default rewards. Stage width remains 6,000 with seven active slimes.

These are **web adaptation values**, not recovered native MonsterData stats. Original monster GUID → skeleton, ability scaling, actual drop probabilities and stage-level scaling need verified records before import. Existing native growth cost formulas remain in `hunt-progression.ts` and optional `RPG_BALANCE_PATH`; this change does not replace them.

The loader validates reference integrity, unique IDs, numbers, rewards and spawn bounds. Regression tests verify asset files and animation keys against the real skeleton. Only the selected prototype monster/stage are playable; multiple monster species with different collision sizes require a later renderer/collision extension, not just extra JSON rows.
