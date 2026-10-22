"""Find assets, inspect an individual Unity object, or verify the asset library.
No AI, network, or game dependencies required. Run from any directory.
"""
import argparse, hashlib, json, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'rpg-assets'

def records():
    for path in sorted((ROOT/'catalog').glob('*.jsonl')):
        if path.name=='files.jsonl':continue
        with path.open() as stream:
            for line in stream: yield json.loads(line)

def main():
    p=argparse.ArgumentParser(description=__doc__); sub=p.add_subparsers(dest='command',required=True)
    find=sub.add_parser('find');find.add_argument('query');find.add_argument('--type');find.add_argument('--limit',type=int,default=30)
    meta=sub.add_parser('metadata');meta.add_argument('id',help='Exact id returned by find')
    sub.add_parser('verify')
    args=p.parse_args()
    if args.command=='find':
        found=0
        for rec in records():
            if args.query.lower() not in rec['name'].lower():continue
            if args.type and rec['type']!=args.type:continue
            print(json.dumps(rec,ensure_ascii=False));found+=1
            if found>=args.limit:return
        gallery=ROOT/'catalog/gallery.json'
        if gallery.exists():
            for part in json.loads(gallery.read_text()):
                if part['type']!='SpineRegion':continue
                if args.type and args.type!='SpineRegion':continue
                if args.query.lower() not in (part['name']+' '+part['category']).lower():continue
                print(json.dumps(part,ensure_ascii=False));found+=1
                if found>=args.limit:break
        return
    if args.command=='metadata':
        for rec in records():
            if rec['id']==args.id:
                with zipfile.ZipFile(ROOT/rec['metadata']['archive']) as z:
                    sys.stdout.buffer.write(z.read(rec['metadata']['member'])+b'\n')
                return
        raise SystemExit('Object id not found')
    failures=[]; n=0; ids=set(); counts={}; archives={}
    for rec in records():
        n+=1
        if rec['id'] in ids: failures.append('Duplicate identity: '+rec['id'])
        ids.add(rec['id']);counts[rec['bundle']]=counts.get(rec['bundle'],0)+1
        if not isinstance(rec['path_id'],str): failures.append('Non-string path ID')
        for file in rec['files']:
            if not (ROOT/file).is_file(): failures.append('Missing export '+file)
        ref=rec['metadata']; archive=ref['archive']
        if archive not in archives:
            with zipfile.ZipFile(ROOT/archive) as z:
                bad=z.testzip()
                if bad: failures.append('ZIP CRC failure '+archive+'/'+bad)
                archives[archive]=set(z.namelist())
        if ref['member'] not in archives[archive]:failures.append('Missing metadata '+rec['id'])
    for src in json.loads((ROOT/'catalog/sources.json').read_text()):
        path=ROOT/'sources'/src['bundle']
        if hashlib.sha256(path.read_bytes()).hexdigest()!=src['sha256']: failures.append('Source hash '+str(path))
        if counts.get(src['bundle'],0)!=src['objects']: failures.append('Source object count '+src['bundle'])
    for file in json.loads((ROOT/'catalog/assets.json').read_text()):
        path=ROOT/file['path']
        if hashlib.sha256(path.read_bytes()).hexdigest()!=file['sha256']:failures.append('Export hash '+file['path'])
    for manifest in ROOT.rglob('spine-manifest.json'):
        data=json.loads(manifest.read_text())
        if data['errors']:failures.append('Spine error '+str(manifest))
        for part in data['parts']:
            if not (manifest.parent/part['file']).is_file():failures.append('Missing part '+part['name'])
    seal=ROOT/'catalog/files.jsonl'
    if seal.exists():
        for line in seal.read_text().splitlines():
            row=json.loads(line);path=ROOT/row['path']
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:failures.append('File seal mismatch '+row['path'])
    result={'objects':n,'archives':len(archives),'failures':failures}
    print(json.dumps(result,ensure_ascii=False,indent=2));return 1 if failures else 0
if __name__=='__main__':sys.exit(main() or 0)
