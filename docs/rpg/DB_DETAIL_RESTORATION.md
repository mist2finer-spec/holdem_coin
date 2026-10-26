# Detailed RPG reference restoration — 2026-10-26

This adds a private data compiler, read-only query tool and original-build numeric
reference. It does not silently migrate live guest inventories, replace the current
guide10 growth board, or claim the original game's full server was reconstructed.

## Actual recovered scope

The supplied 58 decoded static tables and 7,717 separately decoded stage records
are indexed without replacing absent fields with guessed zero/false/empty values.
The generated SQLite retains complete source JSON and each top-level vector row,
plus ability references, nested costs, conditions, unresolved defaults and selected
explicit actor/action references. Every input gets a SHA-256 fingerprint.

Actual private run: 59 sources (58 tables + stage pack), 282 vectors, 60,534
records including roots and scalar vector entries, 1,227 curve occurrences,
136,595 ability references, 24,185 conditions. These are index row counts, not
separate gameplay systems. 475,318 unresolved-default occurrences mostly concern
repeated optional/empty vectors; this is not 475,318 proven corrupt values.

Known explicit-reference scan has 23 unmatched occurrences: 19 reference the
ActorType0 sentinel; four actor skill references2036/2016/2430/2056 lack an
ActionData.SkillType row in this supplied dataset. Preserve these as gaps; do not
invent substitute actions. This scan is deliberately bounded to declared fields,
not a claim that every cross-table reference has been validated.

Full level exports: 160,309 combat-art/trait values (including level0 and each
cap); 1,560 learnable-skill level records. All 65 Grade0 skill definitions remain
in the SQLite but are not assigned the ordinary grade1..7 upgrade policy.

## New original numeric evaluators

- Combat arts: all629 definitions, original AbilValInc × level, original ability
  rounding. The numeric helper itself has no cap check; profile validation does.
- Traits: all780 original nodes with Board/Group/X/Y/special/rare fields. The
  native numeric helper returns0 above MaxLevel, rather than clamping. Importing
  an over-cap profile is rejected. Original board adjacency purchase rules remain
  separate from numeric evaluation and from the guide-specific13-category UI.
- Skills: holding ability uses base + increment × (level−1); awakening selects
  the requested level's value, not a sum. ParamCalcMethod0 selects a level row;
  method1 applies base + increment × (level−1) using float32 multiply and add
  separately, including SIMD lanes V1..V9. Out-of-range/malformed numeric branches
  return the native zero vector. Missing required decoded fields still raise.
  Parameters are not automatically interpreted as HP damage without ActionData.
- Mastery: selected63-stage snapshot, not cumulative addition of prior snapshots;
  PowerBlow/FinishBlow unlock flags retained. Null ability vectors have a proven
  native zero-count path.
- Will: current grade's snapshot plus original per-level increments; all66 grade
  definitions retained. Card, awakening and evolution configurations are indexed
  but not folded into the numeric profile without separate session evidence.
- Combined profile: original Team base + owned/equipped weapon/armor/ring + art,
  trait, mastery, will and ordinary skills; caps are applied after contributions.
  Each source has a ledger. Existing stored options and eligible HoldOps reuse
  the already restored equipment evaluator. Unknown effects/conditions stay
  pending. Grade0 skill ownership and equipment breakthrough extensions require
  their own context rather than accepting a guessed max level.

Rune/Gear/Artifact/Relic/Arcane/SubWeapon/Costume/Treasure/etc. definitions are
queryable with their actual arrays/curves/conditions. Their complete session
aggregation and acquisition behavior are not newly claimed restored.

## Independent native verification

`verify_growth_native.py` verifies the exact audited native SHA-256 before running
original ARM64 in Unicorn. 12,220 comparisons pass:

| Evaluator | Cases |
|---|---:|
| Combat arts |3774|
| Traits |4680|
| Skill holding |228|
| Skill parameter vectors |2622|
| Skill awakening |228|
| Mastery snapshots |530|
| Will grade snapshots |130|
| Will per-level values |28|

List getters, ability-type getters, libc modf and .NET's two-decimal Round overload
are hooked. Numeric branches/float32 arithmetic execute original instructions.
This is not an emulation of the whole session, server, RNG or complete HP damage.
Native modules must be resolved per assembly; do not index the Assembly-CSharp
module using method tokens from InHouse.Balance.Runtime. The audited ELF uses
relative relocations, and executable PT_LOAD VAs differ from file offsets.

## Commands

Only standard-library Python is needed for compilation/query/profile evaluation.
The optional native verifier additionally needs unicorn/pyelftools/capstone.
Original source inputs and generated databases stay outside this public repo.

```sh
npm run rpg:restore:db -- --source /private/vardian-combat-db-review --output /private/new-detail
npm run rpg:db -- --db /private/new-detail/vardian-reference.sqlite records CombatArtData CombatArtDatas --type 101
npm run rpg:db -- --db /private/new-detail/vardian-reference.sqlite growth skill 1005 10
npm run rpg:db -- --db /private/new-detail/vardian-reference.sqlite cost weapon 1101 1 --count 10
# Art UI uses a different convention; request that curve-level shift explicitly.
npm run rpg:db -- --db /private/new-detail/vardian-reference.sqlite cost art 101 0 --count 10 --curve-level-offset 1
npm run test:rpg:reference
```

Costs retain original binary64/intermediate-floor arithmetic. Quote output is a
non-mutating planning result: unlocks, same-type copies, material debits,
breakthroughs and transactions must be checked separately. Missing/zero curves
never authorize free upgrades. Team materialType3 is the decoded EXP identifier.

SQLite creation uses an in-memory rollback journal for a portable, closed offline
artifact. It performs integrity/foreign-key checks and reopens the completed file
read-only. Generated data is not a live save or server migration.

## Remaining evidence-dependent work

1. Full actor effects/target mitigation/HP-damage ordering, rather than a single
   attack-minus-defense approximation.
2. Exact server purchase/combination/option RNG and consumption decisions.
3. Trait adjacency/unlock execution, all growth-system aggregation and loadouts.
4. Grade0 skill owning-system/level mappings and missing four actor action rows.
5. StringData_23 display strings and ChatForbiddenWords decoding.

These gaps are preserved explicitly. Existing public prototype adapters (test
HP10000, six web-skill mappings, simplified traits, rewards) are not relabeled as
original behavior or changed by this offline recovery patch.
