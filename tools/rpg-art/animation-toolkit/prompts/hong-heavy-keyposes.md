# Optional keyframe art request (not executed in this release)

Identity anchor: the existing Hong combat artwork, near-black irises, long straight black hair, black cropped top/skirt/stockings/boots. Keep the current pixel scale and SD proportions. Do not alter the face.

Create only approved part replacements for these heavy-axe anchor poses:

- 0.25s: both hands pull the axe behind the head; rear shoulder/torso turns partly away; hips back.
- 0.30s: deep forward slash, torso compressed over the leading knee; readable contact silhouette.
- 0.38s: same contact pose held, without altering the character identity.

Use a fixed canvas, stable joint pivot and transparent background. Separate torso, near/far upper arms, forearms, hands and optional hand grip art. Avoid complete background/duplicate bodies in a single slot image. Existing character head is locked. A full back view must be new approved art rather than a stretched front-facing chest.

If interpolating with ToonCrafter on a sufficiently capable GPU: retain the start/end anchors and inspect every generated frame; do not assume identity or alpha is preserved. Extract/review per-slot RGBA frames at the original attachment dimensions before using attach_frame_swap.py. The present deliverable uses procedural slash slot swaps and does not claim ToonCrafter-generated body frames.
