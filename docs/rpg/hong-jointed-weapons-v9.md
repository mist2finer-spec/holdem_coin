# Hong jointed runtime v9

Only Hong changes renderer. Eight other characters retain their 16-frame sheet
path. The mobile handset layout from 15c002d is retained.

## Assets and motion

- 16 independently cropped v8.3 body regions, original rigid Hong face.
- 25 bones, two active leg IK chains, spear-only off-hand IK and palm-axis transform.
- Five skins: unarmed, sword, axe, dual, spear. Dual uses an independent blade in
  each palm. Spear support hand slides on its shaft; the lead elbow is adjusted
  when necessary to keep both arms within anatomical reach.
- Gameplay combo counts stay unarmed 5 / sword 4 / axe 3 / dual 5 / spear 4.
  Five visual attack slots are exported per skin to cover existing skill/fallback
  use; this does not add damage or extend the server combo.
- Sword: slash, return cut, thrust, finishing cut. Dual: alternating hands and
  paired finisher. Spear: mid/high/low thrust plus sweep. Axe has heavy variants.
- 95 exported clips include six skills for each skin. Skill 1/4, 2/5, 3/6 reuse
  the respective Knight buff_1, buff_2, buff_3 joint-delta families.
- Knight actually contains one sword_attack, not a pre-existing four-hit combo.
  New combo trajectories are authored adaptations of its native numeric timing
  and joint motion. Knight's 3.8 JSON was evaluated with a 3.8 runtime; the Hong
  output is Spine 4.2. Original reference artwork is not shipped.
- Rotation/translation curves are reduced with 0.01 degree / 0.001px tolerances.
  Mobile JSON is below 3MB. Skins and attachment pointers do not hold sockets.
- Exact visual impact times are generated into hong-runtime-motion.json. The
  renderer maps windup and recovery separately onto server hitAt and duration.
  Animation events never apply gameplay damage.
- Hero scale 1.25 compensates for the compact rig at the current portrait camera.

## Rebuild

npm run rpg:build:hong
npm run rpg:preview:hong
npm run check:rpg
npm run test:rpg

Base source parts/rig and already evaluated Knight numeric references live under
archive/rpg/hong-authoring/jointed-parts-v8-3. The legacy exporter is explicitly
named rpg:build:hong:legacy and should not replace this runtime accidentally.
Spine 4.2 Unity editor import has not been tested in this web release.

## Verification

110 RPG tests pass. The spear test samples all 19 spear clips at 61 positions
(1,159 poses), checks palm-to-shaft gap below 0.12 rig pixels and unchanged limb
lengths. Measured maximum gap in the native runtime was about 0.06 rig pixels.
Weapon mirroring, fallback actions, six skill names, impact mapping, skin changes
and independent body attachment checks also pass.

Chromium: 390x844, 360x640, 1440x1000, no overflow, battle window stable with growth
panel open. Visual fixtures exercised all five weapon skins and buff skill2,
without asset fallback; another character remained on sprite-16-v1.
