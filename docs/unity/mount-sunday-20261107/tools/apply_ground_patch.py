"""Apply only this task's ground fix after checking every original hash.
Usage: python apply_ground_patch.py ISOLATED_PROJECT [--apply]
Default: validate only. Close Unity before applying; existing files are backed up.
"""
from pathlib import Path
import argparse, hashlib, json, shutil, datetime

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('project',type=Path)
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
root=args.project.resolve()
patch=Path(__file__).resolve().parents[1]/'ground-patch'
if not (root/'ProjectSettings/ProjectVersion.txt').is_file():
    raise SystemExit('Target is not a Unity project')
rows=json.loads((patch/'manifest.json').read_text(encoding='utf-8'))
pending=[]
for row in rows:
    target=(root/row['path']).resolve()
    if not target.is_relative_to(root):
        raise SystemExit('Invalid target path')
    current=hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
    if current==row['after']:
        continue
    if current!=row['before']:
        raise SystemExit('Modified since review; merge manually: '+row['path'])
    source=patch/row['path']
    if hashlib.sha256(source.read_bytes()).hexdigest()!=row['after']:
        raise SystemExit('Patch integrity failure: '+row['path'])
    pending.append(row)
print(f'Validated {len(rows)} files; {len(pending)} changes pending')
if args.apply:
    backup=root/'GroundReviewBackup'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    for row in pending:
        target=root/row['path']
        if target.exists():
            saved=backup/row['path'];saved.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(target,saved)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(patch/row['path'],target)
    print('Applied; open Unity, compile, and inspect the terrain before building')
