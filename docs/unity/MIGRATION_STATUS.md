# Unity migration status — 2026-10-31

Branch: feat/unity-full-client. Source web baseline d3b1999. Operating web main is unchanged by this branch.

The project at unity/IslandGame is a native Unity client for the existing authoritative Node backend. It is not a completed offline C# reimplementation of the server, and its functional IMGUI UI is not a pixel-perfect UI migration.

Delivered: polling transport with ack/heartbeat, lobby,6-seat multiplayer,8-seat tournament view, dedicated local8-seat solo mode, action sizing/presets/reservations/rebuy, public history export, best-five showdown display, audio, RPG HTTP session client with sequence/cookie handling, Spine native actor rendering, original corridor image projection, movement/skills/AUTO, campaign/equipment/growth command UI, asset preparation, scene/build editor commands, local-server launcher.

Validation completed:13independent C# checks, C#9runtime/editor source syntax parsing,215exported asset hashes and Spine4.2 exports, real Engine.IO polling handshake/ack/solo capacity/private-card probe,244existing poker regression tests. Discovered and fixed the legacy C# wheel-straight 0-based rank mismatch in the new display evaluator.

Not completed: Unity Editor semantic compilation, package/shader import and PlayMode, Windows/Android builds and touch-device QA; final UI art parity; full VFX/telegraphs; complete reward/equipment presentation; source-missing17monster graphics. The original unresolved entries are included in AssetIndex.json rather than silently declared restored. The old C# archive is not used as the authoritative AI/rules engine.

There is no Unity Editor/license in the execution environment. Open the prepared project in a licensed Unity environment to run the import/build checks and report the first compiler or runtime errors. Do not mark this migration production-ready before that step.

The dedicated solo server switch is opt-in UNITY_SOLO=1. Default production room restrictions, cash/tournament rules and settlement are retained. No existing server deployment or database was migrated.
