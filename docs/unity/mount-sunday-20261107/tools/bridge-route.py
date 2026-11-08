import json,math
from pathlib import Path
w=Path(r'C:\Users\SHK\mount-sunday-review-20261107');p=w/'optimized-road.json';a=json.loads(p.read_text())['points'];first=158;last=194
p0=a[first];p1=a[last];points=a[:first+1]
for target in [dict(x=-365-.894427*21,y=34.0,z=250+.447214*21),dict(x=-365-.894427*9,y=35.27,z=250+.447214*9),dict(x=-365,y=36.27,z=250),dict(x=-365+.894427*9,y=35.27,z=250-.447214*9),dict(x=-365+.894427*21,y=36.7,z=250-.447214*21),p1]:
 prev=points[-1];n=max(1,math.ceil(math.hypot(target['x']-prev['x'],target['z']-prev['z'])/1.2))
 for j in range(1,n+1):points.append({k:prev[k]+(target[k]-prev[k])*j/n for k in 'xyz'})
points+=a[last+1:];p.write_text(json.dumps({'points':points}),encoding='utf-8');print(len(points))
