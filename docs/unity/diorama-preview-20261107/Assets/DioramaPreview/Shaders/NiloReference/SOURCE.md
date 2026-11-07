# Pinned public tutorial reference

Source: https://github.com/ColinLeung-NiloCat/UnityURPToonLitShaderExample/tree/fbe276e0df1d1f9379e13581c20b6a080a1a6977

MIT copyright (c) 2020 ColinLeung-NiloCat; original LICENSE is preserved. This public educational example is distinct from the separate full NiloToonURP product. README product demo images are not evidence of implemented public-example features.

Android compatibility: explicitly include URP 17 LODCrossFade.hlsl for the LOD_FADE_CROSSFADE GLES/Vulkan variants. Editor shader success alone did not cover this build-time path.

Changes, 2026-11-07: renamed shader; default outline disabled; directional SH; wide soft diffuse transition; actual metallic/smoothness specular response and environment reflection; optional RGB surface mask; adjustable directional rim, default off. The CBUFFER is shared by all passes. Original vertex/depth/shadow paths and helper licenses retained. Original model/texture/bone assets are unchanged. This comparison shader has no normal-map support; URP Lit remains the default candidate for full material fidelity.
