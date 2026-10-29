"""Extract the four generated standing poker views; preserve transparency."""
from pathlib import Path
from PIL import Image
import json
source=Path('archive/poker/hong-table-source.png');im=Image.open(source).convert('RGBA');out=Path('public/poker/hong-table');out.mkdir(parents=True,exist_ok=True)
views={}
for name,col,row in [('front',0,0),('right',1,0),('left',0,1),('back',1,1)]:
 cell=im.crop((col*im.width//2,row*im.height//2,(col+1)*im.width//2,(row+1)*im.height//2));box=cell.getbbox();assert box
 crop=cell.crop(box);crop.thumbnail((236,336),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(256,360));canvas.alpha_composite(crop,((256-crop.width)//2,348-crop.height));canvas.save(out/(name+'.png'));views[name]={'cell':[col,row],'sourceBounds':box,'size':[256,360]}
(out/'manifest.json').write_text(json.dumps({'version':1,'character':'hong','source':str(source),'views':views,'pose':'standing with hands resting toward table; no chair','scope':'single 8-seat visual prototype'},indent=2)+'\n')
