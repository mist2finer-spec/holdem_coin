# Hong snappy motion v10

Scope: Hong only, on the existing portrait world camera. Server damage/reach,
combo counts, game elapsed time and collision rules are unchanged.

## Attack timing
Every individual unarmed/sword/axe/dual/spear strike and the optional shield-bash
uses anticipation 0–30%, snap 30–38%, impact/settle 38–55%, recovery 55–100%.
Ease-Out and explosive cubic Bezier phase envelopes are sampled into native
Spine 4.2 absolute-time Bezier control points. Constant hold intervals use
stepped keys. The impact overshoots 6 degrees, holds for four nominal 60Hz
authoring frames (or the available impact phase on shorter clips), then settles.
Visual contact is at 38%; the existing windup/recovery time adapter maps this
exactly to authoritative server hitAt. Visual hit-stop never blocks a server tick.

## Whole body and feet
Anticipation moves pelvis back 4px. Contact moves it forward18/down6px; torso
leans back20 degrees in windup and forward22 plus6 overshoot at contact.
Spine's Y-up sign is opposite the screen-space forward-lean naming.
Near foot steps24px; rear foot stays at floor height and rolls/slides within
the 33px leg's reach. Runtime two-bone IK bends the front knee and extends the
back leg. Kicks retain an airborne kicking foot and rear support foot.
All bones keep their original anatomical lengths. Feet keep a world orientation
instead of inheriting an unwanted rotation from the IK knee.

## Locomotion and secondary motion
Idle pelvis breathes +/-2.5px, torso contributes +/-0.75px with planted feet.
Walk/run use 4px/6px bounce amplitudes about a lowered center, with torso
forward lean12/16 degrees. The skirt has a separate child bone, with restrained
0.08-second delayed rotation. This avoids rotating the whole pelvis for cloth.
Hair secondary animation is disabled on all clips, including movement and skills.
The hair retains a fixed local pose under the rigid head; no delayed hair whip,
vertex warp or damping is exported.

## Runtime versus preview
96 live clips include the 95 existing weapon families and optional shield-bash.
The shield-bash asset is prepared but does not add a new shield input/equipment
system. Gameplay still chains individual strikes. Five full-combo previews are
stored separately in archive/rpg/hong-authoring/snappy-v10-combos.json so the live
JSON stays below3MB. They contain per-strike visual markers and never apply damage.
The preview renderer now uses each clip's actual duration rather than uniform
frame counts for different weapons.

## Checks
112 RPG tests: native curves, 38% contact, held upper-body pose, fixed hair,
lunge direction, locomotion bounce, foot IK, two-hand spear grip, mirroring,
equipment swaps, engine damage and stage flow.
TypeScript and production build pass. Browser checks at390x844,360x640,320x568
and1440x1000: new rig, unchanged camera/panel split, no UI overlap, stable battle
bounds while growth panel is open.
Rebuild: npm run rpg:build:hong. Preview: npm run rpg:preview:hong.
