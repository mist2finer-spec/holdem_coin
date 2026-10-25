# Combat stat and equipment reference restoration

Reference tooling and native arithmetic evidence. A curated grade1 subset is now
integrated into the live hunt; see LIVE_RECOVERED_GROWTH.md for exact scope and web adapters.
Raw original tables, metadata, native binaries and generated private outputs must
not be committed to this public repository.

## Restored behavior

- Weapon/armor linear Equip and Hold: base + increment * (level - 1).
- Ring linear Equip and Hold: base + increment * level.
- Step abilities select the last eligible MinLevel; replace, not sum, prior segments.
- Ability IDs 7..12 use integer midpoint-to-even rounding; others use two decimals.
- Attack and HP use ordered per-source multipliers and conditional damage-flag masks.
  Final helper values round midpoint-to-even and clamp to zero.
- Original DB ability IDs are not runtime field indices. The metadata has 312
  instance numeric fields and a separate static Null field. Map by proven names.
- Contributions explicitly separate Equip/Hold. No inferred ownership stacking,
  option RNG, slot unlock, breakthrough, purchase, or combination rules.

`reference_equipment.py` evaluates these rules. `restore_combat_stats.py`
exports a private catalog and all level/ability values from decoded inputs.
The new unit tests cover ring vs weapon level conventions, rounding, step
boundaries, explicit contribution channels, conditional products, invalid input,
and missing-curve rejection.

## Run

```
npm run test:rpg:reference
npm run rpg:restore:stats -- --recovered /private/decoded \
  --enums /private/metadata-enums.json --fields /private/actor-ability-fields.json \
  --plans /private/stat-plans.json --output /private/new-stats-export
```

Outputs: `equipment-evaluated.csv`, `summary.json`, `example-loadout.json`, and
private source tables/metadata mappings under data/. Output must be a new folder.

Supplied build validation: 240 attack/HP comparisons and 3,180 equipment
comparisons against ARM64 in Unicorn. Numeric anti-cheat decoding/libc modf and
list getters/.NET two-decimal Round are hooked. Thus this validates arithmetic,
flag paths and step selection, not the entire client/session/server behavior.
The 3,180 equipment cases include ten levels per ability and may exceed an
item's gameplay level cap to check pure evaluator boundaries; they do not
establish permission to equip/upgrade above the cap.

The private worked example explicitly requests Equip and Hold for weapon1101
and armor1104 at level1, with the original Team base. It yields Atk6 and HP119,
with first upgrade costs 40 and 400 Soulgem. It excludes options and all other
progression systems and is not a claim about a normal original account.

## Integration gate

A full original-engine replacement remains gated on session ownership/dedup,
loadout slots, random options, stat limits, and target damage/defense. The live
curated subset only covers the current four owned grade1 weapon types and armor.
The current user-requested test HP10000 must remain explicit during integration.

## Follow-up session restoration

`reference_session_equipment.py` adds per-type owned schema aggregation, Hold
once per stored row (not multiplied by physical count), Equip/normal options
only on equipped types, and weapon-kind attack speed/damage contributions.
Preset selection uses the stored alternating preset-type/index list. Option
codes decode lock bit31, grade bits8..15 and option index bits0..7. Locked options
have the same combat value. Random option generation/seed reproduction is not
implemented; the evaluator consumes stored codes.

Single own-type HoldOp conditions (WeaponOpsGrade30, ArmorOpsGrade38,
RingOpsGrade43) check all five option presets for enough grade-qualified slots.
Unrecognized or multiple conditions remain explicit pending results.

Static Session.CheckCondition branches32/33 restore the supplied first
breakthrough requirements: all matching tier1 grade8 weapons at level600,
and two tier1 grade8 subweapons at their max levels. Next-degree and current-cap
checks are separate. These condition branches have source inspection/unit tests,
not a full native Session emulation. Server charging/consumption is not restored.

CalcArmorDamage is armor/groggy gauge loss, not HP mitigation. Its flag-dependent
positive contributions are restored separately. Original bit decoder matches
305 native cases; armor gauge arithmetic matches200 native cases (getter hooked).
Full HP damage with all actor effects remains outside this module.
