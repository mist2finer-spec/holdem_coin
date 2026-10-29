# Hong standing salon table — single eight-seat prototype

Scope: new teal/gold capsule table and four standing Hong views are used by
single-player eight-seat only. All poker game rooms use a portrait handset
container on desktop, matching RPG's 9:19.5 frame and 450x940 maximum. Mobile
uses available dynamic viewport height. Lobby and RPG presentation are unchanged.

Eight seats: one at bottom (back view), one at top (front), three at left
(right-facing), three at right (left-facing). A six-seat presentation map has
two on each side and one at either end; it is reserved for a later salon rollout.
No multiplayer/tournament table reskin is included in this prototype.

Every seat uses Hong art temporarily. Existing CPU names, persona decisions,
seat IDs and turn order remain intact. Cards preserve the original visibility
rule: only the player's own cards or a legitimate showdown/reveal are exposed;
folded opponents' cards are hidden. Fold is marked above the sprite, while
active-turn glow and D/SB/BB remain visible. Named bet boxes occupy separate
inward lanes; own cards sit above the rear-facing character. No chairs.

The table is an SVG surface, with teal gradients, gold rail and subtle stitched
patterns. It does not alter poker rules, pot/raise sizing, rake or accounting.
The action area remains a fixed row during turn changes and folds. Desktop side
logs are hidden inside the handset rather than covering the table. The existing
POT/ALL-IN popover and legal sizing controls are retained.

Assets: public/poker/hong-table/{front,right,left,back}.png, each 256x360 RGBA.
Generated sheet: archive/poker/hong-table-source.png; extract with
`python3 scripts/prepare-hong-table.py`. Manifest records cell bounds. Source
reference layout and generation prompt are archived alongside the sheet.

Validation: production build/type check and browser play at 390x844, 360x640,
1440x1000. Eight visible sprites, no page overflow, fixed arena before/after
fold, fold overlay, POT/ALL-IN popover, lobby exit and full sprite loading are
checked. Desktop retains the same portrait composition. Formal verification
is omitted for this presentation-only change; game state logic is untouched.

Checks completed: source-app TypeScript passed with scripts/examples/standalone
mini-service excluded; the broad repository TypeScript invocation still reports
existing script/example/server import configuration errors and is not claimed
as a full-repository pass. Next's production build skips types, so the separate
source-app check was run explicitly. Browser captures: ../poker-salon-mobile.png
and ../poker-salon-desktop.png. Korean font was installed only in the QA runtime
for legible screenshots; no system font binaries are included in this patch.
