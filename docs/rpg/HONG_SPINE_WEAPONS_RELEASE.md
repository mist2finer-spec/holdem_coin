# Hong weapon-mounted combat rig

Scope: Hong only, client rendering. The other eight characters retain their existing sprite packs. No poker, growth/reward, damage, collision, range or cooldown rules change.

## Assets and provenance

`public/rpg/characters/hong/spine/` contains a Spine 4.2 JSON rig, 512px straight-alpha atlas, and provenance manifest. It uses the confirmed compact Hong combat candidate, not the earlier tall-body illustration rig. The source face/outfit is not regenerated. The uploaded 14.58s Vardian gameplay recording was visually reviewed in the prior motion pass. Native `Hero_Axe01` clip durations/body accents are combined with authored compact-limb endpoint paths. This is an adaptation, not frame-exact restoration.

The original 16-frame sheet and old weapon attack sheets stay available as a renderer load fallback. `manifest.json` on that old sheet describes the fallback, not Hong's active render path. The active renderer reports `data-hero-rig="hong-spine-weapons-v1"` on the canvas.

All four existing inventory icons are reused as transparent held-weapon regions. Their grip anchors and source hashes are recorded in the new manifest. Dual swords are two independently mounted copies of the sword blade, rather than one crossed-swords icon floating over the body.

## Movement/attachment rules

- Weapon slots attach to `weapon-front`/`weapon-back`, children of the corresponding hand bones. Blade position therefore follows the actual hand during movement, attack, dodge, mirrored facing and death.
- Weapon slots render before the hand, so fingers cover the grip. Back-hand weapons render behind the torso.
- Each armed loadout has 12 motion clips, including five attack variants. Sword and axe use authored slash arcs, spear uses forward thrusts, and dual blades use alternating independent wrist arcs. Existing server loadouts still determine how many combo stages are available.
- Each frame chooses the appropriate skin, clears unused off-hand attachments, and uses weapon-specific animation names. Unarmed clears both weapon slots.
- Repeated action serials restart the pose. AnimationState.update advances crossfade time even when trackTime is remapped to a server snapshot.
- Windup and recovery are remapped separately around the authoritative server `motion.hitAt`, not just around total clip duration. Spine events never apply game damage.
- Grounding uses body/foot slots, never the length of an equipped spear or blade.

## Rebuild

`npm run rpg:build:hong` requires Python/Pillow and the app's Node dependencies. Preserved cutouts/config live under `scripts/rpg/hong-motion/input-work/`. The script builds in a new temporary folder then emits the public assets. No ComfyUI, API key or new image generation is required.

For Unity, use `hong.json`, `hong.atlas.txt`, and `hong.png` with spine-unity 4.2. Choose the appropriate weapon skin and explicitly set the weapon slot attachment (`held-sword`, `held-axe`, `held-dual`, `held-spear`); the JSON setup pose remains unarmed. Unity Editor import has not been tested here. No `.spine` binary project or production mesh weights are claimed.

## Verification

- New tests cover all five loadouts/12 clip families, skin switching, attachment parents, mirrored facing, ground contact, finite transforms, animation crossfade progress, and authoritative impact timing.
- Actual createHuntRenderer was exercised with a native Canvas2D DOM shim: 45 weapon/action combinations and 540 frames, plus a non-Hong sprite fallback. This is a headless renderer test, not mobile browser or Unity Editor testing.
- `npm run check:rpg`, `npm run test:rpg`, and production build are required before release.
- Optional visual contact sheet: `node scripts/rpg/render-hong-weapons.mjs /tmp/hong-weapons-review.png`. This QA-only script additionally requires `@napi-rs/canvas`.

Remaining art work: hidden-body surfaces and joint seams are approximate, and hair/skirt remain region cutouts rather than weighted meshes. Web equipment/damage rules keep their current values.
