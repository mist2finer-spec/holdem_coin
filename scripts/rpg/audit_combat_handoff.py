"""Read the existing handoff, index selected native evidence, optionally extract locally.

No APK/native execution, network calls, or new decompilation. Original input ZIPs
are never modified. Raw reference code is not intended for the public repository.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from zipfile import ZipFile

METHODS = {
    'CombatHeroAI': ['OnAdvance', 'ResetDefaultAttackCombo', 'MakeExecutableSkillAndItsTargetInRange', 'ReserveAvoid'],
    'CombatActor': ['StartRush', 'StopRush', 'StartDash', 'StopDash', 'get_DefaultAttackSkillTypeCount',
                    'GetDefaultAttackSkillType', 'ExecuteSkill'],
    'CombatActorManager': ['ProcessRush', 'ProcessDash', 'RunActionMotion', 'RunActionImpactor', 'RunActionAvoid'],
}


def audit(source, output, extract=None):
    with ZipFile(source) as outer:
        nested = next(n for n in outer.namelist() if n.endswith('/VERIFIED_SOURCE/Vardian_Bulk_Combat_Audit.zip'))
        payload = outer.read(nested)
        config_zip = next(n for n in outer.namelist() if n.endswith('/Vardian_Remaining_Assets_And_Loader_Audit.zip'))
        config_payload = outer.read(config_zip)
    records = []
    with ZipFile(io.BytesIO(payload)) as archive:
        for cls, methods in METHODS.items():
            for method in methods:
                prefix = cls + '__' + method + '__T'
                matches = [n for n in archive.namelist() if Path(n).name.startswith(prefix) and n.endswith('.txt')]
                if len(matches) != 1:
                    raise ValueError(f'Expected exactly one evidence file for {cls}.{method}: {matches}')
                member = matches[0]
                raw = archive.read(member)
                text = raw.decode('utf-8-sig').replace('\r', '')
                def header(key):
                    match = re.search(r'^' + key + r':\s*(.+)$', text, re.M)
                    if not match:
                        raise ValueError(f'Missing {key} in {member}')
                    return match[1].strip()
                if 'DECOMPILED CODE' not in text:
                    raise ValueError(f'No function body: {member}')
                records.append({'method': cls + '.' + method, 'token': header('TOKEN'), 'address': header('ADDRESS'),
                                'member': member, 'sha256': hashlib.sha256(raw).hexdigest(),
                                'evidence': 'NATIVE_BODY_PRESENT_NOT_COMPLETE_BEHAVIOR_PROOF'})
                if extract:
                    dest = Path(extract) / Path(member).name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if dest.exists():
                        raise FileExistsError(dest)
                    dest.write_bytes(raw)
    with ZipFile(io.BytesIO(config_payload)) as archive:
        objects = {}
        for member in archive.namelist():
            match = re.search(r'config_assets.*__(-?\d+)__mono.json$', member)
            if match:
                raw = archive.read(member)
                objects[match[1]] = {'data': json.loads(raw), 'member': member,
                                    'sha256': hashlib.sha256(raw).hexdigest()}
        database = next(v for v in objects.values() if v['data'].get('m_Name') == 'Actions Database')
        refs = database['data'].get('data', [])
        resolved = [{'pathId': str(r['m_PathID']), 'name': objects.get(str(r['m_PathID']), {}).get('data', {}).get('m_Name')}
                    for r in refs if r.get('m_FileID') == 0]
        config_audit = {'archive': config_zip, 'objectsInspected': len(objects),
                        'actionsDatabaseLocalReferences': resolved,
                        'note': 'SpeedAction/WaitAnyInputAction/WaitForAction are not the combat SkillType/ActionData mapping',
                        'matchingRushComboFields': [{'name': v['data'].get('m_Name'), 'member': v['member'],
                            'fields': [k for k in v['data'] if any(t in k.lower() for t in ['rush', 'combo', 'defaultattack'])]}
                            for v in objects.values() if any(any(t in k.lower() for t in ['rush', 'combo', 'defaultattack'])
                                                           for k in v['data'])]}
    result = {'schemaVersion': 1, 'archive': Path(source).name,
              'archiveSha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(),
              'nestedArchive': nested, 'nestedSha256': hashlib.sha256(payload).hexdigest(), 'functions': records,
              'configAudit': config_audit,
              'supportedStructure': ['combo advances modulo configured skill count', 'combo timer/reset',
                                     'approach Rush separate from action Dash', 'timed motion/impactor action processing'],
              'unresolved': ['actual equipped default-attack skill list/count', 'SkillType -> ActionData -> motion alias',
                             'impactor hit frames/range/damage', 'Rush enabled/min/max distance/speed config',
                             'collision flags and interruption semantics']}
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'functions': len(records), 'output': str(target), 'newDecompilationNeeded': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('handoff_zip')
    parser.add_argument('--output', required=True)
    parser.add_argument('--extract-dir', help='Optional private local folder; existing reference files are not overwritten')
    args = parser.parse_args()
    audit(args.handoff_zip, args.output, args.extract_dir)
