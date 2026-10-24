# Uniform dealing and complete showdown board

The shared live dealer now shuffles the full 52-card deck once with Fisher-Yates
and deals one card per seat in each of two clockwise rounds. No role, stack,
private information, texture rejection or winning-hand selection enters dealing.
This replaces paced-textures-v3, not just its UI label. Rejection strengths in
hand history become zero and the profile is `uniform-shuffle-v1`. Single play
and Socket.IO multiplayer both already call this same dealer.

20,000 seeded six-seat tables are checked against natural pair/suited/connector
frequencies, role symmetry, role-label invariance and conservation of all cards.
Natural pocket-pair frequency is 78/1326, without the previous suppression.
The self-play trainer's ordinary makeDeck shuffle is consistent with this live
distribution again. Poker AI strategy/EV policy is not otherwise changed.

Showdown evaluation retains its original best-five selection. The view now also
returns all five community cards in their original input order and a parallel
used-card mask. Both table UIs render two hole cards plus five community cards;
unused cards retain opacity-40, while used cards retain normal brightness.
Subtle spacing separates flop, turn and river without sorting by rank or suit.
The ranking, split-pot payout and best-five tie policy remain unchanged.

RPG combat growth, authoritative guest saving, inventory/potions and hunt requests
are included in the same release. See rpg/BATTLE_RESTORATION_WEB.md for original
restoration boundaries and free-host storage limits. No raw DB/native evidence
is published in this release.
