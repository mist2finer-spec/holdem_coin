# Portrait battle composition

RPG uses one portrait composition, including selection. Wide screens show a
handset instead of expanding the combat arena.

Reference: user-provided Vardian gameplay (1080x2340) and compact battle window
above the growth panel. The viewport is a little taller than that panel example.

- Handset ratio approximately 9:19.5, maximum 450px wide / 940px high.
- Mobile uses the available dynamic viewport and footer safe-area padding.
- Fixed header/footer. Remaining space splits 47:53 between battle and lower UI.
- Panels occupy lower UI without resizing or covering the battle canvas.
- Styles are scoped under .hunt-device; poker is unaffected.
- Portrait camera gain is now 2x: the minimum visible span changes from 1125 to
  562.5 world units. Heroes, monsters, projectiles and map objects share the
  projection; background and foreground decorations scale around the floor.
  Simulation coordinates, hitboxes, movement and combat rules do not change.
- Authoring v8.x rigs are separate from this UI release.

Validation: TypeScript, production build, 108 RPG tests.
Chromium on 390x844, 360x640, 1440x1000: canvas ready, no page overflow, footer
visible, growth panel below battle, identical battle bounds with panel open.

## Enlarged battle viewport

Battle/lower split changed from 41:59 to 47:53, including short phones.
At 390x844 this increases the framed battle from about 298px to 343px,
and moves the lower panel down about 45px. Header/footer remain fixed.
World-camera zoom and character scale are independent of canvas height.

Recovered original evidence (see vardian-screen-evidence.json): CanvasScaler
uses 1080x2340, scale mode 1 (Scale With Screen Size), match mode 0, and
matchWidthOrHeight 0 (width). UIAdaptiveCanvasScaler references both safe
and no-padding rectangles, minimum safe-padding aspect ratio about 1.333333.
CombatCameraConfig separately stores FOV 33/38 and distance16/height3.63.
These are serialized values, not a restored implementation of adaptive
scaling. The original exact battle-panel split is not proven by these files;
47:53 is the web adjustment requested after comparing the gameplay video.

## In-scene zoom

User comparison screenshot showed a roughly half-sized hero relative to the
original Vardian scene. HUNT_PORTRAIT_ZOOM=2 increases the rendered world scale
inside the fixed portrait battle panel. The camera stays hero-centered; battle
panel height and controls are not resized by this change. Backgrounds zoom
around the ground line so the floor remains aligned with actor feet.
