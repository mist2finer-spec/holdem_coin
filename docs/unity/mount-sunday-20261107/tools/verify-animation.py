from pathlib import Path
from PIL import Image,ImageChops
import json,shutil
w=Path(r'C:/Users/SHK/mount-sunday-review-20261107');e=w/'evidence';p=w/'MountSundayReview/Assets/Evidence'
a=Image.open(p/'animation-a.png').convert('RGB');b=Image.open(p/'animation-b.png').convert('RGB')
r={}
for name,box in {'sky':[400,10,1000,90],'water':[960,475,1240,500],'vegetation':[30,570,400,710]}.items():
 diff=ImageChops.difference(a.crop(box),b.crop(box));values=list(diff.getdata());changed=sum(max(v)>2 for v in values);r[name]={'rectangle':box,'pixels':len(values),'changedPixelsOver2':changed,'meanAbsoluteChannelDifference':sum(sum(v) for v in values)/(len(values)*3)}
s=json.loads((e/'animation-start.json').read_text(encoding='utf-8-sig'))['data']['result']['result'];t=json.loads((e/'animation-end.json').read_text(encoding='utf-8-sig'))['data']['result']['result'];assert t['frame']>s['frame'] and t['time']>s['time'];assert r['sky']['changedPixelsOver2']==0;assert r['water']['changedPixelsOver2']>0 and r['vegetation']['changedPixelsOver2']>0
out={'status':'PASS','method':'Two actual camera captures at fixed pose during Play Mode; static sky unchanged, water and vegetation pixels changed. Controllers disabled only for this transient check.','start':s,'end':t,'regions':r};(e/'animation-validation.json').write_text(json.dumps(out,indent=2));print(json.dumps({'status':'PASS','frameDelta':t['frame']-s['frame'],'regions':r}))
for f in ['animation-a.png','animation-b.png']:shutil.copy2(p/f,e/'screenshots'/f)
