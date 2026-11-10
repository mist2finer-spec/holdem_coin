"""Restore pinned NuGet runtime DLLs. Usage: python scripts/unity/restore-stage-runtime.py --project unity/IslandGame

DLLs, .meta GUIDs and license notices are tracked in the actual Unity project.
Use this repair helper only when a local runtime library needs to be restored.
"""
import argparse,hashlib,io,json,urllib.request,zipfile
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',type=Path,required=True)
    args=parser.parse_args()
    project=args.project.resolve()
    if not (project/'ProjectSettings/ProjectVersion.txt').is_file():
        parser.error('Destination must be an existing Unity project')
    repo=Path(__file__).resolve().parents[2]
    snapshot=repo/'unity/IslandGame/Assets/Island/Plugins/StageRuntime'
    dependencies=json.loads((snapshot/'dependencies.json').read_text(encoding='utf-8'))
    verified=[]
    for dep in dependencies:
        with urllib.request.urlopen(dep['url'],timeout=60) as response:
            package=response.read()
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            raw=archive.read('lib/'+dep['framework']+'/'+dep['dll'])
        if hashlib.sha256(raw).hexdigest()!=dep['sha256']:
            raise RuntimeError('DLL hash mismatch: '+dep['dll'])
        verified.append((dep['dll'],raw))
    target=project/'Assets/Island/Plugins/StageRuntime'
    target.mkdir(parents=True,exist_ok=True)
    for name,raw in verified:
        destination=target/name
        if destination.exists() and destination.read_bytes()!=raw:
            backup=destination.with_suffix('.dll.before-stage-v1')
            if backup.exists():raise RuntimeError('Backup already exists: '+str(backup))
            backup.write_bytes(destination.read_bytes())
        destination.write_bytes(raw)
    for source in snapshot.iterdir():
        if source.is_file() and source.suffix.lower()!='.dll':
            destination=target/source.name
            if destination.exists() and destination.read_bytes()!=source.read_bytes():
                raise RuntimeError('Preserve local edits; reconcile snapshot manually: '+str(destination))
            destination.write_bytes(source.read_bytes())
    print(json.dumps({'status':'PASS','restoredLibraries':len(verified),'target':str(target)}))

if __name__=='__main__':main()
