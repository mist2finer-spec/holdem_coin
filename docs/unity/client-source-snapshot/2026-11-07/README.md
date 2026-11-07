# Combat stabilization delta — 2026-11-07

Apply these Runtime files to the existing `G:/new_project/IslandGame/Assets/Island/Runtime` project after a per-file backup. Preserve GUIDs and authored assets. This is a delta over the 2026-11-06 runtime/asset snapshot, not an independent Unity project. Both new helper classes are plain C# classes; no scene wiring or new packages are required.

The actual project uses Unity 6000.0.62f1, Built-in rendering, Spine 4.2. Full implementation and validation boundaries are in `docs/unity/COMBAT_STABILITY_20261107_KO.md`.

The Tools folder contains the actual measurement and regression harnesses. Their local paths are explicit and must be changed when running from another machine. The server harness uses isolated in-memory storage and a fixed seed; its configured 150 ms delay is total RTT (75 ms each way). No account cookie or token is included in evidence.
