# Hero skill scheduling

Bug: AUTO called only `attack()` (basic), and a service skill request called `attack(slot)` once. Any active attack/rush/roll or recovery rejected it permanently, even when the displayed cooldown was zero.

Manual requests now reserve a single slot (latest tap wins); it executes at the first legal idle boundary with cooldown ready. Tapping during cooldown reserves it too; the server view displays the reservation. Death, stage/loadout reset and explicit input cancellation clear it. No active hit is interrupted. Cooldown starts only on actual cast. Disabled skills cannot be reserved/cast.

AUTO scans enabled ready slots 1→6 at every legal boundary before basic attacks. Offensive skills require a live target within their existing 330-unit area; healing requires missing HP and an active encounter. After all ready skills, basic attack/approach resumes. Manual movement takes priority. "Immediately" means after current action/recovery/stun, not concurrent casts or cancelled impacts. No new timing, damage or reward formulas.

Original evidence checked: complete handoff / Bulk Combat Audit `CombatHeroAI.OnAdvance` (0x3CFECF4), `MakeExecutableSkillAndItsTargetInRange` (0x3D013B8) contain executable-skill selection, IsInactive/IsCooltimeReady, execution precheck and ExecuteSkill calls. Exported CombatHeroAI fields include reserved skill/timer and auto execution timer; ReserveExecuteSkill/ClearReservedExecuteSkill exist. These support reservation/readiness design. Slot 1→6 priority is the user's requested web policy, not a claim to reproduce the original's exact ordering (which also has longest-cooltime sorting).

Verification: regression tests cover lost busy input, reuse at cooldown expiry, disabled slots, explicit cancellation, ordered AUTO and target range. Existing service sequence/retry/dedup and stage tests retained. Single-threaded engine scheduling has deterministic regression coverage; no new async protocol, formal verification omitted under AGENTS.md.
