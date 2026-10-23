"""Extract the original illustration column; no generative redraw or pose changes."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
for c in json.loads((ROOT/'public/rpg/characters/roster.json').read_text()):
 src=ROOT/f"public/island/chr_{c['portraitId']}.jpg"
 with Image.open(src) as im:
  # Same four-column board layout; chr_1 is a lower resolution export.
  box=tuple(round(v*s) for v,s in zip((20,80,496,1125),(im.width/2048,im.height/1143,im.width/2048,im.height/1143)))
  im.crop(box).save(ROOT/f"public/rpg/characters/{c['id']}/illustration.jpg",quality=94)
print('SELECTION_ILLUSTRATIONS_BUILT',9)
