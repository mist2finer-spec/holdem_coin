"""Re-extract native Hong textures from authoring source, never from a warped 1x part.
Geometry/animation JSON is a read-only input. Pillow is the only dependency.
"""
from pathlib import Path
from PIL import Image,ImageOps
from collections import deque
import hashlib,json,re,math
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'archive/rpg/hong-native-hd-source'
OUT=ROOT/'public/rpg/characters/hong/native-axe'
SCALE=4

def cut_component(im):
    im=im.convert('RGBA');a=im.getchannel('A');mask=bytearray(v>=100 for v in a.tobytes());w,h=im.size;best=[]
    for start in range(w*h):
        if not mask[start]:continue
        mask[start]=0;q=deque([start]);group=[]
        while q:
            p=q.popleft();group.append(p);x=p%w;y=p//w
            for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0<=xx<w and 0<=yy<h:
                    n=yy*w+xx
                    if mask[n]:mask[n]=0;q.append(n)
        if len(group)>len(best):best=group
    alpha=bytearray(w*h)
    for i in best:alpha[i]=255
    im.putalpha(Image.frombytes('L',(w,h),bytes(alpha)));return im.crop(im.getbbox())

def clean(im):
    # Retain opaque line art; remove Lanczos ringing in transparent fringe.
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0));return im

def spans(im):
    a=im.getchannel('A');rows=[]
    for y in range(im.height):
        xs=[x for x in range(im.width) if a.getpixel((x,y))>=96]
        rows.append((min(xs),max(xs)+1) if xs else None)
    return rows

def span_at(rows,y):
    y=max(0,min(len(rows)-1,y));lo=math.floor(y);hi=min(len(rows)-1,lo+1)
    if rows[lo] is None or rows[hi] is None:
        valid=[i for i,r in enumerate(rows) if r];return rows[min(valid,key=lambda i:abs(i-y))]
    t=y-lo;return tuple(rows[lo][i]*(1-t)+rows[hi][i]*t for i in (0,1))

def arm(im,name,size):
    if name=='B_Rarm':im=ImageOps.mirror(im)
    guide=Image.open(ROOT/'archive/rpg/hong-native-v1/reference-parts'/f'cos15_{name}.png').convert('RGBA');rows=spans(guide)
    # Perform vertical sampling at final 4x height, then horizontal registration
    # at that same resolution. No intermediate native-sized raster is generated.
    im=im.resize((im.width,size[1]),Image.Resampling.LANCZOS);source=spans(im);out=Image.new('RGBA',size)
    for y in range(size[1]):
        l,r=span_at(rows,(y+.5)/SCALE-.5);l=round(l*size[0]/guide.width);r=round(r*size[0]/guide.width)
        if not source[y] or r<=l:continue
        sl,sr=source[y];strip=im.crop((sl,y,sr,y+1)).resize((r-l,1),Image.Resampling.LANCZOS);out.paste(strip,(l,y))
    return clean(out)

def leg(im,size):
    im=im.resize((im.width,size[1]),Image.Resampling.LANCZOS);rows=spans(im);w,h=im.size
    center=lambda y:sum(span_at(rows,y))/2
    shaft=sum(center(y)for y in range(h//4,h*3//5))/(h*3//5-h//4)
    foot=sum(center(y)for y in range(h*4//5,h))/(h-h*4//5)
    if foot<shaft:im=ImageOps.mirror(im);rows=spans(im)
    out=Image.new('RGBA',size);ankle=sum(center(y)for y in range(h*3//5,h*3//4))/(h*3//4-h*3//5)
    for y,r in enumerate(rows):
        if not r:continue
        shift=w*.48-(center(y)if y<h*.72 else ankle)
        left=(r[0]+shift)/w*size[0];right=(r[1]+shift)/w*size[0]
        if y>=h*.78:left=size[0]*.28;right=size[0]*.96
        left=max(0,round(left));right=min(size[0],max(left+1,round(right)))
        out.paste(im.crop((r[0],y,r[1],y+1)).resize((right-left,1),Image.Resampling.LANCZOS),(left,y))
    return clean(out)

source=Image.open(SRC/'source-parts-1280.png').convert('RGBA');cells=[]
for i in range(16):
    x=i%4*source.width//4;y=i//4*source.height//4
    cells.append(cut_component(source.crop((max(0,x-18),max(0,y-18),min(source.width,x+source.width//4+18),min(source.height,y+source.height//4+18)))))
layout=(SRC/'layout-1x.atlas').read_text();regions={}
for name,bounds in re.findall(r'([^\n]+)\nbounds:(\d+,\d+,\d+,\d+)',layout):regions[name]=tuple(map(int,bounds.split(',')))
mapping={'hong_body':0,'hong_B_body':1,'hong_S_head':2,'hong_B_head':3,'hong_Larm':4,'hong_Larm_S':4,'hong_B_Larm':5,'hong_Rarm':6,'hong_B_Rarm':7,'hong_Lleg1':8,'hong_Lleg2':9,'hong_Rleg':9,'hong_B_Lleg1':10,'hong_B_Lleg2':11,'hong_B_Rleg':11,'hair_front':12,'hair_side':13,'hair_back':14}
page=Image.new('RGBA',(2048,1024));parts=OUT/'parts-hd';parts.mkdir(exist_ok=True);provenance={}
for name,(x,y,w,h) in regions.items():
    size=(w*SCALE,h*SCALE)
    if name=='hong_head':
        im=Image.open(SRC/'original-face.png').convert('RGBA');im=im.crop(im.getbbox());provenance[name]={'source':'original-face.png','nativeSourceSize':im.size,'limit':'Original face has only 53x54 pixels; nearest preserves existing eye design, no invented detail.'};im=im.resize(size,Image.Resampling.NEAREST)
    elif name=='axe07':
        im=Image.open(ROOT/'archive/rpg/hong-native-v1/parts/axe07.png').convert('RGBA');provenance[name]={'source':'original axe07','nativeSourceSize':im.size,'limit':'No higher-resolution original weapon exists; lossless nearest enlargement.'};im=im.resize(size,Image.Resampling.NEAREST)
    else:
        im=cells[mapping[name]].copy();provenance[name]={'source':'source-parts-1280.png','cell':mapping[name],'nativeSourceSize':im.size}
        if name in ['hong_Larm','hong_B_Larm','hong_Rarm','hong_B_Rarm','hong_Larm_S']:im=arm(im,name[5:] if name!='hong_Larm_S' else 'Larm',size)
        elif 'leg' in name:im=leg(im,size)
        else:im=clean(im.resize(size,Image.Resampling.LANCZOS))
    im.save(parts/(name+'.png'));page.paste(im,(x*SCALE,y*SCALE))
page.save(OUT/'hong.png')
hd=re.sub(r'size:512,256','size:2048,1024',layout)
hd=re.sub(r'bounds:(\d+,\d+,\d+,\d+)',lambda m:'bounds:'+','.join(str(int(n)*SCALE)for n in m[1].split(',')),hd)
for label in ['Nearest','Linear']:(OUT/f'hong-{label.lower()}.atlas').write_text(hd.replace('filter:Linear,Linear',f'filter:{label},{label}'))
(OUT/'hong.atlas').write_text((OUT/'hong-linear.atlas').read_text())
assert (OUT/'hong.json').read_bytes()==(SRC/'geometry.json').read_bytes(),'Do not modify runtime geometry'
manifest=json.loads((OUT/'manifest.json').read_text());manifest['textureUpgrade']={'version':1,'size':[2048,1024],'scale':4,'filter':'Linear','geometrySha256':hashlib.sha256((OUT/'hong.json').read_bytes()).hexdigest(),'parts':provenance}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('HONG_HD_REEXTRACTED',len(regions),'parts; JSON byte-identical')
