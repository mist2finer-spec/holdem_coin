# Portrait battle composition

RPG uses one portrait composition. Desktop retains a 9:19.5 handset, maximum
450px wide / 940px high; mobile uses the available dynamic viewport. Styles
are scoped under `.hunt-device` and do not affect poker.

## Vardian comparison adjustment (2026-10-28)

Reference: supplied Vardian screenshots `KakaoTalk_20261027_224123387.jpg`
and `_01.jpg` (945x2048). In these images the combat ground is near 36% of
screen height, with skills around the halfway mark. These are visual reference
measurements, not recovered exact Unity RectTransform values.

- Fixed header/footer; remaining space splits 44:56 between battle and lower UI
  (previously 47:53). The battle is full width, with a quiet bottom divider rather
  than an inset rounded frame.
- Ground moves from 76% to 84% of the battle canvas height, reducing unused
  space below the actors. At 390x844, the expected ground is about 38% of the
  complete screen height, and the skill row remains in the upper half.
- Hero-centered camera span grows from 520.83 to 625 world units: 20% more
  horizontal context. Actor render gain 1.2 compensates the camera reduction
  from 2.16 to 1.8, retaining the previous on-screen hero/monster size on phones.
- Background framing uses gain 1.25 independently of the actor camera, replacing
  the previous 2.16 enlargement. More of the source forest is visible.
- Simulation coordinates, hitboxes, targeting, movement, damage, stage waves,
  skeletons and textures are unchanged. Panels remain below the battle, without
  resizing the canvas when opened. Short phones use the same composition.

## Recovered evidence and limits

`vardian-screen-evidence.json` records CanvasScaler 1080x2340, Scale With Screen
Size, width matching. UIAdaptiveCanvasScaler references safe/no-padding rectangles
and minimum safe-padding aspect ~1.333333. CombatCameraConfig has FOV 33/38,
distance 16, height 3.63. Exact adaptive scaling code and panel splits are not
restored. Clear/shadow cameras found in scene bundles are not the combat camera.
This web composition is a screenshot-based adaptation, not an exact camera port.

Verification uses RPG regressions, TypeScript, production build and browser
layout checks. Formal verification is omitted: this change only adjusts visual
composition and does not alter core state or concurrency.

Browser verification: 390x844, 360x640 and 1440x1000 passed. At 390x844 the
canvas is 390x326.6, floor y=318.7 and skills begin at y=406.6. Footer fits,
no page overflow, hero remains centered and opening the armory keeps battle bounds.
RPG regression suite: 129 passed; TypeScript and production build passed.
