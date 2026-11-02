# Unity current-client update — 2026-11-02

The Unity source from `feat/unity-full-client` (ee6982c35e77bc49103c52cfb4f0ace7d60ac427) was selectively restored onto the current web source. The old branch's server changes were not imported. The Node service remains authoritative; this is a native functional client, not an offline C# rewrite or finished visual parity.

Current RPG integration: six equipment slots; empty starter active sockets while keeping six owned copies; exact pristine legacy starter migration once with a persisted receipt; no symbols/input for empty active slots; fixed slot indices; 35 active/30 support catalog; 0–6 sockets with colors/adjacent links/crafting; copy reservations across inventory; summons; training/traits; 780-node shared tree with the exported spaced presentation coordinates, zoom bounds and start focus; large integer damage labels; HP bars; weapon-specific native rig replacement.

Wire handling preserves omitted compiled/tree/equipment fields only for the same session and build revision. Existing request sequence/idempotency and epoch cancellation remain in place. Failed user commands can show the authoritative rejection without destroying a still-valid session. No new permanent database or service is introduced.

The original two Spine Git package URLs and fixed commit are valid. The screenshot alone cannot identify the user's initial Package Manager resolution cause. `repair_project.ps1` removes the Git requirement by downloading the official pinned archive, verifies both package contents against known Git tree hashes, and installs the two packages locally together. It detects a conflicting Assets/Spine installation and preserves unrelated project content. Full client installation backs up overwritten files but is not a transactional rollback of the whole project.

Validated here: 340 web RPG regression tests (idle65, build54, hybrid30, rogue56, base135); RPG TypeScript; current real-server polling handshake/ack/6-seat/private-card/disabled8-seat-cash probe; 229 prepared asset hashes and Spine4.2 references; 35/30/780 catalog; all13 C# source files parsed without syntax errors. Fresh/equip/remove snapshots for C# fixtures come from the real current RogueService using an in-memory profile.

Not executed here: PowerShell runtime, independent C# contract harness (.NET unavailable), Unity Editor semantic compilation/package import/shaders/PlayMode, Windows/Android build, visual/touch-device QA. Official Spine documentation lists4.2 support throughUnity6000.3, not the user's6000.6.6f1; compatibility beyond that range must not be claimed. https://esotericsoftware.com/spine-unity-installation

Remaining scope: full VFX/telegraphs, jewel-shop/transcendence/equip-jewel UI, finished art/layout, source-missing17 monster graphics. The old dedicated solo8 switch is absent from the current backend, so its Unity entry point is disabled. Current online poker rules and persistence are unchanged.

Formal verification was not added: server transactions, request sequencing and authority were retained. Finite socket/skill/save cases are covered by existing service regressions, and explicit C# wire fixtures cover cache/session boundaries. Unexecuted semantic/runtime checks are documented as limitations rather than successes.
