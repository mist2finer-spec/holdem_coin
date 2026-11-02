"""Export current assets/catalog into an actual Unity project root.

Changed Resources in an external project are backed up before replacement.
Existing .meta files and unrelated local files are never removed.
"""
import argparse
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

from map_contract import (CONTRACT_RESOURCE, MAP_RESOURCE, MAP_SOURCE,
                          build_map_contract, read_json, sha256)

ROOT = Path(__file__).resolve().parents[2]
SOURCE_PROJECT = ROOT / 'unity/IslandGame'


def source_commit():
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True,
                                       stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return 'source-archive'


class ResourceWriter:
    def __init__(self, project, backup_changes):
        self.project = Path(project)
        self.root = self.project / 'Assets/Island/Resources'
        self.backup_changes = backup_changes
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + uuid.uuid4().hex[:8]
        self.backup = self.project / 'IslandUpdateBackups' / ('resources-' + stamp)
        self.backed_up = []

    def write(self, relative, payload):
        relative = Path(relative)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe Resources destination: ' + str(relative))
        path = self.root / relative
        if path.exists():
            previous = path.read_bytes()
            if previous == payload:
                return path
            if self.backup_changes:
                saved = self.backup / 'Assets/Island/Resources' / relative
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, saved)
                self.backed_up.append(relative.as_posix())
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return path

    def json(self, relative, data):
        return self.write(relative, (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))


def prepare(checkout=True, project_path=None, skip_catalog=False):
    project = Path(project_path).expanduser().resolve() if project_path else SOURCE_PROJECT
    if not (project / 'Assets').is_dir() or not (project / 'Packages/manifest.json').is_file():
        raise RuntimeError('Project root must contain Assets and Packages/manifest.json: ' + str(project))
    data = read_json(ROOT / 'src/components/rpg/data/labyrinth-runtime.json')
    heroes = {'axe': 'characters/hong/native-axe/hong', 'sword': 'characters/hong/native-sword/hong',
              'dual': 'characters/hong/native-dual/hong', 'spear': 'characters/hong/native-spear/hong',
              'unarmed': 'characters/hong/native-axe/hong'}
    roots = {'public/poker', MAP_SOURCE.as_posix(), 'public/audio/poker', 'public/rpg/weapons'}
    for hero in heroes.values():
        roots.add('public/rpg/' + str(Path(hero).parent))
    for asset in data['assets'].values():
        roots.add('public/rpg/' + str(Path(asset['skeleton']).parent))
    try:
        tracked = subprocess.check_output(['git', 'ls-files', '-z', 'public'], cwd=ROOT,
                                          stderr=subprocess.DEVNULL).decode().split('\0')
    except (OSError, subprocess.CalledProcessError):
        tracked = [p.relative_to(ROOT).as_posix() for p in (ROOT / 'public').rglob('*') if p.is_file()]
    if checkout and any(not (ROOT / p).exists() for p in tracked if p and any(p.startswith(r + '/') for r in roots)):
        subprocess.run(['git', 'sparse-checkout', 'add', *sorted(roots)], cwd=ROOT, check=True)
    # Keep original mesh/material/camera data and all referenced native textures.
    # source.json.gz remains an evidence input, not an opaque runtime duplicate.
    scene = read_json(ROOT / MAP_SOURCE / 'scene.json')
    native_map_files = {(MAP_SOURCE / 'scene.json').as_posix()}
    native_map_files.update((MAP_SOURCE / texture['file']).as_posix() for texture in scene['textures'].values())
    selected = [p for p in tracked if p and
                (any(p.startswith(r + '/') for r in roots) or
                 (Path(p).parent == Path('public/rpg') and Path(p).name.startswith('SkillIcon_'))) and
                Path(p).suffix.lower() in {'.png', '.jpg', '.webp', '.json', '.atlas', '.mp3', '.wav', '.ogg'} and
                (('/textures/' not in p and not p.endswith('scene.json')) or p in native_map_files)]
    selected = sorted(set(selected) | native_map_files)
    selected = [p for p in selected if not (p.endswith('.png') and p[:-4] + '.webp' in selected)]
    required = [f'public/rpg/{hero}.{ext}' for hero in set(heroes.values()) for ext in ('json', 'atlas', 'png')]
    for asset in data['assets'].values():
        required.extend(f"public/rpg/{asset['skeleton']}.{ext}" for ext in ('json', 'atlas'))
    required.extend(native_map_files)
    missing = [p for p in required if not (ROOT / p).exists()]
    if missing:
        raise RuntimeError('Missing original assets: ' + str(missing[:10]))
    writer = ResourceWriter(project, project.resolve() != SOURCE_PROJECT.resolve())
    destination = writer.root
    rows = []

    def row(source, path):
        rows.append({'source': source, 'destination': path.relative_to(destination).as_posix(), 'sha256': sha256(path)})

    for name in selected:
        src = ROOT / name
        relative = Path('WebAssets') / src.relative_to(ROOT / 'public')
        if src.suffix == '.webp':
            from PIL import Image
            payload = io.BytesIO()
            with Image.open(src) as picture:
                picture.save(payload, format='PNG')
            out = writer.write(relative.with_suffix('.png'), payload.getvalue())
        else:
            if src.suffix == '.atlas':
                relative = relative.with_suffix('.atlas.txt')
            out = writer.write(relative, src.read_bytes())
        row(name, out)
    if not skip_catalog:
        with tempfile.TemporaryDirectory(prefix='island-catalog-') as temp:
            generated = Path(temp) / 'RpgCatalog.json'
            subprocess.run(['node', '--import', str(ROOT / 'mini-services/poker-server/node_modules/tsx/dist/loader.mjs'),
                            str(ROOT / 'scripts/unity/export_catalog.ts'), str(generated)], cwd=ROOT, check=True)
            catalog = writer.write('RpgCatalog.json', generated.read_bytes())
    else:
        supplied = SOURCE_PROJECT / 'Assets/Island/Resources/RpgCatalog.json'
        if not supplied.is_file():
            raise RuntimeError('No prepared RpgCatalog; run without --skip-catalog from a source checkout.')
        catalog = writer.write('RpgCatalog.json', supplied.read_bytes())
    row('@current-web-catalog', catalog)
    monsters = {key: {**data['assets'][value['asset']]} for key, value in data['monsters'].items()
                if value['asset'] in data['assets']}
    unresolved = {key: value['asset'] for key, value in data['monsters'].items() if value['asset'] not in data['assets']}
    contract = build_map_contract(ROOT, monsters)
    row('@native-map-contract', writer.json(CONTRACT_RESOURCE, contract))
    # Source-controlled definitions/display aliases also travel to external projects.
    supplied_resources = SOURCE_PROJECT / 'Assets/Island/Resources'
    generated_names = {'AssetIndex.json', 'RpgCatalog.json', 'asset-export.json', CONTRACT_RESOURCE}
    for source in sorted(supplied_resources.rglob('*')):
        if not source.is_file() or source.suffix == '.meta':
            continue
        relative = source.relative_to(supplied_resources)
        if relative.parts[0] == 'WebAssets' or relative.as_posix() in generated_names:
            continue
        row(source.relative_to(ROOT).as_posix(), writer.write(relative, source.read_bytes()))
    index = {'schema': 3, 'sourceCommit': source_commit(), 'heroes': heroes, 'monsters': monsters,
             'unresolvedMonsterAssets': unresolved, 'catalog': 'RpgCatalog', 'spineRuntime': '4.2',
             'serverAuthority': 'existing Node RPG services',
             'bossTrials': {'mapContract': Path(CONTRACT_RESOURCE).with_suffix('').as_posix(),
                            'scene': MAP_RESOURCE + '/scene', 'definitions': 'BossTrials/bosses',
                            'nativeActorSubstitutes': {item['bossId']: item['monsterId'] for item in contract['actorAssets']}}}
    row('@asset-index', writer.json('AssetIndex.json', index))
    assert len({r['destination'] for r in rows}) == len(rows), 'Duplicate output asset'
    writer.json('asset-export.json', rows)
    if writer.backed_up:
        print('UNITY_RESOURCE_BACKUP', len(writer.backed_up), str(writer.backup))
    print('UNITY_ASSETS_READY', len(rows), str(project))
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-checkout', action='store_true')
    parser.add_argument('--project-path')
    parser.add_argument('--skip-catalog', action='store_true')
    args = parser.parse_args()
    prepare(not args.no_checkout, args.project_path, args.skip_catalog)
