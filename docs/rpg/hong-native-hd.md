# Native Hong 4x texture update

2048×1024 atlas, every bounds value exactly 4×. Runtime JSON unchanged byte for byte (including skeleton, mesh vertices/UVs, constraints, animations and events). All runtime native clips keep prior world dimensions.

Body, arms, legs and hair are re-extracted from the full authoring source sheet, resampled/registered directly at 4x target resolution, with binary alpha threshold to suppress transparent-edge ringing. Original Cat arm silhouettes guide only alignment, not artwork. No warped 1x body parts are enlarged. Front face and native axe have no higher-resolution originals locally; preserve their source artwork using nearest sampling and record the limitation per part in manifest.json.

Both hong-nearest.atlas and hong-linear.atlas share identical bounds. In `hong.atlas` use Linear for 4x source detail downsampled to the small mobile viewport; CanvasTexture ignores atlas filter settings, so the hero Canvas2D path explicitly enables high-quality smoothing only for native Hong. Existing other heroes retain pixel sampling. Compare docs/rpg/hong-native-hd-comparison.png at enlarged and mobile scales.

Visual framing: portrait zoom 2→2.16, so visible world width 562.5→520.83 on a 390px handset. Monster render scale ×0.88 (approximately 5% smaller on screen after camera gain). Physics radii, ground anchors, reach/damage and fixed screen/control panels remain unchanged.

Verification: byte-identical JSON, all region bounds/normalized UVs, all 32 posed mesh clips versus original atlas, both facings/ground tests, source atlas output dimensions, camera centering and unchanged collision sizes. Ordinary deterministic geometry and regression tests are sufficient; no formal model is required under AGENTS.md.
