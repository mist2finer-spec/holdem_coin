# Labyrinth, monsters and class-specific damage restoration

Private reference recovery, 2026-10-26. Companion to
[DB_DETAIL_RESTORATION.md](DB_DETAIL_RESTORATION.md). These tools do not modify
live saves or substitute an invented spawn system for the original one.

## Recovered data and stage structure

The supplied Labyrinth data contains 6,000 stage records: 1,200 chapters × five
sections. Stage IDs are `chapter * 100 + section`. The requested encounter rule
is retained explicitly: sections1..4 end with a miniboss; section5 ends with a
boss. That rule comes from the user's original-game description. A MonsterDatas
array defines spawn slots, **not a sequential list of waves**.

Each stage retains its complete original record, base stats, slot multipliers,
reward groups and map reference. Chapter rewards retain the actual ten original
arrays, not a guessed fitted exponential curve. `monster-stage-growth.csv`
contains 36,043 evaluated slot records. Another17 hero-relative slots are marked
pending because their hero context is required.

| Stage | Base attack | Base HP |
|---|---:|---:|
|1-1|1|15|
|1-2|2|31|
|1-3|2|48|
|1-4|3|64|
|1-5|3|80|

These are **stage base values**, not final HP for every monster. Each slot's
AbilityDatas values scale those bases by percent. For example100 means×1,
3000 means×30, and10000 means×100. Each slot starts from the stage base; the
six slots must not multiply into each other. Movement begins with original
MonsterMovDistPerSec3 and uses a positive actor override where present.

63 monster ActorTypes retain original skills, AI definitions, AI/phase HP
thresholds, transition delay and invulnerability settings. Their142 available
action timelines retain complete original ActionData alongside resolved events.

## Normal enemies and bosses have different stat channels

StageMonsterFlag.Boss=1024 whereas runtime CombatActorFlag.Boss=1 and Mob=8.
Never pass the stage flag directly to the runtime classifier. The original
damage-flag helper ORs source/target bits into existing flags. The actor Boss
bit wins over Mob when classifying one actor; existing damage bits are preserved.

| Purpose | Normal enemy | Boss |
|---|---|---|
|Attacker damage bonus|VsMobDmgRate21|VsBossDmgRate22|
|Additional EXP buff damage bonus|161|162|
|Defender damage reduction|VsMobDefRate51|VsBossDefRate52|
|Additional EXP buff reduction|166|167|
|Player's enemy HP reduction|MobHpDecRate44|BossHpDecRate45|

Damage bonus example: +20% class damage and +30% class EXP-buff damage produce
×1.50, not×1.56. Only positive contributions are added in this recovered step.

Defense example:20% and30% reductions apply sequentially, leaving56% damage.
Original CombatData.MaxDefRate90 limits the **overall defense-phase chain** to
90% reduction. It is not a per-stat clamp. RingMobAtk/RingBossAtk and other
mode-specific attack factors belong to the previously restored ordered attack
stat evaluator; they are not aliases for VsMobDmgRate/VsBossDmgRate.

Enemy HP adjustment selects44 or45, applies a positive rate, and rounds the
result with ties-to-even. The recovered helper does not invent a1-HP floor or
an extra rate cap. Supply a validated original capped hero profile. Exported
stage stats precede this hero-dependent HP adjustment.

These functions reconstruct named **substeps**, not all of CalcFinalDamage.
Element/critical/effect selection, shields and downstream special branches
remain separate. CalcArmorDamage concerns the groggy gauge; it must not be
misused as ordinary HP armor mitigation.

## Attack mechanics and assets

BasicDatas.Time schedules an action command. Motion1 starts an animation;
Impactor33 creates the hit object. Its Moving/Arrive/Release/Return effect IDs
are matched against the corresponding original EffectDatas indexes and IDs.
Creation is not automatically contact or damage. Collider dimensions, travel,
hit counts, cooldown, MP cost, approach distance and conditions remain explicit.

Example slime Skill2010: HoldTime1.5s, approach distance1, motion at0, impactor
creation at0.15000000596s. A renderer must not treat HoldTime as hit timing or
MovingHitCount as an unconditional number of immediate HP deductions.

The reference interval dispatcher emits each resolved command once in
`(previousTime, elapsedTime]`. Dead actors emit nothing. Conditional actions
require an explicit condition evaluator; unknown conditions do not auto-pass.

Original asset branch revision:
`fef94dd999990ae7437681f4566eed6d84b4ff91`.
73 original enemy Spine packs are copied unchanged. All219 skeleton/atlas/image
files match original catalog SHA-256 values. They include slimes, goblins,
skeletons and other enemy families.49 of63 actors have visual **candidates**:
GUID-adjacent prefab-name evidence followed by a checked local prefab →
SkeletonDataAsset → skeleton TextAsset graph. This is not yet a proven runtime
Addressables key-to-location resolution.14 actors remain unassigned.

The local gallery uses original clips, not generated poses.525 animations were
sampled at30fps,16,915 frames total.524 clips had finite bone transforms in this
check. Enemy_DemonEye_01/rest1 produces a non-finite chain02 transform at its
first frame, with zero-scale chain keys in the source. It is excluded from the
viewer, while its original bytes remain intact. This identifies an observed
asset/runtime incompatibility; it is not a visual QA pass or a proven root cause.

## Verification and remaining gaps

- 65 Python reference tests pass, including all prior growth/equipment tests.
- Original ARM64 SetBossFlag matches7,168 test cases, with no function hooks.
  The native SHA-256 is checked first. This proves that helper, not the full
  damage formula or AI runtime.
- All6,000 stage records have chapter/section coverage; all36,043 evaluated
  slot records have finite nonnegative values.
- Missing ActionData rows: Skill2016/2036/2056 for Actor1011/1012/1013. No made-up
  attacks are substituted.
- 172 action commands have unresolved child definitions:98 Light31,
  64 PinTarget34,8 Dissolve12 and2 Fill13. Their raw basic records and complete
  parent action are preserved. They are not reported as executed.
- Map metadata96 records and scene metadata17,843 records were also inspected;
  no explicit spawn-wave schedule was recovered from those exported component
  fields. Scene trigger/entity execution, runtime resource mapping and missing
  action children still need their source data or further native tracing.

## Reproduce privately

```sh
npm run rpg:restore:labyrinth -- \
  --decoded /private/decoded --catalog /private/catalog_strings.csv \
  --asset-index /private/assets.json --spine-index /private/spine.json \
  --gameobjects /private/GameObject.zip --monobehaviours /private/MonoBehaviour.zip \
  --output /private/new-monster-export --repo . --copy-assets
npm run rpg:audit:labyrinth -- --root /private/new-monster-export --asset-index /private/assets.json
node scripts/rpg/verify_monster_assets.mjs /private/new-monster-export
npm run test:rpg:reference
```

The optional gallery requires bundling `monster-gallery.ts` with esbuild and
copying `monster-gallery.html` as gallery.html. Its bundle must include the
Spine runtime license. The delivered private archive already includes these.
Serve that directory with `python -m http.server 8766`, then open
`http://localhost:8766/gallery.html`.


## Web integration update

The deployed adapter now uses all6,000 recovered stage stat rows. Each web
section contains six ordinary enemies followed by one final encounter. This
seven-slot layout and its fixed coordinates are a web adaptation, not a
recovered native wave schedule. Sections1..4 select the first boss slot;
section5 selects the last boss slot. Ordinary spawn slots repeat cyclically.

The server opts into finite campaigns; older isolated engine fixtures keep
legacy respawn behavior. Dead campaign enemies never respawn. A cleared boss
awards chapter-based gold/EXP/soulgem once, advances the saved numeric checkpoint
and opens the next section after two seconds. The final section remains complete.
Requests cannot select stages or submit rewards. Existing guest rows receive an
additive checkpoint migration. Full native acquisition/RNG is not asserted:
chapter base rewards are paid per section as a web economy choice, alongside
existing kill rewards; wallet values retain the existing1e12 storage ceiling.
Existing native-derived player equipment/cost/EXP adapters remain in use.

41 monster asset packs are included. Unresolved source visual mappings use
explicitly marked thematic web substitutes (for example GuardianGoblin uses
GoblinWarrior_Boss). They are not promoted to proven source mappings. The browser
loads new monster rigs lazily and normalizes display height while preserving
original pose data. Attack timing uses the first recovered impactor timeline;
full projectile travel, alternate skills, phase AI and effect execution are not
newly implemented by this integration. Class damage and defense substeps are
connected to live combat; the overall web damage pipeline remains an adapter.

Checkpoint persistence uses the existing RPG SQLite store. Deployment storage
retention still depends on that store's configured filesystem; no disk plan or
account system is changed here.


## Follow-up audit correction

The172 unresolved command links above were an incomplete extractor map, not
missing source payloads. Light/PinTarget/Dissolve/Fill child records have now
been matched by ID/index. See COMBAT_GAP_AUDIT_20261026.md for this correction,
the31 non-kill-all victory conditions, time limits and enum-map review warning.
