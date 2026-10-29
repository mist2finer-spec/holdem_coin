# Hong native HD comparison — thigh refinement 2

Each GIF shows the immediately previous deployed rig (0114dd7, thigh gain 1.20)
on the left and the updated rig (gain 1.08) on the right. This is a further 10%
mesh-width reduction from that deploy, or 18.18% below the first 1.32 correction.
Other limb dimensions, HD textures, physics, animations and combat rules remain
unchanged. Atlas shaft volume still keeps the legs fuller than the old baseline.

| Weapon | Comparison GIF |
| --- | --- |
| Axe | [hong-native-hd-comparison-axe.gif](hong-native-hd-comparison-axe.gif) |
| Sword | [hong-native-hd-comparison-sword.gif](hong-native-hd-comparison-sword.gif) |
| Dual | [hong-native-hd-comparison-dual.gif](hong-native-hd-comparison-dual.gif) |
| Spear | [hong-native-hd-comparison-spear.gif](hong-native-hd-comparison-spear.gif) |

1120x440, 30fps, looping. Both sides use SOURCE 4x / LINEAR and the same
animation/physics clock. Sequence: idle, run, attack1–5, skill1, skill3, including
front/side/back attachment switches where the original clip uses them. Each
attack/skill runs for its native duration plus 0.10s; weapon-specific timing is
preserved. Feet are aligned using posed foot vertices, as in the game.

Generate with `node scripts/rpg/preview-hong-hd-comparison.mjs`; requires the
normal npm dependencies and ffmpeg. Previous JSONs are preserved in
`archive/rpg/hong-native-thigh-tuning-v2`; they reuse runtime atlas/textures
because this revision changes only thigh geometry and its manifest value.

Validation: 134 RPG tests, type check, production build, and all four weapon
browser equip/attack/ground checks. Formal verification omitted: cosmetic mesh
adjustment, covered by existing regression tests, no core state changes.
