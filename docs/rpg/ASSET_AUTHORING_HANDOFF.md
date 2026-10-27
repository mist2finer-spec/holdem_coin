# RPG asset authoring handoff — 2026-10-27

## Entry point and current status

This branch preserves experiments, prompts, reproducible scripts, references, and additional combat recovery. **It does not replace production sprites or constitute completed Unity/Spine characters.** Production players use 16-frame sprites; original monster Spine assets remain active. UI deployment is maintained separately on `main`.

| Directory | Purpose | Status / limitation |
|---|---|---|
| `tools/rpg-art/prompt-only` | Z-Image prompt-only generation | Changes Hong’s face; historical experiment |
| `tools/rpg-art/reference-lock` | Low-denoise image-to-image and original face composite | Preserves source pose; face compositing is not learned identity |
| `tools/rpg-art/spine-draft` | Polygon cutting, part editor, repair candidates, Spine 4.2 region export | Long illustration proportions rejected; archive only; missing occluded parts; no production meshes, IK, or combat animations |
| `tools/rpg-art/combat-base` | Existing Hong pixel combat frame → image-to-image | Latest direction; not yet validated as faithful Vardian style or clean transparent art |

Read each `README_KO.txt`. Prompts and graph JSON are kept alongside scripts. Run Python tests with `python -m unittest discover -s tools/rpg-art/<directory> -p 'test_*.py'`. Windows wrappers run against the local ComfyUI API, not a paid LLM API. Run `--help` on Python entry points for options before generation. Do not automatically promote generated candidates into live assets.

## User workstation

- ComfyUI portable: `G:\AI\ComfyUI_windows_portable`; API `http://127.0.0.1:8188`.
- NVIDIA GTX 1650, 4 GB VRAM; offloading is expected. One observed generation took approximately 116 seconds. Keep the ComfyUI terminal running; no restart per request.
- `models/diffusion_models/z_image_turbo_bf16.safetensors`
- `models/text_encoders/qwen_3_4b.safetensors`
- `models/vae/ae.safetensors` (335304388 bytes). Tiny VAE entries are not substitutes.
- Graph uses split UNET/CLIP/VAE loaders, Lumina2 encoder, 8 steps, CFG 1, res_multistep/simple, model shift 3. Combat-base denoise 0.4, nearest scaling 512 → 256.
- Embedded Python can omit the script directory from module search; portable scripts insert their own directory before importing helpers.
- Existing `scripts/rpg/comfyui_assets.py` is a separate SD/SDXL checkpoint workflow, **not** this Z-Image graph.

## Source references

- `public/island/hong.png`: original lobby illustration / identity.
- `public/rpg/characters/hong/frames/00-idle-0.png`: current combat pixel reference.
- `public/rpg/characters/hong/sheet.png`: current sprite sheet; character directory includes weapon attacks.
- `public/rpg/Hero_Axe01.json`, `.atlas`, `.png`: original Vardian skeleton, atlas and animations. Atlas contains many disconnected parts/skins: never feed the full atlas as an assembled character reference.
- `archive/rpg/spine-characters/hong`: older archived rig; not active player rendering.

## Next useful work

1. Render one **assembled** original Vardian character to establish proportions, pose and pixel style.
2. Keep Hong’s illustration as a separate identity reference. The current single-image graph cannot apply a second style reference merely by loading another image; choose compatible conditioning or map new art onto the original skeleton slots.
3. Approve one combat base before producing nine variants. Inspect silhouette, face, weapon grip and foot baseline.
4. Separate front/back limbs and hidden surfaces, clean alpha, then rig and validate animation timing. Current generated combat output is RGB on black, not a finished transparent sprite. Spine draft exports are region attachments only.
5. Preserve original motion timing and recovered attack/rush evidence; do not invent recovered constants.

## Combat recovery

`restore/rpg-additional-evidence` commit `ce6070a` has been copied into this archive branch (cherry-pick `6f16a4f`). See `ADDITIONAL_COMBAT_RECOVERY_20261026.md` and machine-readable verification reports: 10 enums / 109 constants corrected and 1,024 native action-parameter checks. This is evidence restoration, not a claim that every original combat mechanic is implemented. Consult existing RPG runtime/restoration handoffs for unresolved formulas and links.

## Safety and handoff

No API keys, Git tokens, personal runtime dumps, or full user upload archives belong here. Test outputs/caches are excluded. Original source assets remain authoritative. Future AI should read this file, then the selected tool README, and distinguish archived experiments from production changes.

## Resume entry (2026-10-27)

`tools/rpg-art/resume_hong.ps1` downloads the four hash-checked runtime files into the local GPU PC. `-Action Check` is read-only; `-Action Generate` creates one combat-base candidate and refuses to resubmit into an already busy ComfyUI queue. `-Action Report -Work ...` inspects the preserved old draft. New six tests and existing four combat-base tests pass; actual GPU inference and Unity/Spine Editor QA still run on the user workstation. This branch does not update production art. See `tools/rpg-art/resume/README_KO.txt`.

## Confirmed last completed GPU work — 2026-10-27 correction

User re-uploaded `20261026-220857-15bcf8(1).zip` as the last completed work. Its `result-1.png` is byte-identical to `tools/rpg-art/combat-base/review/hong-generated-review.png` (SHA256 `233a3520b0f91eb95b8f742ddb5d640dcb0e95e0acc0003b99ff9f05eea3a540`). Treat this existing output as the current review checkpoint; do not send the user back to generating the same combat base by default.

ComfyUI history: success/completed; start 2026-10-26 22:08:57 EDT, finish 22:10:53 EDT. Seed42, denoise0.40, steps8, CFG1, res_multistep/simple, 512px processing -> 256px output. The resume tool's denoise0.35 is an optional variation, not an exact continuation/reproduction of this run.

This is one RGB combat-pose image with a black background, not transparent separated parts or a finished Spine character. Next: assess this exact base and separate foreground/alpha; design new per-part contours and joints for these compact proportions; complete hidden back limbs and overlap; then build/edit the rig and weapon animations. The old long-body `hong_spine_work` polygons are not compatible. Do not claim hidden anatomy, alpha segmentation, a `.spine` editor project or production motions have already been created. Preserve the completed base and generation provenance unchanged.

## Three-stage compact-character pipeline (2026-10-27)

`tools/rpg-art/next_hong_spine.ps1` runs Prepare / Repair / Apply / Export / Report against a NEW `G:\AI\hong_combat_spine_work` directory. Source is the confirmed completed 256px result, hash-locked. No fresh full-character generation is needed.

`combat-spine` adds an editable near-black border matte, alpha brush editor, compact-pose polygons/pivots, masked per-part ComfyUI repair, and a 19-bone Spine4.2 region draft. Face pixels remain locked. Hidden far upper arm remains empty until completed. Residual source pixels stay in review but are excluded from the exported rig to avoid ghost-body artifacts. Pixel repair resizes use Nearest when pixelArt is enabled; legacy illustration mode is unchanged.

Tests: 7 new + 9 existing part-kit + 6 resume + 4 combat-base =26. The draft loads in the actual Spine4.2 runtime with 19bones/18slots and finite transforms for180 idle-preview frames. Windows PowerShell/GPU inference/Spine Editor/Unity visual validation are still local follow-up. Only setup/idle-preview exists; do not claim finished attack, dodge, walking, mesh, IK or native .spine editor assets. See `tools/rpg-art/combat-spine/README_KO.txt` for the exact user commands and editing loop.
