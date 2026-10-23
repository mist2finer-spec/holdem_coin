#!/usr/bin/env python3
"""Read-only Vardian Actor GUID -> SkillType -> action child tables tracer (Python 3.9+)."""
import argparse
import hashlib
import json
import math
import re
import struct
import zipfile
from collections import defaultdict
from pathlib import Path

MAX_FILE = 16 * 1024 * 1024
WANTED = {'ActionMotionData', 'ActionImpactorData', 'ActionBasicData',
          'ActionDashData', 'ActionMoveData'}
SKIP = {'.git', 'node_modules', '__pycache__', '.venv'}


class Buffer:
    def __init__(self, raw):
        if len(raw) > MAX_FILE:
            raise ValueError('Balance file exceeds limit')
        self.raw = raw

    def read(self, fmt, pos):
        size = struct.calcsize('<' + fmt)
        if pos < 0 or pos + size > len(self.raw):
            raise ValueError('FlatBuffer read outside file')
        value = struct.unpack_from('<' + fmt, self.raw, pos)[0]
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError('Non-finite scalar')
        return value

    def field(self, table, slot):
        vt = table - self.read('i', table)  # signed: shared vtables can follow objects
        length = self.read('H', vt)
        size = self.read('H', vt + 2)
        if length < 4 or length % 2 or size < 4:
            raise ValueError('Invalid table header')
        self.read('B', vt + length - 1)
        self.read('B', table + size - 1)
        offset = self.read('H', vt + slot) if slot < length else 0
        if offset and not 4 <= offset < size:
            raise ValueError('Invalid field offset')
        return table + offset if offset else None

    def string(self, pos):
        target = pos + self.read('I', pos)
        length = self.read('I', target)
        if length > 1024 * 1024:
            raise ValueError('String too large')
        self.read('B', target + 4 + length)  # FlatBuffers string terminator
        return self.raw[target + 4:target + 4 + length].decode('utf-8')

    def vector(self, table, slot, fmt=None):
        pos = self.field(table, slot)
        if pos is None:
            return []
        target = pos + self.read('I', pos)
        count = self.read('I', target)
        if count > 10000:
            raise ValueError('Vector too large')
        stride = struct.calcsize('<' + fmt) if fmt else 4
        if count:
            self.read('B', target + 4 + count * stride - 1)
        items = [target + 4 + i * stride for i in range(count)]
        return [self.read(fmt, p) if fmt else p + self.read('I', p) for p in items]

    def value(self, table, slot, kind):
        pos = self.field(table, slot)
        return None if pos is None else self.string(pos) if kind == 'str' else self.read(kind, pos)

    def records(self):
        return self.vector(self.read('I', 0), 4)


def read_balance(source, filename):
    if source.is_dir():
        matches = list(source.rglob(filename))
        if len(matches) != 1:
            raise ValueError(f'Expected one {filename}, found {len(matches)}')
        raw = matches[0].read_bytes()
    else:
        with zipfile.ZipFile(source) as z:
            names = [n for n in z.namelist() if Path(n).name == filename]
            if len(names) != 1 or z.getinfo(names[0]).file_size > MAX_FILE:
                raise ValueError(f'Missing, duplicate or oversized {filename}')
            raw = z.read(names[0])
    return Buffer(raw), hashlib.sha256(raw).hexdigest()


def parse_schema(text):
    """Use ISIL accessor evidence only, never mismatched Disassembly addresses/defaults."""
    type_match = re.search(r'^Type: BalanceData\.(\w+)\s*$', text, re.M)
    if not type_match or type_match[1] not in WANTED:
        return None
    fields = []
    formats = {'GetFloat': 'f', 'GetDouble': 'd', 'GetInt': 'i',
               'GetUint': 'I', 'GetShort': 'h', 'GetUshort': 'H',
               'GetLong': 'q', 'GetUlong': 'Q', 'Get': 'B'}
    for block in re.split(r'\nMethod: ', text)[1:]:
        header = block.splitlines()[0]
        getter = re.search(r' (?:get_)?(\w+)\(\)', header)
        if not getter or 'ISIL:' not in block:
            continue
        isil = block.split('ISIL:', 1)[1]
        before_offset = isil.split('Call Table.__offset', 1)[0] if 'Call Table.__offset' in isil else ''
        slots = re.findall(r'Move W1, (\d+)\b', before_offset)
        slot = int(slots[-1]) if slots else None
        if not slot or 'Table.__vector' in isil:
            continue
        scalar = re.search(r'Call ByteBuffer\.(Get\w*)\b', isil)
        kind = 'str' if 'Call Table.__string' in isil else formats.get(scalar[1]) if scalar else None
        if kind:
            fields.append({'name': getter[1], 'slot': slot, 'kind': kind})
    return type_match[1], fields


def find_schemas(root):
    schemas, sources, errors = {}, [], []
    conflicts = set()
    if root is None:
        return schemas, sources, errors
    if not root.is_dir():
        raise ValueError('Schema root does not exist or is not a directory')
    import os
    visited = 0
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in SKIP
                          and not (Path(folder) / d).is_symlink()
                          and not getattr(Path(folder) / d, 'is_junction', lambda: False)())
        for name in sorted(files):
            visited += 1
            if visited > 100000:
                raise ValueError('Schema scan exceeds 100000 files; use a narrower --root')
            if not any(t in name for t in WANTED) or Path(name).suffix.lower() not in {'.txt', '.cs'}:
                continue
            path = Path(folder) / name
            if path.is_symlink() or path.stat().st_size > MAX_FILE:
                continue
            raw = path.read_bytes()
            result = parse_schema(raw.decode('utf-8-sig', errors='replace'))
            if not result:
                continue
            typename, fields = result
            if typename in conflicts:
                pass
            elif typename in schemas and schemas[typename] != fields:
                conflicts.add(typename)
                errors.append(f'Conflicting schema: {typename}; refusing to select a version')
                schemas[typename] = []
            else:
                schemas[typename] = fields
            sources.append({'path': str(path), 'type': typename, 'sha256': hashlib.sha256(raw).hexdigest(),
                            'fields': fields})
    return schemas, sources, errors


def decode_child(buffer, table, typename, schemas):
    fields = schemas.get(typename, [])
    result = {'tableOffset': table, 'schema': typename,
              'status': 'SUPPORTED_SCALAR_ACCESSORS_DECODED' if fields else 'MISSING_SCHEMA', 'fields': {}}
    for field in fields:
        result['fields'][field['name']] = buffer.value(table, field['slot'], field['kind'])
    # A configured start/delay is not necessarily the instant a moving impactor hits.
    result['timingCandidates'] = {k: v for k, v in result['fields'].items()
                                  if re.search(r'time|delay|duration', k, re.I) and isinstance(v, (int, float))}
    return result


def animation_clips(path):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    def times(node):
        if isinstance(node, dict):
            if isinstance(node.get('time'), (int, float)):
                yield node['time']
            for value in node.values():
                yield from times(value)
        elif isinstance(node, list):
            for value in node:
                yield from times(value)
    return {name: {'duration': max(times(anim), default=0), 'events': anim.get('events', [])}
            for name, anim in data.get('animations', {}).items()}


def trace(balance, root=None, guid=None, asset_map=None):
    actors, ahash = read_balance(balance, 'ActorData.bytes')
    actions, shash = read_balance(balance, 'ActionData.bytes')
    schemas, sources, errors = find_schemas(root)
    action_index = defaultdict(list)
    for table in actions.records():
        action_index[actions.value(table, 8, 'H')].append(table)
    mapping = json.loads(asset_map.read_text(encoding='utf-8-sig')) if asset_map else {}
    report = {'format': 1, 'status': 'PARTIAL', 'sources': {'ActorData.sha256': ahash,
              'ActionData.sha256': shash}, 'schemaSources': sources, 'actors': [], 'errors': errors,
              'missingSchemas': sorted(WANTED - {k for k, v in schemas.items() if v}),
              'notice': 'Absent fields are null, not assumed zero. Skill order is data order, not unlocked combo order. '
                        'Timing candidates are config values, not verified damage times. No runtime or game files modified.'}
    for table in actors.records():
        actor_guid = actors.value(table, 6, 'str')
        if guid and (actor_guid or '').lower() != guid.lower():
            continue
        actor = {'actorType': actors.value(table, 4, 'H'), 'guid': actor_guid, 'skills': []}
        clips = {}
        if actor_guid in mapping:
            spine = Path(mapping[actor_guid])
            if not spine.is_absolute():
                spine = asset_map.parent / spine
            clips = animation_clips(spine)
            actor['animationSource'] = str(spine)
            actor['animationSourceSha256'] = hashlib.sha256(spine.read_bytes()).hexdigest()
        for skill in actors.vector(table, 28, 'H'):
            entry = {'skillType': skill, 'actions': [], 'status': 'ACTION_FOUND' if skill in action_index else 'MISSING_ACTION'}
            for action in action_index.get(skill, []):  # Preserve multiple actions per SkillType.
                item = {'tableOffset': action, 'assetGuid': actions.value(action, 4, 'str'),
                        'alias': actions.value(action, 12, 'str'), 'holdTime': actions.value(action, 16, 'f'),
                        'approachDistance': actions.value(action, 30, 'f'), 'children': {}}
                for slot, typename in [(40, 'ActionBasicData'), (42, 'ActionMotionData'),
                                      (44, 'ActionDashData'), (46, 'ActionMoveData'), (48, 'ActionImpactorData')]:
                    children = [decode_child(actions, child, typename, schemas)
                                for child in actions.vector(action, slot)]
                    for child in children:
                        child['exactClipMatches'] = {v: clips[v] for v in child['fields'].values()
                                                     if isinstance(v, str) and v in clips} if typename == 'ActionMotionData' else {}
                    item['children'][typename] = children
                item['verifiedDamageTime'] = None  # Requires runtime scheduling/collision semantics too.
                entry['actions'].append(item)
            actor['skills'].append(entry)
        report['actors'].append(actor)
    if not report['actors']:
        raise ValueError('No actor matches the supplied GUID')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--balance', type=Path, required=True, help='Data directory or balance ZIP')
    parser.add_argument('--root', type=Path, help='ISIL directory, e.g. VardianRE/reports')
    parser.add_argument('--guid', help='Exact ActorData AssetGuid; omit to trace all actors')
    parser.add_argument('--asset-map', type=Path, help='JSON object: actor GUID -> Spine JSON path (relative to map)')
    parser.add_argument('--output', type=Path, required=True, help='New output directory')
    args = parser.parse_args()
    report = trace(args.balance, args.root, args.guid, args.asset_map)
    args.output.mkdir(parents=True, exist_ok=False)
    schema_dir = args.output / 'schema-evidence'
    schema_dir.mkdir()
    for index, source in enumerate(report['schemaSources']):
        raw = Path(source['path']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError('Schema changed during trace')
        (schema_dir / f"{index:03d}-{source['type']}.txt").write_bytes(raw)
    (args.output / 'combat-chain.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    instructions = '\n'.join(f'- {name}.txt (Type: BalanceData.{name}, including ISIL getters)' for name in report['missingSchemas'])
    (args.output / 'NEEDED.txt').write_text('Missing schema files:\n' + (instructions or '(none)') +
        '\n\nAsset map: actor GUID -> exact Spine JSON path. Do not infer this from character names.\n'
        'Damage time also needs RunActionMotion/RunActionImpactor scheduling and collision behavior.\n'
        'SkillTypes include mastery-dependent attacks; this report does not assume all are unlocked.\n', encoding='utf-8')
    print(f"TRACE_WRITTEN actors={len(report['actors'])} missingSchemas={len(report['missingSchemas'])} output={args.output}")


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, struct.error) as exc:
        raise SystemExit(f'TRACE_FAILED: {exc}')
