"""Validate the snapshot against an existing IslandGame project; add --apply to install with backups."""
from pathlib import Path
import argparse,hashlib,json,shutil,datetime
parser=argparse.ArgumentParser();parser.add_argument('project',type=Path);parser.add_argument('--apply',action='store_true');a=parser.parse_args()
snapshot=Path(__file__).resolve().parent.parent;manifest=json.loads((snapshot/'manifest.json').read_text());root=a.project.resolve();changes=[];conflicts=[]
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for item in manifest:
 if item['path'].startswith(('Packages/','ProjectSettings/')):continue
 rel=Path(item['path']);dest=(root/rel).resolve();source=snapshot/'ProjectPatch'/rel
 if not dest.is_relative_to(root):raise ValueError('Unsafe patch path')
 if digest(source)!=item['sha256']:raise ValueError('Snapshot checksum failed: '+str(rel))
 if dest.exists():
  current=digest(dest)
  if current==item['sha256']:continue
  if current!=item.get('beforeSha256'):conflicts.append(str(rel));continue
 changes.append((source,dest))
if conflicts:raise SystemExit('Review local changes before applying: '+', '.join(conflicts))
print(str(len(changes))+' files ready; no conflicts')
if a.apply:
 backup=root/'.island-backups'/('mount-import-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
 for source,dest in changes:
  if dest.exists():b=backup/dest.relative_to(root);b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,b)
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
 print('Installed; open Unity to resolve packages and compile. Build settings include main plus ten zones.')
