#!/usr/bin/env python3
"""Offline, read-only inventory of balance FlatBuffers and exact ISIL evidence.

Without a version-matched schema, offsets remain offsets: no invented XP/cost fields.
Uses only Python standard library and the existing bounded FlatBuffer reader.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from trace_combat_chain import Buffer, MAX_FILE, parse_schema

PRIORITY = ['TeamData.bytes', 'MaterialData.bytes', 'WeaponData.bytes',
            'ArmorData.bytes', 'GearData.bytes', 'MonsterData.bytes',
            'StageData.bytes', 'HuntingData.bytes', 'UnlockData.bytes',
            'SkillData.bytes', 'MasteryData.bytes']


def table_layout(buffer, table):
    vt = table - buffer.read('i', table)
    size = buffer.read('H', vt)
    if size < 4 or size > 2048 or size % 2:
        raise ValueError('Invalid vtable size')
    buffer.field(table, 4)  # validates vtable and object bounds
    return [slot for slot in range(4, size, 2) if buffer.field(table, slot) is not None]


def inspect_file(path):
    if path.stat().st_size > MAX_FILE:
        raise ValueError('File exceeds safe parser size; retained but not parsed')
    raw = path.read_bytes()
    b = Buffer(raw)
    root = b.read('I', 0)
    fields = table_layout(b, root)
    record = {'file': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
              'format': 'flatbuffers-layout-valid', 'rootOffset': root,
              'semanticStatus': 'UNRESOLVED_WITHOUT_MATCHED_SCHEMA', 'fields': []}
    for slot in fields:
        pos = b.field(root, slot)
        item = {'vtableSlot': slot, 'offset': pos, 'rawPrefixHex': raw[pos:pos+4].hex()}
        # Probe only; a successful structural probe is NOT a field/type assignment.
        try:
            rows = b.vector(root, slot)
            if not rows:
                raise ValueError('Empty vector is structurally ambiguous')
            for table in rows:
                table_layout(b, table)
            item['candidateTableVector'] = {'count': len(rows), 'sampleOffsets': rows[:5],
                                            'meaning': 'UNKNOWN'}
        except (ValueError, OverflowError):
            pass
        record['fields'].append(item)
    return record


def schema_evidence(root):
    evidence, signatures, conflicts = [], {}, set()
    if root is None:
        return evidence, []
    for count, path in enumerate(root.rglob('*')):
        if count > 25000:
            raise ValueError('Schema scan limit reached; use the InHouse.Balance.Runtime folder')
        if not path.is_file() or path.is_symlink() or path.suffix.lower() not in ('.txt', '.cs'):
            continue
        if path.stat().st_size > MAX_FILE:
            continue
        text = path.read_text(encoding='utf-8-sig', errors='replace')
        parsed = parse_schema(text)
        if not parsed:
            continue
        typename, fields = parsed
        if not fields:
            continue
        signature = json.dumps(fields, sort_keys=True)
        if typename in signatures and signatures[typename] != signature:
            conflicts.add(typename)
        signatures[typename] = signature
        evidence.append({'source': str(path.relative_to(root)), 'type': typename,
                         'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                         'scalarAccessors': fields,
                         'scope': 'ISIL_ACCESSORS_ONLY; VECTORS_AND_DEFAULTS_NOT_RESTORED'})
    return evidence, sorted(conflicts)


def audit(balance, schemas=None):
    if not balance.is_dir():
        raise ValueError('Balance directory not found')
    if schemas is not None and not schemas.is_dir():
        raise ValueError('Schema directory not found')
    records = []
    names = set()
    for path in sorted(balance.glob('*.bytes')):
        if path.is_symlink():
            continue
        names.add(path.name)
        try:
            records.append(inspect_file(path))
        except (ValueError, OverflowError) as error:
            records.append({'file': path.name, 'format': 'NOT_DECODED', 'error': str(error)})
    evidence, conflicts = schema_evidence(schemas)
    if not records:
        raise ValueError('No .bytes files found; no DB was inspected')
    return {'version': 1, 'readOnly': True, 'status': 'PARTIAL_STRUCTURAL_RECOVERY',
            'files': records, 'missingPriorityFiles': [n for n in PRIORITY if n not in names],
            'schemaEvidence': evidence, 'conflictingSchemaTypes': conflicts,
            'limitations': ['No field meanings are inferred from numerical values.',
                            'No zero defaults are inferred from missing FlatBuffer fields.',
                            'No source-build match is implied by matching type names.',
                            'No server database, XP curve, upgrade cost or reward table is reconstructed yet.']}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--balance', type=Path, required=True)
    p.add_argument('--schemas', type=Path)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.output.exists():
        p.error('Output already exists; choose a new file to preserve evidence')
    report = audit(args.balance, args.schemas)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"PARTIAL_RECOVERY files={len(report['files'])} schemas={len(report['schemaEvidence'])} output={args.output}")


if __name__ == '__main__':
    main()
