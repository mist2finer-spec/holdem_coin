# Axe-only arm registration correction

Original Cat Axe07 was compared at idle, windup, contact and back-facing attack poses. Native bone/IK animation direction already matches the original; re-rotating bones would diverge from Cat. The discrepancy is in bent-arm artwork: full-resolution source elbow/fist landmarks were sampled by a simple row registration that placed the elbow crease too low and the fist too far outside the native UV hand region.

Correct hong_Rarm and hong_B_Rarm only. Map source elbow and fist Y landmarks to the Cat UV landmarks, with local fist-content X registration and existing outer outline preserved. Keep source B_Rarm horizontal mirror (original Cat's shoulder-to-wrist direction). No changes to JSON, atlas placement, mesh UVs/weights, bone angles, body proportions, limb thickness, weapon or other parts. The complete alpha channel is identical before/after.

Rebuild invokes fix-hong-axe-arm-orientation.py after HD extraction. Shared parts-hd remains the base authoring output; other three weapon builders explicitly restore those unchanged shared cells so this axe-specific fix cannot leak into their outputs. Before PNG and exact rig/atlas snapshots are preserved under archive/rpg/hong-axe-arm-orientation for regression comparison.

Validation: regression checks every PNG pixel, requiring identical alpha everywhere and RGB changes restricted to the two arm atlas rectangles. Existing 32-clip/facing/ground/UV tests retained. Ordinary deterministic asset tests suffice; formal verification omitted under AGENTS.md.
