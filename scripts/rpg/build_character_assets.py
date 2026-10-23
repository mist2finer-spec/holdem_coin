"""Slice generated 4x4 combat sheets; preserve originals and normalize common foot anchors.
Usage: python scripts/rpg/build_character_assets.py --inputs /path/to/inputs.json
Inputs JSON: {"boy-hoodie":"/path/to/generated.png", ...}.
Pillow is required. This performs deterministic sprite extraction, not pose generation.
"""
import argparse,hashlib,json,shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
ROSTER=[('boy-hoodie','갈색 후드',2),('white-bob','백발 붉은 드레스',3),('gold-dress','금빛 드레스',1),('black-suit','안경 검은 정장',4),('longhair-man','장발 검은 셔츠',5),('teal-twins','청록 트윈테일',6),('hong','홍',7),('pink-glasses','분홍머리 안경',8),('blonde-office','금발 오피스',9)]
NAMES=['idle-0','idle-1','idle-2','idle-3','run-0','run-1','run-2','run-3','windup','jab','cross','kick','finisher','dodge-start','dodge-roll','hurt']
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def grid_boundaries(mask,axis):
 # Generators approximate row spacing. Split only at actual transparent gutters,
 # never at a theoretical quarter that could cut feet, hair or a striking arm.
 length=mask.height if axis=='y' else mask.width
 blank=[]
 for i in range(length):
  strip=mask.crop((0,i,mask.width,i+1) if axis=='y' else (i,0,i+1,mask.height))
  blank.append(strip.getbbox() is None)
 gaps=[];start=None
 for i,is_blank in enumerate(blank+[False]):
  if is_blank and start is None:start=i
  elif not is_blank and start is not None:
   if i-start>=2:gaps.append((start,i))
   start=None
 cuts=[0]
 for q in (1,2,3):
  target=length*q/4
  candidates=[(a,b) for a,b in gaps if abs((a+b)/2-target)<length*.08]
  if not candidates:raise ValueError(f'Missing transparent {axis} gutter near quarter {q}')
  a,b=min(candidates,key=lambda v:abs((v[0]+v[1])/2-target))
  cuts.append((a+b)//2)
 return cuts+[length]
def build(inputs):
 out=ROOT/'public/rpg/characters';out.mkdir(parents=True,exist_ok=True)
 roster=[]
 for key,label,portrait in ROSTER:
  source=Path(inputs[key]);im=Image.open(source).convert('RGBA')
  if im.getchannel('A').getextrema()[0]==255:raise ValueError(f'{key}: no transparent background')
  dest=out/key;dest.mkdir(exist_ok=True);(dest/'frames').mkdir(exist_ok=True)
  shutil.copyfile(source,dest/'source.png')
  cells=[]
  mask=im.getchannel('A').point(lambda a:255 if a>=40 else 0)
  rows=grid_boundaries(mask,'y')
  columns=[grid_boundaries(mask.crop((0,rows[y],im.width,rows[y+1])),'x') for y in range(4)]
  for i in range(16):
   x,y=i%4,i//4
   cell=im.crop((columns[y][x],rows[y],columns[y][x+1],rows[y+1]))
   bbox=cell.getchannel('A').point(lambda a:255 if a>=40 else 0).getbbox()
   if not bbox:raise ValueError(f'{key}: empty cell {i}')
   cells.append(cell.crop(bbox))
  # One global scale retains crouch/run height; no per-frame stretch.
  scale=min(205/max(c.height for c in cells[:4]),240/max(c.width for c in cells),218/max(c.height for c in cells))
  sheet=Image.new('RGBA',(1024,1024));frames=[]
  for i,cell in enumerate(cells):
   cell=cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.NEAREST)
   frame=Image.new('RGBA',(256,256));frame.alpha_composite(cell,((256-cell.width)//2,224-cell.height))
   frame.save(dest/'frames'/f'{i:02d}-{NAMES[i]}.png',optimize=True)
   sheet.alpha_composite(frame,((i%4)*256,(i//4)*256))
   frames.append({'index':i,'name':NAMES[i],'rect':[(i%4)*256,(i//4)*256,256,256],'anchor':[128,224]})
  sheet.save(dest/'sheet.png',optimize=True)
  # Reuse extracted idle head for the small combat UI portrait.
  frame=Image.open(dest/'frames/00-idle-0.png');frame.crop((64,12,192,140)).save(dest/'portrait.png',optimize=True)
  meta={'id':key,'label':label,'portraitId':portrait,'format':'rgba-grid-v1','sheet':'sheet.png','source':'source.png','cell':[256,256],'grid':[4,4],'facing':'right','footAnchor':[128,224],'frames':frames,'animations':{'idle':[0,1,2,3],'run':[4,5,6,7],'attack1':[8,9],'attack2':[8,10],'attack3':[8,11],'attack4':[8,12],'attack5':[8,12],'avoid1':[13,14],'damage1':[15]},'sourceReference':f'/island/chr_{portrait}.jpg','sourceSha256':digest(dest/'source.png'),'sheetSha256':digest(dest/'sheet.png'),'generator':'built-in image_gen','status':'prototype-generated-poses','limitations':['Five attack mappings use four distinct contact poses.','Not a Spine rig or a recovered original animation.','Skills reuse melee poses; dedicated skill effects and death poses are not supplied.']}
  (dest/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
  roster.append({'id':key,'label':label,'portraitId':portrait,'manifest':f'{key}/manifest.json','sheet':f'{key}/sheet.png'})
 (out/'roster.json').write_text(json.dumps(roster,ensure_ascii=False,indent=2)+'\n')
 print(f'CHARACTER_ASSETS_BUILT {len(roster)} characters, {len(roster)*16} frames')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--inputs',required=True);args=parser.parse_args();build(json.loads(Path(args.inputs).read_text()))
