#!/usr/bin/env python3
"""Build the Axe prototype adapter from local evidence; does not guess original enum names."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile
import sys
sys.path.insert(0, str(Path(__file__).parent))
from trace_combat_chain import read_balance

ROOT = Path(__file__).resolve().parents[2]
ASSET_REV = 'fef94dd999990ae7437681f4566eed6d84b4ff91'
GUID = '7d09d20bec5eaf94cbaa907e7bc294e6'
CAB = 'CAB-8567a9a245cb1780b2cf82cab834069b'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build(chain_path, balance_path, handoff_path):
    evidence = []
    with zipfile.ZipFile(chain_path) as z:
        n = next(n for n in z.namelist() if n.endswith('combat-chain.json'))
        chain_raw = z.read(n)
        chain = json.loads(chain_raw)
        for name in z.namelist():
            if 'schema-evidence' in name and name.endswith('.txt'):
                evidence.append({'name': name.replace('\\', '/').split('/')[-1], 'sha256': sha(z.read(name))})
    if chain['errors']:
        raise ValueError('Conflicting schema evidence')
    actor = next(a for a in chain['actors'] if a['guid'] == GUID)
    # Link prefab -> SkeletonAnimation -> SkeletonData -> exact TextAsset identity.
    def metadata(typ, id):
        path = f'rpg-assets/metadata/model/{typ}.zip'
        raw = subprocess.check_output(['git', 'show', f'{ASSET_REV}:{path}'], cwd=ROOT)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            name = f'{CAB}/{id}.json'
            raw = z.read(name)
            evidence.append({'name': f'{ASSET_REV}:{path}!{name}', 'sha256': sha(raw)})
            return json.loads(raw)['tree']
    go = metadata('GameObject', '768041873079057063')
    skeleton_component = metadata('MonoBehaviour', '7164544061370055335')
    skeleton_data = metadata('MonoBehaviour', '5623481548197092486')
    assert go['m_Name'] == 'Hero_Axe01'
    assert any(str(c['component']['m_PathID']) == '7164544061370055335' for c in go['m_Component'])
    assert str(skeleton_component['skeletonDataAsset']['m_PathID']) == '5623481548197092486'
    assert str(skeleton_data['skeletonJSON']['m_PathID']) == '-5641566546299852505'
    manifest = json.loads((ROOT / 'public/rpg/asset-manifest.json').read_text())
    asset = next(a for a in manifest if a['file'] == 'Hero_Axe01.json')
    assert asset['object_id'] == '-5641566546299852505'
    skeleton_raw = (ROOT / 'public/rpg/Hero_Axe01.json').read_bytes()
    assert sha(skeleton_raw) == asset['sha256']
    skeleton = json.loads(skeleton_raw)
    # Strings are corroborating evidence only: raw Addressables resource-location relation is absent.
    with zipfile.ZipFile(handoff_path) as z:
        name = next(n for n in z.namelist() if n.endswith('Vardian_Remaining_Assets_And_Loader_Audit.zip'))
        with zipfile.ZipFile(io.BytesIO(z.read(name))) as sub:
            raw = sub.read('catalog_strings.csv')
            lines = raw.decode('utf-8-sig').splitlines()
            i = next(i for i, l in enumerate(lines) if l.endswith(',' + GUID))
            assert 'Hero_Axe01.prefab' in lines[i + 1]
            evidence.append({'name': 'catalog_strings.csv', 'sha256': sha(raw),
                             'guidLine': i + 1, 'nextLine': lines[i + 1]})
    combat, combat_hash = read_balance(balance_path, 'CombatData.bytes')
    actors, actor_hash = read_balance(balance_path, 'ActorData.bytes')
    _, action_hash = read_balance(balance_path, 'ActionData.bytes')
    if chain['sources']['ActorData.sha256'] != actor_hash or chain['sources']['ActionData.sha256'] != action_hash:
        raise ValueError('Balance/trace version mismatch')
    ct = combat.read('I', 0)
    native = {k: combat.value(ct, slot, fmt) for k, slot, fmt in [
        ('useRush',68,'B'),('rushMin',70,'f'),('rushMax',72,'f'),('rushSpeed',74,'f'),
        ('minAttackDelay',46,'f'),('comboDelay',48,'f'),('avoidDuration',66,'f'),('avoidCooldown',60,'f')]}
    stages = []
    for index, skill in enumerate(actor['skills']):
        if len(skill['actions']) != 1:
            raise ValueError('Ambiguous skill action')
        action = skill['actions'][0]
        children = action['children']
        motions = children['ActionMotionData']
        if len(motions) != 1:
            raise ValueError('Multiple motion actions require explicit sequence support')
        motion = motions[0]['fields']
        state = motion['AnimState']
        # Explicit web adapter, NOT recovered enum mapping. Both native state and adapter retained.
        animation = f'attack{index + 1}'
        if animation not in skeleton['animations'] or state != index + 11:
            raise ValueError('Axe stage/animation adapter no longer matches reviewed evidence')
        events = []
        for event in children['ActionBasicData']:
            b = event['fields']
            if b['Type'] != 33 or b.get('Mute') or b.get('Dev'):
                continue
            if b.get('ConditionTarget') is not None or b.get('Condition') is not None:
                raise ValueError('Conditional impactor needs a condition interpreter')
            idx = b['DataIdx'] if b['DataIdx'] is not None else 0
            impactor = children['ActionImpactorData'][idx]['fields']
            if b['DataId'] != impactor['DataId'] or b['Time'] is None:
                raise ValueError('Impactor index/id/time mismatch')
            events.append({'at': round(b['Time'], 6), 'dataId': b['DataId'], 'dataIdx': idx,
                           'movingHitCount': impactor['MovingHitCount'],
                           'colliderWidth': impactor['ColliderWidth'], 'colliderHeight': impactor['ColliderHeight']})
        if len(events) != 1:
            raise ValueError('Adapter currently requires one impactor activation per attack')
        # Damage at activation is a web contact approximation; count is not repeat hits on same enemy.
        stages.append({'skillType': skill['skillType'], 'animationState': state, 'animation': animation,
                       'animationMapping': 'EXPLICIT_WEB_ADAPTER_ENUM_NOT_RECOVERED',
                       'duration': round(action['holdTime'], 6), 'hitAt': events[0]['at'],
                       'damage': 30 if index == 4 else 20, 'impactorActivations': events})
    native_dir = ROOT.parent / 'rpg-handoff-source/extracted/Vardian_Bulk_Combat_Audit/Vardian_Bulk_Combat_Audit/code'
    for name in ['CombatActorManager__RunAction__T6004476.txt',
                 'CombatActorManager__ProcessActions__T6004475.txt',
                 'CombatActorManager__GetActionDuration__T6004485.txt',
                 'CombatActorManager__RunActionImpactor__T6004498.txt']:
        evidence.append({'name': name, 'sha256': sha((native_dir / name).read_bytes())})
    return {'format': 1, 'actorType': actor['actorType'], 'actorGuid': GUID,
            'asset': 'Hero_Axe01', 'assetSha256': sha(skeleton_raw),
            'guidLinkStatus': 'CATALOG_ADJACENCY_CORROBORATED_NOT_RESOURCE_LOCATION_PROOF',
            'prefabSkeletonLinkStatus': 'OBJECT_REFERENCES_VERIFIED',
            'native': native, 'combo': stages, 'sources': evidence,
            'traceSha256': sha(chain_raw), 'combatDataSha256': combat_hash,
            'limitations': ['Native AnimationState enum-to-name lookup not recovered; web mapping is explicit.',
                'Axe GUID association is catalog adjacency; raw Addressables resource-location proof unavailable.',
                'Impactor activation times verified from data/dispatch, damage uses one-target contact approximation.',
                'Full five-stage loadout is a prototype choice; mastery unlocks not restored.',
                'Damage, skill cooldowns, world-pixel scale and collision shapes remain prototype values.',
                'Native code and data captures have different address ranges; semantic evidence, not ABI reproduction.']}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--chain', type=Path, required=True)
    p.add_argument('--balance', type=Path, required=True)
    p.add_argument('--handoff', type=Path, required=True)
    a = p.parse_args()
    result = build(a.chain, a.balance, a.handoff)
    dest = ROOT / 'src/components/rpg/combat-profile.json'
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'COMBAT_PROFILE_GENERATED stages={len(result["combo"])}')
