# Native Hong HD source preservation

- `geometry.json`: exact live native v2 JSON before texture-only upgrade. Build asserts runtime bytes remain identical.
- `layout-1x.atlas`, `atlas-1x.png`: original placement and visual comparison baseline, never used as high-resolution character artwork.
- `source-parts-1280.png`: original generated sheet from the native Hong authoring task. Actual encoded size is 1254×1254 despite its nominal 1280 source label. Re-extract body, arms, legs, side/back head and hair from here directly.
- `original-face.png`: original Hong face (53×54), preserved instead of substituting the generated spare face. Higher-resolution original illustration/sheet named hong_sheet_another_2.jpg was unavailable in this workspace/file search. Face has a source-resolution ceiling, as does original axe07 (82×172); nearest upscale for these two only.

No new AI illustration and no new motion/geometry generated. Regenerate through `npm run rpg:build:hong:native`; final source-to-4x step is `scripts/rpg/build-hong-native-hd.py`.
