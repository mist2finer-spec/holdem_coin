# Shared salon UI and two guest identities

Solo, multiplayer six/eight seats and eight-seat tournament now share SalonSeat,
SalonTableSurface, named inward wager lanes and the existing portrait handset.
This change affects presentation only. Rotated seat/action IDs, socket events,
CPU personas, tournament clocks/rounds, elimination filtering and BB formatting
remain intact. Local cards alone are shown at seats; legitimate showdown cards
continue in ShowdownResults. Spectating does not expose another player's cards.

Portrait 8 uses pink-glasses-table; portrait 6 uses teal-twins-table. Existing Hong
is the fallback for identities whose salon artwork has not yet been supplied.
Own player keeps the existing Hong salon identity. This is not a new character
selection system and does not bind an AI playing style to an image.

Original JPGs, oblique poses and exact side-generation prompt are archived in
archive/poker. Runtime directional images live under public/poker/{pink-glasses,
teal-twins}-table/. Original front/back were preserved via crop/background
extraction. Only true left/right side views were newly generated. JPG checkerboard
was baked into the originals, so deterministic edge-connected matte extraction is
used; originals remain byte-for-byte available for later manual touch-up.

Validation: Next production build, source-app TypeScript, four server-rendered
seat/privacy/layout/BB-label regression tests and asset alpha/bounds checks.
Formal verification omitted: no state machine, monetary logic or concurrency
changed. Browser checks are recorded separately after deployment.
