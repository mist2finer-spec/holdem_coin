# Five separate attack image sets

Nine characters × five styles × four poses = 45 runtime PNG strips / 180 posed sprites.
Paths: `public/rpg/characters/<character>/attacks/{unarmed,sword,axe,dual,spear}.png`.
Every strip is 2048×384, four 512×384 cells, foot anchor (256,352). Base `sheet.png`, idle/run/dodge sprites, illustrations and archived Spine assets are preserved.

Styles: empty-hand punch, sword slash, overhead two-handed axe chop, two-blade crossed cuts, two-handed spear thrust. These are generated full-body body/arm poses with baked-in weapons, not punching poses with a procedural weapon overlay. The held-weapon overlay is now restricted to idle/movement; it is never drawn over the new attack sprites.

`manifest.json` supplies the contact frame (1 or 2), hashes, cell dimensions and anchor. The renderer changes to contact at the server's authoritative impact time, then follow-through/recovery, preserving hit logic. Unarmed becomes an equip option with an independent training level; four-weapon saves migrate without losing currency or upgrades.

## Generation prompts

Built-in image_gen, identity-preserve mode, one character atlas per reference idle sprite. Prompt set: preserve exact face/hair/outfit/proportions/pixel art; transparent 4-column ×5-row atlas; chronological anticipation/contact/follow-through/recovery; rows unarmed, sword, axe, dual, spear; distinct full-body stances and grips; no text/grid/background/clipping. Layout cleanup where needed: preserve the same 20 poses and identity, reduce each sprite to 55% of its cell, at least 40px transparent gutters and no connected neighbors.

Raw generated sources are kept as `attacks/source-v1.png`. `scripts/rpg/build_attack_assets.mjs` extracts disconnected sprites, preserves their RGBA pixels, normalizes scale and feet and writes manifests. It does not synthesize poses. The generator's first/last poses can differ slightly in anatomy/cloth; these are prototype art, not recovered original Vardian animations. Each four-pose style is reused for its combo strikes; unique artwork for every individual combo hit is a separate expansion.

Unity: slice by 512×384 and use the common pivot (0.5, 0.083333). Assign five animation clips/override sets, and use the manifest contact index to align Animation Events with authoritative hit logic. This patch supplies sprites and web playback, not a new Unity animator controller.


## Inventory panel update

The weapon tab is a bottom equipment panel retaining the combat viewport, inspired by the supplied Vardian inventory screenshots. Four real starter weapon icons occupy a four-column grid; unarmed training is a separate selection. Selecting a card does not equip or spend. Explicit equip and upgrade actions apply to the selected type; upgrades may target unequipped weapons without changing the equipped attack style. Costs for each type come from the server's existing recovered first weapon-cost curve, paid with soul gems. Retries use the same authoritative sequence and persistence checks. This update does not implement native rarity tiers, duplicate quantities, summons or synthesis.

Inventory icons: built-in image_gen, transparent 2×2 atlas based on reference item style, steel sword/axe/spear/dual blades with leather and antique-gold details; no labels or UI baked into images. Icons are sliced to four 384×384 PNGs under `public/rpg/weapons`.
