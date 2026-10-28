# Hong dynamic weapon motion v11

Hong only; v8.3 independent rigid parts retained. No face mesh warp or hair flutter.

- Sword and alternating dual attacks: authored overhead wind-up and diagonal downstroke, minimum 160 degree tested weapon sweep. Inactive dual hand trails the hip.
- Spear: deeper rear draw and forward lunge. Native off-hand IK stays on the shaft; fixed arm lengths and grip constraints remain active. The shoulder and elbow are retargeted together when required.
- Contact pelvis translation: +22px (spear +25px), -10px vertical. Torso forward lean 29 degrees plus 6 degree overshoot; rigid head tilts forward 15 degrees.
- Every attack snaps in 40ms, freezes all joints for 100ms, then recovers. Native event remains at 38% of clip; the visual clock preserves the snap/hold duration when mapped to the authoritative hit time. Game simulation and damage are never paused.
- Walk/run lean: 15/20 degrees, bounce amplitudes 5/6px. Held weapons trail the hips, with spear reach constrained to both hands.
- Hair animation remains disabled. Small skirt inertia freezes with the rest of the contact pose.

The Knight pack provides one source sword attack and three buffs; combos remain authored adaptations, not recovered source combos. No balance, damage, collision radius, or other character changes.

Validation: 113 RPG tests, RPG TypeScript check, production build. Tests include full-joint freeze, minimum swing arc, rigid head, live shaft grip, leg IK, floor placement, and server contact synchronization. Runtime JSON remains below 3MB.

Preview: hong-dynamic-v11-attacks.gif (sword / dual / spear at actual clip speed).
Exporter: scripts/rpg/build-hong-jointed-weapons.mjs
Preview-only aggregates: archive/rpg/hong-authoring/dynamic-v11-combos.json
The previous v10 aggregate and GIF are retained for comparison.
