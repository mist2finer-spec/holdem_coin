from pathlib import Path
w=Path(r'C:\Users\SHK\mount-sunday-review-20261107')
p=w/'ReviewControls.cs.txt'
s=p.read_text(encoding='utf-8-sig').replace('Mount Sunday ?','Mount Sunday -').replace(' · ',' | ')
p.write_text(s,encoding='utf-8')
# Store a distinct optimized walking route. Performance always uses unchanged source road.
import json, math
road=json.loads((w/'MountSundayReview/Assets/MountSunday/Resources/MountSundayReviewRoad.json').read_text())
a=road['points']; idx=next(i for i,p in enumerate(a) if p['x']>-50 and p['z']>-60)
points=a[:idx]
for lx,lz,h in [(0,30,99.74),(0,25.4,99.74),(0,21,101.54),(0,17.5,101.54)]:
 ang=math.radians(-145); target={'x':-22+math.sin(ang)*lz,'y':h,'z':-12+math.cos(ang)*lz}
 prev=points[-1];n=max(1,math.ceil(math.hypot(target['x']-prev['x'],target['z']-prev['z'])/1.5))
 for j in range(1,n+1):points.append({k:prev[k]+(target[k]-prev[k])*j/n for k in 'xyz'})
(w/'optimized-road.json').write_text(json.dumps({'points':points}),encoding='utf-8')
print('review path',len(points),'end',points[-1])
