# Hong: original Cat rigs for four weapons

## Source and recovery

Original model bundle `model_assets_all_4b7c1041d63a541f1599d6ee7559998f.bundle`, from user's asset bundle. Three complete original exports preserved in archive/rpg/vardian-native-weapons: Hero_Sword01, Hero_Spear01, Hero_Dagger01 (Spine 4.2.43). Existing Hero_Axe01 remains unchanged.

First extract original Cat costume `cos/cos15` + weapon `weapon/grade7` into cat-sword/cat-spear/cat-dual. Linked face meshes resolved; native bones, constraints, slot swaps, events, meshes and deforms retained. Tests compare recovered Cat bone matrices and posed mesh vertices with full originals over all 32 clips.

Then replace cosmetic texture references with existing HD Hong parts, remove cat tail/expression overlays, add rigid front/side/back hair attachments and remap draw-order offsets. Shared fitHongNativeGeometry applies the same accepted center/leg/shoulder and skirt weight corrections as existing Hong Axe v2; no animation bone/IK/transform channels are transplanted from Axe. Dagger's B_wp2 handedness differs from Axe and is explicitly retained. Spear/Dagger have distinct costume mesh weights; their own source geometry is corrected independently.

Sword07, spear07 and dagger07 original textures replace axe07 at the same 4x atlas cell; all share the Hong 2048x1024 high-resolution body and Linear filtering. No new generated artwork. Weapon and front face source-resolution limits remain as documented in hong-native-hd.md.

## Runtime

Hong's equipped sword/axe/dual/spear selects its own native actor and atlas. Idle, run, dash, dodge, five attacks, skill start/loop/end and damage/death map to original clips. Existing unarmed articulated rig remains available. Other eight heroes are unaffected. Dispose all four native atlases on exit.

Server is authoritative: existing combo counts sword4 / axe3 / dual5 / spear4, hit times, damage, range, cooldown, gear cost/progression and skill queue are retained. Visual clips map to server contact clock; native animation events do not apply additional damage. Export assets contain all five original attacks even where equipped gameplay uses fewer.

## Reproduce and validation

`npm run rpg:build:hong:native-weapons` regenerates Axe HD then three recovered variants from preserved exports. Optional fresh extraction: install UnityPy and Pillow, then `python3 scripts/rpg/extract-native-weapons.py /path/to/asset-bundle.zip`.

`npm run test:rpg`, `npm run check:rpg`, production build, mobile equip/attack checks. Test original Cat versus complete source and Hong preserved channels, native weapon grip meshes, finiteness, grounding, mirrored facing and draw-order uniqueness for every clip. Existing Axe JSON/PNG must remain byte-identical on refactor/rebuild.

This changes visual adapters and deterministic asset generation; regression tests cover the affected safety properties. Formal verification omitted under AGENTS.md.
