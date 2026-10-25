# Curated recovered growth in the live hunt

The web now evaluates grade1 weapon types1101/1102/1103/1104 and armor1104
using recovered base/increment coefficients and per-ability rounding. Every
existing four-weapon type contributes its own Hold effect once. Equip effects
come from the selected type. Counts, random options, higher grades, ring slots
and breakthrough are not invented in the current save format.

The committed JSON is a small normalized runtime configuration needed for this
feature, not the original binary tables, metadata or decompiled sources.

Attack = round-even((weapon flat Atk + attack training) * weapon Atk multiplier
* armor Atk multiplier). Natural HP = round-even((100 + armor flat HP + health
training) * armor HP multiplier). Damage channels from owned weapons are kept
separate: basic/physical versus skill/magic. Core fields round to integer and
rate fields to two decimals. Current character combo/weapon motion profiles
and their web damage/speed adjustments remain in effect.

New Gold training: Attack101 contributes +1 flat Atk per rank; Health102 +5 HP.
Both are capped at500. Recovered cost curve is evaluated at rank+1 for the next
purchase, with an explicit web rank convention (first purchase150 Gold).
Original prerequisite automation is not reproduced. The web offers both ranks
from the start. Team XP uses the first four recovered segments, cap200.
Team level alone no longer invents +1.5 flat attack per level.

## Explicit web adapters

Test HP stays10000. Since full original target-defense/effect branches are not
yet restored, incoming monster damage scales by119/naturalHP rather than the
old invented flat armor defense. This makes recovered HP growth meaningful
under fixed test HP, and is NOT claimed as the original HP damage formula.
Outgoing combo damage uses recovered Attack/6 to preserve starting pacing.
Unarmed keeps an explicit web training profile; it has no original weapon Type.
Character critical variation is retained around recovered base crit5% and
crit damage1.2x. Existing weapon power/speed animation profiles are web settings,
not a second claim about original weapon-kind multipliers.

## Save and transaction behavior

Missing attackTraining/healthTraining migrate to0. Weapon levels, armor levels,
Gold, Soulgem, EXP and existing quests are not reset by schema migration.
Ranks persist in the same server-authoritative JSON record. Sequence retries
and revision CAS protect both new Gold purchases against duplicate charges.
Grade1 gear cap50 is enforced even if an external curve config spans farther.
Old above-cap levels remain stored but contribute only through cap50.

Render free local SQLite storage is still ephemeral across replacement
instances; this patch does not provision a persistent database or change plans.

## UI

Growth shows actual attack, natural growth HP, critical rate, next training
costs and armor HP preview. Weapon inventory previews selected weapon attack,
next attack and accumulated equipped multiplier instead of fake +2/level.
Existing inventory icons are reused; no new generated character/UI assets.
