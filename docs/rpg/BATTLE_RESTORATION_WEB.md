# Web combat restoration adapter

Branch: `feature/rpg-combat-progression`. No poker rule or live deployment change.

## What is playable

- Character selection still uses the nine existing illustrations; heroes use
  their unchanged 16-frame sheets, not archived character Spine rigs.
- Nine explicit **training** loadouts vary 3/4/5-stage chains, reach, power and
  critical chance. They reuse the recovered Axe action timings. This is not a
  claim of original class/weapon motions for the other appearances.
- Up to seven slimes pursue, telegraph a 0.55-second attack, deal damage and
  recover. Damage is checked at impact. Dead targets cannot attack or reward
  twice. Hero death cancels actions; after two seconds a button revives at a
  clear position or returns to character selection.
- Player/monster collision remains swept. Dodge crosses at most three slimes;
  four cancel translation. Translation pauses during a roll and respawn is
  deferred across its corridor, preventing a new blocker at origin/landing.
- Dodge avoidance, a short parry window, critical chance, defensive stats,
  healing and weapon/armor progression are **web balance choices**, not original
  recovered combat formulas. Enemy animations come from the existing slime rig.

## Authority, saving and deployment limits

`POST /api/rpg/session` advances a server-owned HuntEngine, using server elapsed
time with a 0.3-second gap cap. Clients submit controls only. No reported XP,
damage, gold or kills is trusted. There is no offline farming. Duplicate sequence
numbers return the cached result; new out-of-order sequences are rejected.
One active battle per guest prevents an older tab from farming after re-entry.

Guest identity is a random 256-bit HttpOnly, SameSite cookie, separate from poker
currency and login. It is device/browser-scoped, not an authenticated cross-device
account. SQLite saves progress after server-awarded kills and successful upgrades.
Revision checks prevent stale writers, and row updates atomically save all
balances. Battle motion/HP itself is not persisted; re-entry starts a fresh battle.

Requires Node >=22.13 with `node:sqlite` (Render config currently 22.18).
`RPG_SAVE_DIR` chooses the directory containing `players.sqlite`, its WAL and SHM.
Default is `.data/rpg`. Use a persistent mounted path for hosted retention.
Render free service files are ephemeral: this patch does **not** make saves
survive redeployment without persistent storage. No paid service is provisioned.
The server currently supports one Node instance; do not scale this in-memory
battle service horizontally without an ownership/session backend.

## Private recovered DB adapter: one command

From the repository, with existing npm dependencies and decoded native recovery:

```powershell
npm run rpg:restore -- --recovered "E:\Vardian\recovered-native"
```

It exports `data/rpg-reference/runtime-balance.json`, source hashes and verifies
types plus RPG tests. Re-running the same inputs validates without overwriting.
Changed inputs/configurations require a separate `--output` path. Original raw
DB, metadata and native libraries remain private and are never published.

TeamData's recovered 118 segments are loaded, with a web safe-integer cap on the
playable range. The current recovery yields level 5600, whereas the original
TeamData MaxLevel is 7800. The cap is an adapter limitation, not an original rule.
Training weapon and armor use the first recovered coefficient set; their item
identity/stat interpretation and original UI/server level convention remain
separate validation items. Native arithmetic was independently verified earlier.

Unknown original drop counts remain explicit prototype rewards (25 gold,
12 XP, 2 soul gems). Material 131 icon `mat_soulgem` supports the training upgrade
currency label; it does not prove the prototype's drop rates. Other monster
tables/stats and full inventory/loot are not silently imported without enum and
rule interpretation. Default fallback only includes the first recovered curve
and caps level 50; the API's source field distinguishes it from private import.

For the prepared private bundle, run the application with:

```powershell
$env:RPG_BALANCE_PATH = (Resolve-Path "data\rpg-reference\runtime-balance.json").Path
$env:RPG_SAVE_DIR = "E:\VardianWebSaves"
npm run dev
```

Neither raw reference data nor live saves are included in the standalone build.
Set `RPG_BALANCE_PATH` to an explicitly provisioned server-private file for a
hosted deployment. Failure to load configured private data stops the session
instead of quietly substituting a different economy.

## Validation

`npm run check:rpg` checks RPG UI, engine, service and API types despite the
repository-wide Next build setting that skips full-project type errors.
`npm run test:rpg` includes collision, animation, seven-enemy behavior and tests
for hostile damage/death/revival, training loadouts, native curve samples,
SQLite reopen/CAS, guest separation, replay/time manipulation and input rejection.
Original monster AI, damage formula, eight dedicated character motion sets and
login/account migration remain future restoration tasks, not completed claims.
