# Boss body and animated contact delta — 2026-11-07

Apply `Runtime`, `Resources` and `Editor` over the existing project after the 2026-11-07 stability delta. Install URP **17.0.4** using `Packages` as reference, copy `ApprovedDioramaAssets/DioramaPreview` to `Assets/DioramaPreview`, then run `Island > Diorama > Apply approved Nilo battle look`. Preserve existing `.meta` GUIDs. This is a delta, not a complete Unity project. The real applied project is `G:/new_project/IslandGame`, Unity 6000.0.62f1. The user approved the modified Nilo look before this integration. Do not overwrite current runtime with the isolated preview's older helper files.

`BossContactProfile.json` is the same profile imported by `src/lib/rpg-boss-contact.ts`. It comes from the original `Boss_MeleeHook_RL_Combo_Bound` clip at the original 6.5 m presentation height. `ExportContact.cs` uses one bounded **offline** BakeMesh to fit hand volumes, then samples bones. Runtime contact and rendering never call BakeMesh.

F8 or a three-finger touch toggles the collision display. Yellow is the body cylinder, cyan is the player's capsule, red is an active arm/hand, green is inactive. The overlay shows the attack ID, normalized attack phase, presentation clock and confirmed contact timestamp. White marks a recent authoritative contact.

Flash, original generated impact sound and camera offset consume authoritative hook events once. They share the event's attack ID and contact time. Flash uses a per-renderer property block and restores the saved block. Camera offset is composed by the existing BattleCameraController. Global timeScale stays unchanged.

Tools and evidence include actual Unity Play Mode checks, curve/bone parity, feedback isolation, a fixed-view rendering audit and before/after frame measurements. Local harness paths must be adjusted on another machine. Fake local accounts exist only in isolated in-memory storage. No user token or cookie is included.

The Android test gate was explicitly redefined by the user as Unity verification for this delivery. The user will test the APK on a physical phone. Editor GPU timings and diagnostic extra camera renders are not Android performance results.

Approved integration adds a persistent settings asset, copied shader/material/lighting derivatives, a reusable rendering adapter and creation/removal hooks for streamed scenery. Bloom defaults to 0.10; DOF/vignette/Rim/outline are individually disabled by default. Original source materials and terrain heights remain unchanged. Use the editor restore menu for the saved Graphics/Quality pipeline assignments. The G: backup also contains the pre-URP manifest/settings/runtime.
