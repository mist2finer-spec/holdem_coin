# Portrait battle composition

RPG uses one portrait composition, including selection. Wide screens show a
handset instead of expanding the combat arena.

Reference: user-provided Vardian gameplay (1080x2340) and compact battle window
above the growth panel. The viewport is a little taller than that panel example.

- Handset ratio approximately 9:19.5, maximum 450px wide / 940px high.
- Mobile uses the available dynamic viewport and footer safe-area padding.
- Fixed header/footer. Remaining space splits 41:59 between battle and lower UI.
- Panels occupy lower UI without resizing or covering the battle canvas.
- Styles are scoped under .hunt-device; poker is unaffected.
- Camera shows at least 1125 world units instead of 900. At equal canvas width,
  actors and their spacing are 80% of the previous size. Simulation coordinates,
  hitboxes, movement and combat rules do not change.
- Authoring v8.x rigs are separate from this UI release.

Validation: TypeScript, production build, 108 RPG tests.
Chromium on 390x844, 360x640, 1440x1000: canvas ready, no page overflow, footer
visible, growth panel below battle, identical battle bounds with panel open.
