# 2026-11-06 Unity boss-camera snapshot

Actual project: `G:/new_project/IslandGame`, Unity 6000.0.62f1, Built-in renderer.
This is a source and user-provided boss asset snapshot, not a complete standalone Unity project.
Preserve the existing local Pink Glass/TexturedToon, glTFast, Spine, NatureStream and licensed Polytope package assets and their GUIDs. Do not overwrite local work with the older `unity/IslandGame` project.

Runtime/ contains the full current runtime, including prior controls, skin, streaming and frame-budget work required by this change. Resources/ contains configurations; Art/UnityBoss contains the user-provided boss sources and derived presentation/retarget assets. Original third-party bridge geometry and packages remain in the local Unity project and are not redistributed here.

See ../../BOSS_CAMERA_20261106_KO.md for setup and validation. SHA-256 files are in source-manifest.json. Tools are review/rebuild helpers with explicit local paths; do not run review preference changes against a live player session.

## Published files and local assets

This text publication includes current runtime C# and scene setup/configuration. Binary GLBs, the large baked animation, the large grounding JSON and the full local manifest are retained in the local commit `189ebfa` pending normal Git authentication. No file-by-file Base64/Blob binary fallback was used. The full authoritative source manifest remains on this PC. Missing assets must be retained from the actual local project.
