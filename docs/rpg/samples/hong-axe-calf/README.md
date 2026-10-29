# Axe-only calf sample — not deployed

Source: deployed d863179 native Axe SOURCE 4x / LINEAR. Runtime files are read-only.
Shin bone influences (Rleg2, Lleg2) local y are multiplied by 1.04/1.24,
about 16.13% thinner. Thigh gain stays 1.08. Weights, all other vertex components,
bones, timing, skinning, ankle/foot geometry, atlas and image remain unchanged.
The same 4x image/atlas is copied here for a portable sample triple.

`node scripts/rpg/preview-hong-calf-sample.mjs` regenerates the sample and
`docs/rpg/hong-native-hd-comparison-axe-calf-sample.gif`.
GIF: left current / right sample, 192 frames at 30fps, idle, run, attack1–5,
skill1 and skill3. Validation: 32 clips in both directions, finite posed meshes,
exact component-scope checks and unchanged runtime hashes for all four weapons.
Preview uses the game physics/update/ground sequence. Formal verification is
omitted for this isolated visual sample. No runtime changes or deployment.
