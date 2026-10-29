# Pink glasses and teal twins poker profiles

Built-in image generation, transparent RGBA. Identity references are the two
unchanged uploaded JPGs archived as pink-glasses-table-original.jpg and
teal-twins-table-original.jpg. This is not a ComfyUI output.

Prompt:
Create production isolated game sprites using the two uploaded identity sheets. Exactly FOUR full body sprites in a strict 2x2 grid with generous transparent spacing and equal cells. TOP LEFT: pink-haired glasses woman from image1 TRUE RIGHT SIDE PROFILE looking right, only one eye visible, arms bent forward hands resting on invisible poker table. TOP RIGHT: same pink glasses woman TRUE LEFT SIDE PROFILE looking left. BOTTOM LEFT: teal twin ponytails woman image2 TRUE RIGHT SIDE PROFILE, arms forward hands on invisible table. BOTTOM RIGHT: same teal twin ponytails woman TRUE LEFT SIDE PROFILE. Preserve each character's exact outfit, hair, glasses, colors and chibi proportions from their own sheet. Pink retains pixel-art edges, twin ponytails retains clean illustrated outlines. SIDE PROFILE strictly 90 degrees, NOT three-quarter, torso also side. Standing, full boots and head visible. No weapons, table, chair, labels, text, grid lines, checkerboard or backdrop. Genuine alpha transparency. This sheet supplies side views only; original front/back will be retained separately.

Rebuild: python scripts/prepare-poker-guests.py (Pillow, numpy, scipy).
Original front/back are cropped from the supplied sheets, with edge-connected
neutral checkerboard removed; no generative redesign. Oblique poses and their
complete source JPG remain in archive/poker/*-table-poses/ and *-table-original.jpg.
Runtime cells: 256x360 RGBA, alpha bounds fitted within 236x336, soles at y348.
