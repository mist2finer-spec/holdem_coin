# Skill links + Umbra core — web prototype

## Play

`/hunt` → Hong → Hunt → bottom **젬 · 코어**. In the legacy campaign, open **성장 · 장비 → 젬 링크 · 옴브라 코어**.

Six existing active skills retain their original animation/event path. Each has three support sockets. Six reusable test gems are available without purchasing or consuming an inventory item. A gem cannot appear twice in one active link; the same gem can be used on different actives. Compatibility uses ANY matching tag. No client-supplied damage/stat values are accepted.

| Gem | Effect | Eligible tags |
| --- | --- | --- |
| 강타 / power | effect ×1.30, cooldown ×1.15 | PHYSICAL, SPELL |
| 광역 / wide | range ×1.40, effect ×0.90 | AREA |
| 메아리 / echo | two pulses, each ×0.65; second after 0.22s | MELEE, SPELL, HEAL |
| 가속 / quick | cooldown ×0.75, effect ×0.90 | MELEE, SPELL, HEAL |
| 도달 / reach | range ×1.25, effect ×1.08, cooldown ×1.10 | MELEE, SPELL |
| 재생 / renew | healing ×1.45, cooldown ×1.20 | HEAL |

`effect` modifies damage or healing as appropriate. The heal skill never receives attack-only damage passives. Repeats add an actual separately timed hit/heal event and extend the action by 0.22s; they are interruptible by the existing death/action cancellation rules. Active skill modifiers are captured when casting starts. Changing a link neither resets an existing cooldown nor changes an in-flight skill. The dungeon FX range follows the range modifier; campaign retains its original skill VFX art while hit radius changes.

## Trial core

28 nodes = free root + three branches of nine. The names 파괴, 보호, 침식 borrow the native category concept; this graph, values, free points and support gems are **new web prototype balance**, not claimed native DB reconstruction.

- Starting points: 12; +1 per account level beyond level 1; capped at 27.
- 파괴: +6% damage per node, final node +12%. Basic attacks also benefit.
- 보호: 2% incoming damage reduction per node, final node 4%. Applied to both legacy incoming-damage paths and the dungeon path.
- 침식: −2% cooldown and +2.5% range per node.
- Allocation requires root connectivity (undirected edges). Refunds return one point, but cannot disconnect descendants. Root cannot be removed. Reset refunds all non-root nodes; it preserves gem links.
- Damage/range increases are summed first; each gem's More/area multiplier is then multiplied. Cooldown multiplier is floored at 0.35. No support grants arbitrary scripts or executes a trigger string.

`hunt-build.ts` owns the schema, tag compatibility, graph, compiler, validator and immutable command transformation. Both combat engines use this pure module. The core editor provides a 28-node mobile diagram, alloc/refund controls and calculated multipliers.

## Server and save contract

Saved `HuntProgress.build = {version:1,nodes,links[6][3]}`. Existing rows migrate additively without changing level, currency or equipment. Both modes share the existing HttpOnly `rpg_guest` cookie and `players.sqlite` (`RPG_SAVE_DIR` or `.data/rpg`). Dungeon test kill rewards remain separate from campaign balances. This does not add cross-device authentication or change the existing deployment disk/persistence arrangement; an ephemeral service filesystem does not preserve saves across replacement deployments.

Build actions travel through the existing sequenced command endpoint: `gem-i-slot-id`, `core-allocate-id`, `core-refund-id`, `core-reset`. Validation and transformation run on the server, then the existing revision compare-and-swap saves the full progress. A stale writer cannot overwrite another mode's newer progress. Duplicate sequence returns the cached view without a second save. Invalid commands do not advance sequence; terminal validation errors are not replayed indefinitely by the dungeon client. New UI snapshots clone build arrays to avoid mutating earlier views.

## Verification

- `npm run test:rpg:build`: compatibility, invalid commands, modifier order, all 1,000 branch-prefix graphs, point budget, bridge refunds, additive old-save migration, duplicate commands, stale-writer CAS, independent mode/service restart, real dungeon damage/radius/repeat/heal/cooldown/protection, campaign damage/repeat/heal.
- `npm run test:rpg:rogue`: existing map, traversal, spawning, AI, sequence and landing regression checks.
- `npm run test:rpg`: existing RPG and asset regressions.
- `npm run check:rpg`, production Next.js build, and poker-server regression suite.
- HTTP smoke and live browser checks verify actual route wiring and editor save/re-entry.

Formal verification was not run: this feature reuses the synchronous sequence/revision contract, and the bounded three-branch graph plus invalid/duplicate/stale-write cases are directly exercised by deterministic tests. No whole-program safety claim is made.

## Expansion boundary

The prototype intentionally has no gem loot/drop/crafting economy, vision-degree growth, arbitrary trigger execution, conversion chain, projectile shotgun system, or 100-node tree. Those require separate balance and save-version design. Original UmbraCore tables/prices remain unverified; do not label the trial graph an exact restoration. `BuildState` and definitions are data-oriented to allow a later Unity port.
