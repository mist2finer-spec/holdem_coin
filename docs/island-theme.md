# Gold / teal interface pass

Reference: user attachment `island_holdem_rpg_ui.html`.

Shared palette and CSS buttons replace the old raster poker button skin. Applied to lobby, poker actions and portalled pot menu, RPG selection, combat controls, armory and growth panels. Existing handset geometry, art, game rules, damage, AI and cooldown handlers are retained. The reference's demo dealing/inventory JavaScript and external font dependencies are not imported.

Validation: production build and src-only TypeScript check passed. Browser: poker at 360×640, 390×844 and desktop handset, pot menu, fold and lobby return; RPG battle load, armory and growth open/close, no page overflow or JavaScript errors. Screenshots in this directory. Formal verification omitted: presentation-only change, existing state logic unchanged.
