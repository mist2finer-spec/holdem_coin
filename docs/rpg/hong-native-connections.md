# Hong native connections, revisions 1–2

Built on SOURCE 4x / LINEAR; applies to Axe, Sword, Dual and Spear. Original Cat
weapon-specific clips, events, hand/weapon meshes, bone lengths, IK and transform
constraints remain intact. This is a cosmetic rig/texture pass, not a combat-rule
change.

## Corrections

- Leg rim vertices at the proximal UV edge are pinned to their own hip, with
  local x clamped to -2..0.5; the transition fades through v=.16. Knees, ankles
  and foot geometry are unchanged. Texture caps round the six leg roots.
- Skirt hem vertices (v >= .75) have combined leg influence .45, normalized with
  center/bone2 support. Torso vertices above v=.5 are bone2-only. Rear-body
  vertices 0,1,17,18,19,22,23 explicitly have no leg weight. Rest positions are
  preserved while reweighting.
- Shoulder mesh rims overlap into the torso by up to 2.5 world pixels, fading
  out before v=.25; hand/weapon anchors and arm bones are unchanged. Dark seam
  pixels adjacent to shoulder skin are replaced by neighboring skin colors,
  retaining alpha and sleeve straps.
- Three new rigid joined head attachments integrate face/bangs. Front uses
  source cell 15, side uses the existing one-eye right profile in cell 2, rear
  uses the continuous hair curtain in cell 14. These come directly from the 1254x1254 source sheet at final
  atlas resolution. No new face is generated. The previous front was a nearest
  enlargement of a 53x54 source and remains only as an unused source region.
- Long hair uses seven transverse mesh rows and native cloak1/2/3 weights. Front/side
  hair is behind the body; the rear-view curtain is above the body and below the head; original Cat arm/head
  relative order is retained. Face meshes remain unweighted rigid quads.
- The native head animation mirrors local Y in several clips. Mixing that
  reflected head with non-reflected cloth would collapse the hair cross-section.
  The long-hair root therefore attaches to the neck/torso (bone2), with cloth
  influence increasing to .10 at the tip. Only the rigid joined head follows
  the head mirror. Upper hair alpha is removed from the cloth attachment to
  prevent double crowns/overlapping bangs.
- Existing native cloth rotations are reused. Physics on cloak1..3 has mix .12,
  inertia .12, damping .95, limit 3 and strength 70. Runtime now advances the
  skeleton physics clock before evaluation. No independent large hair flapping
  timeline is introduced.

## Build and provenance

`npm run rpg:build:hong:native-weapons` rebuilds all source rigs then runs
`connect-hong-native.mjs` and `connect-hong-native-textures.py`. The postprocess
rejects already-processed JSON; rebuild from source to avoid accumulating edits.
`npm run rpg:build:hong:native` does the same for Axe alone.

The previous Axe version is preserved under
`archive/rpg/hong-native-connections-v1/`. Its atlas still references hong.png.
This snapshot also keeps the previous texture-only arm registration test scoped
to that historical pass. New tests check current hip pins, chest isolation,
hem weights, head rigidity, cloth bone bindings, layer order and all 32 clips
with physics for all four weapons.

`preview-hong-connections.mjs` renders the original and revised Axe in six views.
This static contact sheet uses Physics.pose; runtime tests separately exercise
Physics.update. Exact Cat head/body proportions are not imposed on Hong.

Formal verification is omitted because these are visual asset changes covered
by mesh/animation regressions, type checking and browser verification.

Validation: 131 RPG tests passed; the six focused rig checks additionally passed
with mirrored physics sampling after the final cloth blend adjustment. TypeScript,
production build and Chromium four-weapon equip/attack/ground checks passed.
A cross-section orientation check caught an inverted hair strip in sliding2;
reducing maximum cloth influence from .55 to .35 removed the inversion without
removing the native cloth bindings. `hong-connections.gif` uses the same physics
clock and grounding order as the runtime; `preview-hong-cloth.mjs` produces its
30fps frame sequence for ffmpeg. Comparison PNG is `hong-connections.png`.


## Revision 2: continuous hair, restrained motion

All three long-hair attachments now reference `hair_back`, the filled, untied
curtain from the existing high-resolution source sheet. The old front texture
had a central face cutout; using it for the long section made two separated tails.
No generated replacement artwork is needed. In the back view, the rigid crown
also uses the upper crop of that same curtain instead of the short-bob source;
this removes the visible horizontal bob outline at the neck. Front/side face
textures and the rigid head geometry stay intact.

The long section starts at 40% of its texture height instead of 50%, extending
the overlap under the head. Root weights stay on bone2; cloth influence ramps
from .04 to .10, and the existing physics is damped further. Original animation
curves are preserved. Back-view draw order covers the back with hair, while
front/side hair stays behind the body and does not cover the face or front arm.

The accepted Axe calf sample (shin gain 1.04) is now shared by all four native
weapons. Thigh gain remains 1.08. All other limb proportions remain unchanged.

Validation: 135 RPG tests, including a matching rear-crown source check, opaque
central hair continuity, bounded cloth influence, mirrored 32-clip sampling and
finite mesh checks. TypeScript, production build and four-weapon browser checks
are performed for release. Review: `hong-hair-continuity.gif` (all four weapons).
