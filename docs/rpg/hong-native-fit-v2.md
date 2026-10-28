# Hong native Axe fit v2

Hong uses the corrected native Cat-compatible rig while equipped with an axe.
Other weapon loadouts retain the existing Hong rig. The source v1 JSON and
cutouts are preserved under archive/rpg/hong-native-v1 for reproducible fitting.

- Register B_Rarm after horizontal flip and map the arm rows to the original
  UV envelope, including the native .47/.52 elbow and Larm rest curvature.
- Straighten all six leg shafts and align the boot toe toward +X; preserve
  native image dimensions, UVs and attachment keys.
- Raise the lower body/B_body bind vertices progressively by up to 7px in
  bone2's +X direction. Rebind their weighted coordinates in the new setup
  pose, limiting combined Rleg/Lleg influence below .25 and assigning the
  released influence to center/bone2. Weights remain normalized.
- center.y = 34; upper/lower leg lengths = 15; child X offsets = 15, with
  Rleg3 at 15.5. Leg-local mesh X coordinates scale by 1.22. IK targets stay
  on their original floor path; the higher hips compensate for added reach.
- Larm and LShoulder Y = 8, Rarm Y = -3.5. Both hair slots remain rigid.

No original animation bone/slot channels, IK constraints or transform
constraints were rewritten. The renderer maps the native visual contact to
server hit timing, and uses native feet for grounding. skill6 uses skill5's
visual only. No animation event applies damage. The axe remains on the native
weapon constraints; damage, collision radius and reach remain authoritative.

Build: npm run rpg:build:hong:native (Pillow required only for authoring).
Check: npm run test:rpg && npm run check:rpg.
Preview: node scripts/rpg/preview-hong-native-fixed.mjs /absolute/preview/path.
Runtime: public/rpg/characters/hong/native-axe/hong.{json,atlas,png}.

Validation includes all 32 native clips at 31 times and both facing directions,
normalized skirt weights, unchanged animation/constraint data, finite poses,
grounding, and weapon/rig switching in the browser. Formal verification is
omitted: this change fits rendering geometry and is covered by these ordinary
checks; it does not introduce a new state protocol.

Release validation: 116 tests passed, TypeScript and production build passed. Mobile browser confirmed native axe attack1, native floor error below .001px, and sword/axe rig switching.
