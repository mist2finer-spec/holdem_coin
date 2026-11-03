"""Add only the shared poker profile images/manifest to a Unity project.

Existing .meta files and unrelated project files are preserved. Changed files
are backed up before replacement; this does not merge or overwrite local C#.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import uuid

ROOT = Path(__file__).resolve().parents[2]


def export_profiles(project=None):
    project = Path(project or ROOT/'unity/IslandGame').resolve()
    if not (project/'Assets').is_dir() or not (project/'Packages/manifest.json').is_file():
        raise ValueError('Use the existing Unity project root, containing Assets and Packages/manifest.json')
    source = ROOT/'public/poker/profiles'
    manifest = json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    assert len(manifest['characters']) == 9
    resources = project/'Assets/Island/Resources'
    backup = project/'.island-backups'/('poker-profiles-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:6])
    rows = []
    def write(relative, payload):
        dest = resources/relative
        if dest.exists() and dest.read_bytes() != payload:
            saved = backup/'Assets/Island/Resources'/relative
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dest, saved)
        if not dest.exists() or dest.read_bytes() != payload:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(payload)
        rows.append({'destination':relative,'sha256':hashlib.sha256(payload).hexdigest()})
    write('PokerProfiles.json', (source/'manifest.json').read_bytes())
    for name in [c['id']+'.png' for c in manifest['characters']]+['dealer-disc.png']:
        assert Path(name).name == name
        payload = (source/name).read_bytes()
        assert payload[:8] == b'\x89PNG\r\n\x1a\n', name
        write('WebAssets/poker/profiles/'+name, payload)
    report = resources/'poker-profile-export.json'
    report.write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
    print('UNITY_POKER_PROFILES_READY', len(manifest['characters']), 'portraits; no C# or GUID files replaced')
    if backup.exists():
        print('CHANGED_ASSET_BACKUP', backup)
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--project-path', type=Path)
    export_profiles(parser.parse_args().project_path)
