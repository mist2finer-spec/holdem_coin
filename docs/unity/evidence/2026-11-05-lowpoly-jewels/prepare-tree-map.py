from pathlib import Path
import json,math
w=Path(__file__).parent;d=json.loads(Path('C:/Users/SHK/island-tree-design-review/preview-data.json').read_text(encoding='utf-8'))
n={n['id']:n for n in d['nodes']};focus={}
for start in d['starts']:
 i=start['nodeId'];p=d['positions'][i]
 candidates=[g for g in d['groups'].values() if any(n[j]['region']==start['region'] for j in g['ids']) and g['pattern'] not in ['target']]
 candidates=sorted(candidates,key=lambda g:(math.dist(p,g['center']),','.join(g['ids'])))[:2]
 ids={i}|{j for g in candidates for j in g['ids']};pts=[d['positions'][j] for j in ids]
 focus[i]=[min(q[0] for q in pts)-.45,min(q[1] for q in pts)-.45,max(q[0] for q in pts)+.45,max(q[1] for q in pts)+.45]
out={'version':2,'graphFingerprint':d['metrics']['fingerprint'],'positions':d['positions'],'edges':d['edges'],'paths':d['paths'],'reservations':d['reservations'],'focus':focus,'goalRoles':d['goalRoles'],'groups':d['groups']}
(w/'SkillTreePresentationV2.json').write_bytes(json.dumps(out,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
print({'positions':len(out['positions']),'edges':len(out['edges']),'reservedSockets':len(out['reservations']),'focusRegions':len(focus)})
