# Recovered combat runtime integration — 2026-10-26

This patch integrates the supplied action/stage data into the server-authoritative
web battle. It is not a claim that every native combat/effect/map branch has been
reconstructed. No poker rules are changed.

## Connected behavior

- Monster skill lists, per-slot skill/AI overrides, literal cooldowns, native
  approach ranges, HP/time/use-count conditions and action command schedules.
  Unsupported conditions fail closed. MP-requiring or unresolved-parameter skills
  are not silently cast for free. High-priority/non-default skills are selected
  before basic attacks when ready. The shared AI uses recovered wait intervals;
  it does not use the suspect MonsterAIType name/value map identified in the audit.
- Motion command changes restart clips during the cast. Source clip naming is
  mapped to the available Spine clips; dash/move/summon action execution remains
  separate. Missing clips use the existing visual fallback.
- Individual impactors emit at their configured times/counts/intervals. Ranged
  attacks travel before contact; moving contact uses swept collision, so a fast
  projectile cannot skip a target between server ticks. Moving/arrive/release
  phases and per-target hit records prevent uncontrolled frame damage. Original
  unique/repeat settings are retained. The web runtime bounds active impactors
  at256 and per-command emission at64 for its seven-slot encounter adapter.
- Literal damage, self-heal, shield and selected CC effects are executable.
  Stun/freeze/airborne/knockdown interrupt player actions; recovery and duration
  expiry are explicit. Knockback respects solid enemy bodies. Dodge/parry avoid
  contact. The original full effect/filter/marking interpreter remains incomplete.
- Monster collider radii vary with recovered actor size. Player melee reach
  includes the target's radius, preventing auto-approach from stalling outside a
  large boss. Normal movement and dodge landing use those radii.
- Web player area skills can hit several enemies at their scheduled impact.
  These six skill identities/level multipliers remain the existing web adaptation,
  not verified mappings for every native player SkillType.

## Formula and growth corrections

Original relative-stat helper arithmetic is now used with both actors' stats:
`tanh((attacker - defender) / 300 * 1.2) * limit`, with limit0.2 for Valor/Mental/
Focus and0.5 for Tenacity. Accuracy is bounded as a probability, and CC duration
uses the recovered Tenacity adjustment. Focus is ability12 and Tenacity11;
previously these two display/runtime fields were swapped.

The audited ARM64 CalcTanHValor/Mental/Tenacity/Focus match196 comparisons.
Configuration lookup and libc tanh are hooked; original helper arithmetic executes
in Unicorn. See combat-coefficients-verification.json and the reproducible verifier.
This verifies those substeps, not the full native damage pipeline.

All118 original team EXP curve segments and the original7,800 level cap are
included. EXP storage/rewards saturate at Number.MAX_SAFE_INTEGER; other existing
wallets retain their1e12 ceiling. Final-level cost fits the safe integer range.
The user's test HP10000 remains. All native equipment grades/options and the
complete source damage/loot/economy are not newly claimed restored.

## Stage objectives and failure

The6,000 original stage rules now carry victory conditions, values/object IDs,
limits and slot overrides. Ordinary stages retain the finite web layout of six
normal enemies followed by a final encounter. Kill-count stages instead create
bounded waves, stopping at the exact original target rather than respawning
forever. Endpoint stages require reaching the exit; object/state objectives
require authoritative proximity interaction. The client cannot submit completed
objects, kills or currency. AUTO can approach remaining objective markers.

1,230 time limits are active. Timeout, player death or escort defeat enter a
failed state without advancing the checkpoint. Retry after two seconds starts
that section again. Completed sections advance once, after the existing clear
transition; request sequence and SQLite revision checks protect reward writes.

**Spatial adapters:** original per-map spawn/action graphs and coordinates are
not available. Exit/object marker positions and the escort proxy use explicit
web geometry. The escort uses the test player HP pool, not a recovered NPC stat
profile. Original object IDs and known global attack/HP modifiers are retained,
but original pickup/drop rules and all graph side effects are not implemented.
Object interactions are available through the button, AUTO or R. Replaying a
failed section retains prior earned kill rewards under the existing web policy.

## Remaining source-dependent work

- Exact map triggers, wave composition/positions and native NPC identity/stats.
- Skill2016/2036/2056, unknown action/effect filters, symbolic skill parameters,
  all summoning/dash/root-motion paths, full MP/passive/buff ordering.
- Full physical/magic/element/critical/shield/final-damage ordering. Current
  class-specific damage/reduction and relative-stat substeps are connected,
  while other web damage policies remain adapters.
- Original reward-group event routing/RNG, complete equipment growth/session
  aggregation, runtime state persistence across a process restart.
- Repair and independently verify the10 suspect metadata enum constant maps;
  do not infer names from their existing erroneous integer values.

## Validation

86 RPG tests cover existing gameplay plus projectile scheduling/contact,
phase hit deduplication, multiple boss skills, large-body melee reach, endpoint/
object objectives, exact finite kill quotas, timeout/retry, escort defeat,
CC expiry, EXP persistence and relative-stat behavior. The existing66 Python
reference tests and196 native coefficient cases are separate checks. TypeScript
and production build validation are required before deployment.
