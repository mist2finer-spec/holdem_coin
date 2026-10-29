# Standing salon: hand-anchored 2.5D presentation

Seat position is now a hand/rail anchor rather than the centre of the entire
portrait/name/chip column. Eight-seat side rows use 32/49/66%; six-seat rows use
37/62%. Those rows meet the straight part of the rail, not its rounded corners.
Table bounds are top14%, bottom84%, left14%, right86%. North/south seat origins
share those vertical bounds. Preserved front/back art has per-identity hand
height (Hong front68%/back62%, pink62%, twins66%); Hong profiles use65%,
new guest profiles52%. Anchors refer to the full PNG canvas including its padding. No sprite artwork changed.

North image alone is clipped below the hand line, with four percent overlap for
hands. Its labels are centred beneath the rail, not offset to the right. Side
origins sit 10px outside the rail (9px on short screens), with ground ellipses
and labels beneath feet. South is in front of the skirt and its cards are offset
above the head. Badges are independent siblings of the sprite viewport, anchored
toward the felt so they cannot be clipped with the north lower body.

The SVG has a distinct raised leather rail (~23 SVG-unit band), four-unit gold
inner lip, recessed felt via alpha-clipped inner shadow and an outer highlight.
A dark skirt is translated10 CSS pixels downward with a ground drop shadow.
Table width72% reserves enough space for side sprites/name columns at320px.
All game modes inherit this shared presentation. Buttons and game rules unchanged.

Checks: source-app TypeScript, Next production build, existing four salon
privacy/identity/BB/seat-map regression tests. No formal verification: this
change affects visual positioning only. Browser verification performed after
the production deployment; no claim of physics or gameplay logic changes.
