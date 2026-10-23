# Vardian combat chain tracer

`trace_combat_chain.ps1` and `trace_combat_chain.py` run together on Windows with Python 3.9+. No pip packages required. Read-only Android extraction; no game update, install or runtime injection.

## One command on the existing PC

Put both files in the same directory, open PowerShell there:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\trace_combat_chain.ps1
```

Defaults match the previously confirmed environment:

- reports: `C:\Users\SHK\VardianRE\reports`
- ADB: `C:\Program Files\BlueStacks_nxt\HD-Adb.exe`
- device: `emulator-5554`
- package: `com.redveilone.vardian`

The wrapper pulls five named balance files, records installed version, scans reports for child table ISIL accessors, builds a new Desktop directory and ZIP. It neither clears nor replaces existing output. If ADB is not wanted, use the existing uploaded balance archive:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\trace_combat_chain.ps1 -Balance 'C:\path\vardian-balance.zip'
```

Optional exact ActorData GUID filter: `-Guid '7d09d20bec5eaf94cbaa907e7bc294e6'`. Omit to process all actors; this example GUID is an actual ActorData record, not a verified Hero_Axe01 mapping.

## Output and limits

- `trace/combat-chain.json`: actor GUID, ordered SkillTypes, every matching action (duplicates preserved), action GUID/alias, HoldTime/approach distance, child table offsets and supported scalar/string accessor values.
- `trace/schema-evidence/`: source ISIL documents used, with SHA256 provenance in the report.
- `trace/NEEDED.txt`: missing schemas and unresolved joins. Upload this ZIP for further restoration.
- `Data/`: only the five explicitly named balance files when using ADB.

Currently uploaded balance archive decodes **148 actors**. The supplied local evidence lacks ActionMotionData/ActionImpactorData child schemas, so it cannot establish original attack timing yet. The PC scan may find these documents. The scan uses `Type: BalanceData.*` and ISIL `Table.__offset`/`ByteBuffer.Get*` accessor evidence; it does not use inconsistent Disassembly blocks or assume zero for omitted FlatBuffers fields. Conflicting schemas are rejected rather than selecting a build arbitrarily. Source/version consistency still requires review.

Nested/vector child fields are not automatically decoded by the scalar accessor reader. Enum values remain numeric. Raw table offsets refer to the reported ActionData SHA256. These values are for investigation, not engine-ready gameplay settings.

`timingCandidates` exposes explicitly named Time/Delay/Duration scalar fields. It does **not** assert that HoldTime, animation length, or impactor start time equals the damage instant. `verifiedDamageTime` remains null until action scheduling, time scales and collision/contact semantics are checked. Skill order is not proof that all mastery-dependent combo stages are unlocked.

## Exact animation mapping

An optional JSON object maps confirmed ActorData GUIDs to Spine JSON paths (relative to this map file or absolute). Do not manufacture GUIDs from file names.

```json
{
  "confirmed-32-hex-actor-guid": "assets/Hero_Axe01.json"
}
```

Pass `-AssetMap 'C:\path\actor-spine-map.json'`. Motion scalar strings matching exact Spine animation names produce `exactClipMatches` with clip duration and original event records. This is a name match, not proof of event damage semantics. Numeric animation enums need their enum mapping separately.

## Standalone / tests

```bash
python scripts/rpg/trace_combat_chain.py --balance /path/to/balance.zip --root /path/to/reports --output /path/to/new-report
python scripts/rpg/test_trace_combat_chain.py
```

Malformed buffers cause a nonzero exit. Missing schema evidence produces an explicit PARTIAL report, not fabricated timing. Existing game code and poker deployment remain untouched.
