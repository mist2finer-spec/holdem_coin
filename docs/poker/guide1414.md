# Guide 1414

- Remove opponent cards from seat portraits; own hand and dedicated showdown remain.
- North portrait has a taller fixed upper-body viewport, with both equal-width name/chip labels to its right.
- Fold-win panel uses only CSS translate for centering (previous translate plus transform moved it left twice), narrower width and translucent backgrounds. Dedicated showdown UI is unchanged.
- Face-up cards keep corner ranks with one central suit.
- Side wager lanes move from 31/69% to 25/75%; north wager moves from 17% to 14%.

Presentation changes only; no engine or visibility data contract changes. Formal verification is not applicable. Build validation recorded in task response. Browser binary unavailable in this execution environment, so visual browser validation is not claimed.

## Equal-scale follow-up
All four sprite views now share 56×78 rendering bounds (48×64 on short screens). North viewport retains that full scale but clips below the chest at the top rail; its anchor moves to 9%, aligned with the smaller table's upper edge. Table footprint is 78%×80%, cards and seat/wager labels are reduced. Action button geometry is unchanged. No AI/game rule edits.

## Header / badge follow-up
Both solo and socket headers now display only the street label at the right-hand edge. The central live pot remains. North sprite crop retains 75% of its height to include hands. All portrait wrappers permit badge overflow; cropping applies only to the sprite, so SB/BB/D circles are not clipped. Build and app TypeScript checked; browser visual verification remains unavailable.
