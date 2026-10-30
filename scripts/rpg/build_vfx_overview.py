"""Compose the six actual runtime sheets into a review GIF. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
def main():
    data=json.loads((ROOT/'public/rpg/vfx/runtime/manifest.json').read_text())['effects'];data.sort(key=lambda e:['ground-rift','dark-hole','blizzard','holy-wrath','whirlwind','recovery'].index(e['id']))
    sheets=[Image.open(ROOT/('public'+e['sheet'])).convert('RGBA') for e in data];frames=[]
    for fi in range(32):
        out=Image.new('RGBA',(768,568),'#122028');draw=ImageDraw.Draw(out)
        for i,(e,sheet) in enumerate(zip(data,sheets)):
            x=i%3*256;y=i//3*284;draw.text((x+12,y+8),e['id'].upper()+' / 2D BAKE',fill='#e8d5a3')
            tile=sheet.crop((fi%8*256,fi//8*256,(fi%8+1)*256,(fi//8+1)*256));out.alpha_composite(tile,(x,y+28))
        frames.append(out.convert('RGB'))
    dest=ROOT/'public/rpg/vfx/overview.gif';frames[0].save(dest,save_all=True,append_images=frames[1:],duration=[60,60,60,70]*8,loop=0,optimize=True,disposal=2)
    print('VFX_OVERVIEW_WRITTEN')
if __name__=='__main__':main()
