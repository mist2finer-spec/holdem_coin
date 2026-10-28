"""Axe-only anatomical texture registration; alpha, geometry and thickness are immutable."""
from pathlib import Path
from PIL import Image,ImageOps
from collections import deque
import runpy,json,re,math
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/rpg/characters/hong/native-axe';BASE=ROOT/'archive/rpg/hong-axe-arm-orientation'
helpers=runpy.run_path(str(ROOT/'scripts/rpg/build-hong-native-hd.py'))
# Source landmarks: shoulder, elbow crease, fist center in full-resolution cutouts.
# Target landmarks follow cos15 arm UV anatomy; bent forearms must not be row-warped.
landmarks={
 'Rarm':{'cell':6,'source':[[.16,.16],[.40,.72],[.89,.79]],'target':[[.20,.14],[.48,.52],[.78,.75]]},
 'B_Rarm':{'cell':7,'mirror':True,'source':[[.16,.16],[.40,.72],[.89,.79]],'target':[[.18,.16],[.46,.64],[.81,.74]]},
}
def filled_colors(im):
    w,h=im.size;p=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());owners=[-1]*(w*h);q=deque()
    for i,v in enumerate(p):
        if v[3]>=128:owners[i]=i;q.append(i)
    while q:
        i=q.popleft();x=i%w;y=i//w
        for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0<=xx<w and 0<=yy<h:
                j=yy*w+xx
                if owners[j]<0:owners[j]=owners[i];q.append(j)
    return [p[j][:3]for j in owners]
def sample(p,w,h,x,y):
    x=max(0,min(w-1,x));y=max(0,min(h-1,y));xx=int(x);yy=int(y);fx=x-xx;fy=y-yy
    points=[(xx,yy,(1-fx)*(1-fy)),(min(w-1,xx+1),yy,fx*(1-fy)),(xx,min(h-1,yy+1),(1-fx)*fy),(min(w-1,xx+1),min(h-1,yy+1),fx*fy)]
    return tuple(round(sum(p[b*w+a][k]*v for a,b,v in points))for k in range(3))
def remap(value,stops,targets):
    for i in range(len(stops)-1):
        if value<=stops[i+1]:return targets[i]+(targets[i+1]-targets[i])*(value-stops[i])/(stops[i+1]-stops[i])
    return targets[-1]
sheet=Image.open(ROOT/'archive/rpg/hong-native-hd-source/source-parts-1280.png').convert('RGBA');page=Image.open(OUT/'hong.png').convert('RGBA')
regions={n:tuple(map(int,b.split(',')))for n,b in re.findall(r'([^\n]+)\nbounds:(\d+,\d+,\d+,\d+)',(OUT/'hong.atlas').read_text())}
for name,cfg in landmarks.items():
    i=cfg['cell'];x=i%4*sheet.width//4;y=i//4*sheet.height//4
    im=helpers['cut_component'](sheet.crop((max(0,x-18),max(0,y-18),min(sheet.width,x+sheet.width//4+18),min(sheet.height,y+sheet.height//4+18))))
    if cfg.get('mirror'):im=ImageOps.mirror(im)
    sw,sh=im.size;colors=filled_colors(im);x,y,w,h=regions['hong_'+name]
    old=Image.open(OUT/'parts-hd'/('hong_'+name+'.png')).convert('RGBA');assert old.size==(w,h)
    new=old.copy();alpha=old.getchannel('A');source_rows=helpers['spans'](im);dest_rows=helpers['spans'](old)
    for yy in range(h):
        for xx in range(w):
            if not alpha.getpixel((xx,yy)):continue
            # Preserve silhouette/outer outline exactly, including the existing thickness.
            if any(not(0<=a<w and 0<=b<h)or alpha.getpixel((a,b))==0 for a,b in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]):continue
            dy=(yy+.5)/h
            sy=remap(dy,[0,cfg['target'][1][1],cfg['target'][2][1],1],[0,cfg['source'][1][1],cfg['source'][2][1],1])*(sh-1)
            sl,sr=helpers['span_at'](source_rows,sy);dl,dr=dest_rows[yy];t=(xx+.5-dl)/max(1,dr-dl)
            # Align fist content inside the immutable Cat UV silhouette.
            blend=math.exp(-((dy-cfg['target'][2][1])/.16)**2)
            target_t=(cfg['target'][2][0]*w-dl)/max(1,dr-dl)
            source_t=(cfg['source'][2][0]*sw-sl)/max(1,sr-sl)
            target_t=max(.1,min(.9,target_t));source_t=max(.1,min(.9,source_t))
            u=remap(t,[0,target_t,1],[0,source_t,1]);u=t*(1-blend)+u*blend
            sx=sl+max(0,min(1,u))*(sr-sl-1)
            new.putpixel((xx,yy),(*sample(colors,sw,sh,sx,sy),old.getpixel((xx,yy))[3]))
    assert new.getchannel('A').tobytes()==old.getchannel('A').tobytes();page.paste(new,(x,y))
page.save(OUT/'hong.png')
manifest=json.loads((OUT/'manifest.json').read_text());manifest['armOrientation']={'revision':1,'scope':'axe-only','method':'Cat UV shoulder/elbow/fist registration; frozen alpha silhouette','geometryChanged':False,'thicknessChanged':False,'parts':landmarks};(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('AXE_ARM_ORIENTATION_FIXED: alpha, atlas, bones, weights and animation unchanged')
