# Original Vardian database recovery

This is tooling/reference work. It changes no game rules or production database.
Branch: `tools/vardian-db-recovery`. Do not commit raw game data, account files or decompiled implementations.

## Evidence already recovered

`vardian-balance-20261022-203717(1).zip` contains seven binary tables: ActionData,
ActorData, ArmorData, CombatData, MasteryData, SkillData and WeaponData. Each has
a bounded-valid FlatBuffer root/vtable. The accompanying installed-data listing
contains 61 filenames, including TeamData, MaterialData, GearData, MonsterData,
StageData, HuntingData and UnlockData. A listing is not possession of those bytes.

The new offline audit inspected all seven files. Root slot 4 has structurally
valid table-vector candidates of 421 / 148 / 26 / 63 / 141 / 32 records for Action,
Actor, Armor, Mastery, Skill and Weapon respectively. Armor/Weapon/Skill also
contain other root fields. These numbers alone do not prove the meaning of
those vectors or identify their child schemas. CombatData has scalar-looking
root fields and is not treated as a single record-list table.

The complete handoff was searched across its source, native-helper, native-CFG
and system-design archives. Matching balance schema files were not found there.
The prior combat-chain archive has five Action child schema excerpts, which
cannot be substituted for Team/Material/Weapon/Gear schemas.

Managed metadata confirms these player-state fields (not their default values):

| State | Confirmed field names |
|---|---|
| TeamSchema | id, level, unlockedContents, power |
| WeaponSchema | type, level, breakthroughDegree, count, opSeed, ops1–ops5, opPresets, locked |
| ArmorSchema | type, level, count, opSeed, ops1–ops5, opPresets |
| GearSchema | uid, type, grade, level, extOps, locked |
| MaterialSchema | type, count, rechargedTime |

Native evidence: `GameClient.WeaponLevelUp` token 0x60005DF builds type/level/incAmt
request fields; `OnWeaponLevelUp` 0x600073C reads Weapon and ResourceResult,
copies state and calls `ResourceResultProcessor.Apply` 0x600078A. TeamLevelUp
0x60005C9 / OnTeamLevelUp 0x6000726 similarly applies Team and ResourceResult.
This supports response-driven client state, not a claim about the server's DB engine.

XP curves, upgrade prices, reward quantities and missing-field defaults are NOT
restored. Do not substitute zero/false from exported C# stubs. Current browser
prototype gold/XP rewards remain explicit mock values.

## Collect on the Windows PC

Download `scripts/rpg/collect_vardian_db.ps1` to Downloads, start BlueStacks and
enable Android Debug Bridge. The game need not be launched or updated.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\collect_vardian_db.ps1"
```

Default schema directory:
`$env:USERPROFILE\VardianRE\reports\acheive\cpp2il_isil_v1211\IsilDump\InHouse.Balance.Runtime`.
Use `-SchemaRoot PATH` for a different, narrowly scoped matching-build directory.
The script detects the connected device; with multiple devices use `-Device SERIAL`.
It may reconnect only localhost ports explicitly recorded in BlueStacks config.

The resulting Desktop `vardian-db-TIMESTAMP.zip` contains static Data/*.bytes,
matching schema-source candidates, SHA-256 hashes, installed version and warnings.
It does not access login tokens, player saves, HTTP cache or private databases.
It never starts/updates the game, writes remote files, uses root or bypasses permissions.
If Android denies access it stops. A missing schema still yields a partial collection.

For files already on disk, without BlueStacks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\collect_vardian_db.ps1" -Offline -BalanceDir "E:\Vardian\Data" -SchemaRoot "C:\Users\SHK\VardianRE\reports\acheive\cpp2il_isil_v1211\IsilDump\InHouse.Balance.Runtime"
```

## Inspect returned data locally

```sh
python scripts/rpg/audit_vardian_db.py --balance /path/to/Data --schemas /path/to/Schemas --output /path/to/new-audit.json
python -m unittest discover -s scripts/rpg -p test_db_audit.py
```

The audit bounds all binary reads and labels unknown field meanings explicitly.
It inventories exact ISIL scalar-accessor evidence, flags contradictory schemas,
and refuses to claim a source-build match or a restored XP/cost table. The next
step after collecting is to match each root/child/vector schema and defaults,
decode version-consistent values, then restore level/price/stat relationships.

The Python inspector was run against the seven actual binaries and tested with
valid/corrupt synthetic buffers. The PowerShell collector cannot be executed
against the user's Windows/BlueStacks from this environment; run it locally.

## Returned full collection: installed version 1.21.1

The returned collection contains 61 binaries and 279 schema files. All recorded
file sizes and SHA-256 hashes match. Matching installed version labels and intact
hashes are evidence of provenance, not proof of identical source builds.

`decode_vardian_db.py` uses explicit ISIL accessor readers, field offsets and
child types. It recovered present fields from 57 ordinary tables. ActionData
currently fails on a non-finite KeyFrameData value and is not silently repaired.
ChatForbiddenWords and StringData_23 have no proven root mapping. StageData.pack
is handled separately: 7,716 size-prefixed records pass structural reads and
explicit StageId equality checks; the index entry with ID zero remains unresolved
because its StageId field is absent. All failures remain in the output manifest.

Confirmed configurations include Team MaxLevel 7800 and 118 level-cost segments,
32 weapons, eight weapon grades, 26 armor definitions, 94 material definitions,
48 gear grade records and nine hunting event definitions. Material icon keys
identify IDs 1/2/3 as gold/crystal/exp. Stat enums remain numeric. QuadFuncData
coefficients are recovered, but their evaluation formula is not yet established.
Absent values are omitted and listed as unresolved defaults; missing never means
zero, false or unlimited. No prototype rewards or live service are changed.

```sh
python scripts/rpg/decode_vardian_db.py --balance /path/to/Data --schemas /path/to/Schemas --output /path/to/new-recovery
python -m unittest discover -s scripts/rpg -p 'test_db_*.py'
```

The output is a private reference artifact. Never commit original tables,
decoded data or decompiled implementations into this public repository.

## Follow-up recovery (supersedes the failure counts above)

58 ordinary files now decode, including all 421 ActionDatas. The original
failure is an IEEE positive-infinity bit pattern in curve InTangent/OutTangent,
not an established corruption. Six such fields are preserved as tagged JSON
objects with exact raw little-endian bytes. This is not numeric zero; consumers
must explicitly interpret the tag. NaN and non-finite values in other fields
remain errors. Playback semantics have not been verified in Unity.

1,132 integer accessor definitions have a provable zero-offset default return
path in ISIL. Defaults are filled only for those accessors and marked in
`_resolvedAbsentDefaults`. Unsupported instructions, floating-point MOVI paths,
unknown calls and complex control flow remain unresolved. This also proves the
previously omitted stage ID zero; all 7,717 indexed stage records now match.

No QuadFuncData evaluator or matching native library/metadata pair was found in
the inspected material. The constants are configurations, not a proven formula.
Run the new offline `collect_vardian_formula.ps1` on the existing full IsilDump
directory, rather than only InHouse.Balance.Runtime, to collect evaluator
references across assemblies. It collects matching text files with hashes,
bounded scan/copy limits and visible warnings. It accesses no device/account.
The PowerShell script was inspected but cannot be executed against the user's
Windows machine from this environment. Python decoder tests: 12 passing.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\collect_vardian_formula.ps1"
```

If these references still do not contain the implementation, the remaining
requirement is the original matching-version `libil2cpp.so` and
`global-metadata.dat`, preserved separately from newer builds. Source `.fbs`
definitions, if available, also resolve serialized defaults directly.
