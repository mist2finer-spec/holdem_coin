"""Hash every asset-library file after export, catalog build, and documentation changes."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'rpg-assets'
dest=root/'catalog/files.jsonl'
rows=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or p==dest:continue
 rows.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
dest.write_text('\n'.join(json.dumps(r,separators=(',',':')) for r in rows)+'\n')
print(json.dumps({'files':len(rows),'bytes':sum(r['bytes'] for r in rows)}))
