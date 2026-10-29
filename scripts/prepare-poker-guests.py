"""Slice original front/back without regeneration; retain all supplied oblique poses.
Run from repository root. Input JPEGs are archived, including baked checkerboard.
"""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np
import json

ROOT=Path(__file__).resolve().parents[1]
SETTINGS=[('pink-glasses',(0,180,456,1050),(1368,180,1824,1050),[(456,180,912,1050),(912,180,1368,1050)]),('teal-twins',(0,100,456,655),(1368,100,1824,655),[(456,100,912,655),(912,100,1368,655),(0,780,456,1345),(456,780,912,1345),(912,780,1368,1345),(1368,780,1824,1345)])]
def cutout(im):
 a=np.asarray(im.convert('RGB'));neutral=(a.max(2).astype(int)-a.min(2)<28)&(a.min(2)>115)
 labels,_=ndimage.label(neutral);edges=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]));bg=np.isin(labels,edges[edges>0])
 fg,_=ndimage.label(~bg);counts=np.bincount(fg.ravel());counts[0]=0
 alpha=np.where(fg==counts.argmax(),255,0).astype('uint8')
 rgba=Image.fromarray(np.dstack([a,alpha]));return rgba.crop(rgba.getbbox())
def normalize(im):
 im=im.copy();im.thumbnail((236,336),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(256,360));canvas.alpha_composite(im,((256-im.width)//2,348-im.height));return canvas
for name,front,back,poses in SETTINGS:
 source=ROOT/'archive/poker'/f'{name}-table-original.jpg';im=Image.open(source).convert('RGB')
 bounds=lambda b:tuple(round(v*(im.width/1824 if i%2==0 else im.height/1361)) for i,v in enumerate(b))
 archive=ROOT/'archive/poker'/f'{name}-table-poses';archive.mkdir(exist_ok=True)
 out=ROOT/'public/poker'/f'{name}-table';out.mkdir(parents=True,exist_ok=True)
 for i,b in enumerate(poses):im.crop(bounds(b)).save(archive/f'original-pose-{i+1}.png')
 for view,b in [('front',front),('back',back)]:
  cut=cutout(im.crop(bounds(b)));cut.save(archive/f'{view}-cutout.png');normalize(cut).save(out/f'{view}.png')
 (out/'manifest.json').write_text(json.dumps({'character':name,'source':str(source.relative_to(ROOT)),'frontBack':'source crops; no regeneration','sides':'generated true profiles','canvas':[256,360],'footY':348,'preservedPoses':str(archive.relative_to(ROOT))},indent=2)+'\n')
# Generated sheet is truly transparent: pink right/left on top, twins right/left below.
source=ROOT/'archive/poker/guests-side-profiles.png'
if source.exists():
 im=Image.open(source).convert('RGBA')
 for row,name in enumerate(['pink-glasses','teal-twins']):
  for col,view in enumerate(['right','left']):
   cell=im.crop((col*im.width//2,row*im.height//2,(col+1)*im.width//2,(row+1)*im.height//2));cell=cell.crop(cell.getbbox());normalize(cell).save(ROOT/'public/poker'/f'{name}-table'/f'{view}.png')
