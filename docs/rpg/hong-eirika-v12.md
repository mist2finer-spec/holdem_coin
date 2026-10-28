# Hong / Eirika reference adaptation v12

The user supplied Eirika_01.zip (Spine 4.2.11). Its eight clips are attack01,
attack02, idle01, idle02, idle02_prepare, move, aux and hit. Evaluate these with
Spine 4.2.120 rather than guessing at raw keyframe values or using the Knight
3.8 parser. Only evaluated numeric motion and a SHA256 of the source JSON are
preserved in archive/rpg/hong-authoring/eirika/motion.json. Eirika textures,
mesh deformations, cape, slash art and source events are not shipped by Hong.

## Mapping

| Hong | Eirika |
| --- | --- |
| pelvis | bone |
| torso | body01 |
| head | head02 |
| near-upper-arm / near-forearm | arm01 / arm02 |
| far-upper-arm / far-forearm | arm04 / bone2 |
| weapon-front | wep_sw017 |

The source blade's image Y axis is 2.31 degrees from its weapon bone X axis;
Hong's blade uses Y. Convert this offset when retargeting. Preserve directed
blade rotation through the large cut; taking the shortest angle can erase
more than half of the swing. Fixed Hong arm/leg lengths, rigid head and hand
grip mounting remain active. Source jump translation is not copied to the
collision body or locomotion system.

## Applied clips

- Sword idle: a 2-second sword-up guard from idle01, with breathing and planted
  feet. Attack entry and exit use the same arm/weapon guard to avoid snapping.
- Sword four-hit combo: attack01 downstroke, an authored reverse cut from its
  poses, attack02-based finisher and another angled downstroke. The source has
  TWO attacks; these are four authored SD adaptations, not four recovered clips.
- Sword movement: move's forward lean, trailing sword and free-hand swing,
  retaining Hong's short-leg gait and native leg IK.
- Sword skill1/skill4: aux's free-hand cast, with its visual cast pose remapped
  to the current skill contact. Other sword skills retain Knight buffs.
- Source charging pauses and large jump are compressed; the v11 40ms strike,
  100ms whole-pose hold and authoritative damage synchronization are retained.
- Hair flutter remains disabled. Original Hong art, all non-sword animations,
  other characters and gameplay damage/collision rules remain unchanged.

## Rebuild

With the user's original JSON available, regenerate the numeric reference:

```sh
node scripts/rpg/extract-eirika-motion.mjs /absolute/path/Eirika_01.json archive/rpg/hong-authoring/eirika/motion.json
npm run rpg:build:hong
node scripts/rpg/render-hong-eirika-preview.mjs /absolute/path/preview-frames
npm run test:rpg
npm run check:rpg
```

The committed numeric reference makes routine Hong rebuilds independent of the
private original ZIP. Preview GIF: hong-eirika-v12-preview.gif (guard / combo /
movement and cast). v11 files remain for comparison.

Validation: 114 RPG tests, RPG TypeScript check, production build, and a 390x844 browser equipment/movement smoke check with no page errors. Coverage includes evaluated
source metadata, guard loop/attack-entry continuity, one authoritative hit
window per strike, all-joint freeze, minimum swing arc, rigid head, grounded
feet, spear shaft grip and an unchanged hash of all non-sword animations.
Formal verification is omitted: this is visual animation retargeting with no
new concurrent protocol or safety-state change; geometry/regression tests fit.
