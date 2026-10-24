#!/usr/bin/env python3
"""Recover PRESENT FlatBuffer values using exact ISIL accessor schema evidence.

Absent defaults and unsupported accessors remain explicit, never guessed from stubs.
"""
import argparse
import hashlib
import json
import re
import struct
import math
from pathlib import Path
from trace_combat_chain import Buffer, MAX_FILE

FORMATS = {'GetDouble':'d','GetFloat':'f','GetInt':'i','GetUint':'I',
           'GetShort':'h','GetUshort':'H','GetLong':'q','GetUlong':'Q',
           'GetSbyte':'b','Get':'B'}


class RecoveryBuffer(Buffer):
    """Permit large quest vectors only after validating their complete span."""
    def vector(self, table, slot, fmt=None):
        pos = self.field(table, slot)
        if pos is None:
            return []
        target = pos + self.read('I', pos)
        count = self.read('I', target)
        stride = struct.calcsize('<' + fmt) if fmt else 4
        if count > 50000:
            raise ValueError('Vector exceeds 50000 entries')
        if count:
            self.read('B', target + 4 + count * stride - 1)
        positions = range(target + 4, target + 4 + count * stride, stride)
        return [self.read(fmt, p) if fmt else p + self.read('I', p) for p in positions]


def integer_default(isil):
    """Prove a zero-offset return path; reject unimplemented or complex paths."""
    branch = re.search(r'Compare W0, 0\s+\d+ JumpIfEqual \{(\d+)\}', isil)
    if not branch:
        return None
    instructions = dict(re.findall(r'^\s*(\d+) (.+)$', isil, re.M))
    pc, value = int(branch[1]), 0  # __offset was compared equal to zero
    for _ in range(12):
        op = instructions.get(f'{pc:03}', '').strip()
        if op == 'Return X0':
            return {'value': value, 'evidence': 'ISIL_ZERO_OFFSET_INTEGER_RETURN', 'branch': int(branch[1])}
        assignment = re.fullmatch(r'Move [WX]0, (-?\d+|[WX]31)', op)
        if assignment:
            value = 0 if assignment[1] in ('W31', 'X31') else int(assignment[1])
        elif not re.fullmatch(r'Move X(?:19|20|21|22|23|24|25|26|27|28|29|30), \[X31\+\d+\]', op):
            return None
        pc += 1
    return None


def parse_type(text):
    match = re.search(r'^Type: BalanceData\.(\w+)\s*$', text, re.M)
    if not match:
        return None
    fields, roots = {}, []
    for block in re.split(r'\nMethod: ', text)[1:]:
        header = block.splitlines()[0]
        if 'GetRootAs' + match[1] + '(' in header:
            roots.append(header)
        method = re.match(r'(.+?) (\w+)\((.*?)\)', header)
        if not method or 'ISIL:' not in block:
            continue
        return_type, name, args = method.groups()
        isil = block.split('ISIL:', 1)[1]
        if 'Call Table.__offset' not in isil or 'Call Table.__vector_len' in isil:
            continue
        slots = re.findall(r'Move W1, (\d+)\b', isil.split('Call Table.__offset', 1)[0])
        if not slots or int(slots[-1]) < 4 or int(slots[-1]) % 2:
            continue
        vector = 'Call Table.__vector,' in isil
        if vector and args != 'System.Int32 j':
            continue
        if not vector and args:
            continue
        f = {'name': name.removeprefix('get_'), 'slot': int(slots[-1]),
             'returnType': return_type, 'vector': vector, 'method': header}
        readers = re.findall(r'Call ByteBuffer\.(Get\w*)\b', isil)
        children = re.findall(r'Call (\w+)\.__assign', isil)
        if children and 'Call Table.__indirect' in isil and len(set(children)) == 1:
            f.update(kind='table', child=children[0])
        elif 'Call Table.__string' in isil and return_type == 'System.String':
            f.update(kind='string')
        elif len(set(readers)) == 1 and readers[0] in FORMATS:
            f.update(kind='scalar', fmt=FORMATS[readers[0]], boolean=return_type=='System.Boolean')
            if f['fmt'] not in ('d', 'f') and not vector:
                default = integer_default(isil)
                if default is not None:
                    f['provenDefault'] = default
        else:
            continue
        if f['slot'] in fields and fields[f['slot']] != f:
            raise ValueError(f'Contradictory accessors in {match[1]}, slot {f["slot"]}')
        fields[f['slot']] = f
    return match[1], {'rootMethods': roots, 'fields': list(fields.values())}


def load_schemas(root):
    schemas = {}
    paths = sorted(root.glob('*.txt'))
    if len(paths)>25000:
        raise ValueError('Schema file limit')
    for p in paths:
        if p.stat().st_size > MAX_FILE:
            raise ValueError('Schema file too large')
        raw=p.read_bytes()
        parsed=parse_type(raw.decode('utf-8-sig'))
        if not parsed:
            continue
        name, schema=parsed
        if name in schemas:
            raise ValueError(f'Duplicate schema type: {name}')
        schema.update(source=p.name, sha256=hashlib.sha256(raw).hexdigest())
        schemas[name]=schema
    return schemas


class Decoder:
    def __init__(self, raw, schemas):
        self.b=RecoveryBuffer(raw)
        self.schemas=schemas
        self.nodes=0

    def table(self, at, name, depth=0):
        try:
            return self._table(at, name, depth)
        except ValueError as e:
            raise ValueError(f"{name}@{at}: {e}") from e

    def _table(self, at, name, depth=0):
        if depth>24 or self.nodes>200000:
            raise ValueError('Decode depth/node limit')
        self.nodes+=1
        if name not in self.schemas:
            return {'_schema':name,'_offset':at,'_unresolved':'SCHEMA_MISSING'}
        schema=self.schemas[name]
        out={'_schema':name,'_offset':at}
        absent=[]
        resolved=[]
        known=set()
        for f in schema['fields']:
            known.add(f['slot'])
            pos=self.b.field(at,f['slot'])
            if pos is None:
                if 'provenDefault' in f:
                    value = f['provenDefault']['value']
                    out[f['name']] = bool(value) if f.get('boolean') else value
                    resolved.append(f['name'])
                else:
                    absent.append(f['name'])
                continue
            if f['vector']:
                vec=pos+self.b.read('I',pos)
                count=self.b.read('I',vec)
                if count>50000:
                    raise ValueError(f"{f['name']} vector count {count} at {vec} exceeds 50000")
                if f['kind']=='scalar':
                    values=self.b.vector(at,f['slot'],f['fmt'])
                    if f['boolean']:values=[bool(v) for v in values]
                elif f['kind']=='table':
                    values=[self.table(t,f['child'],depth+1) for t in self.b.vector(at,f['slot'])]
                else:
                    values=[self.b.string(vec+4+i*4) for i in range(count)]
                out[f['name']]=values
            elif f['kind']=='table':
                out[f['name']]=self.table(pos+self.b.read('I',pos),f['child'],depth+1)
            elif f['kind']=='string':
                out[f['name']]=self.b.string(pos)
            else:
                # Keep IEEE infinity bit patterns only for curve tangent fields.
                # No conversion to zero and no permissive non-finite game stats.
                if name == 'KeyFrameData' and f['name'] in ('InTangent','OutTangent') and f['fmt']=='f':
                    self.b.read('I',pos)
                    value=struct.unpack_from('<f',self.b.raw,pos)[0]
                    if math.isinf(value):
                        out[f['name']]={'_ieee754':'positiveInfinity' if value>0 else 'negativeInfinity',
                                         'rawLittleEndianHex':self.b.raw[pos:pos+4].hex()}
                        continue
                value=self.b.read(f['fmt'],pos)
                out[f['name']]=bool(value) if f['boolean'] else value
        if absent:out['_absentDefaultsUnresolved']=absent
        if resolved:out['_resolvedAbsentDefaults']=resolved
        vt=at-self.b.read('i',at)
        length=self.b.read('H',vt)
        if length>2048 or length<4 or length%2:
            raise ValueError('Invalid vtable')
        unknown=[slot for slot in range(4,length,2) if slot not in known and self.b.field(at,slot) is not None]
        if unknown:out['_presentUndecodedSlots']=unknown
        return out


def recover(balance, schema_root, output):
    if output.exists():raise ValueError('Output exists; preserve previous evidence')
    schemas=load_schemas(schema_root)
    output.mkdir(parents=True)
    manifest={'status':'PRESENT_VALUES_RECOVERED_DEFAULTS_PARTIAL','schemas':len(schemas),
              'files':[], 'limitations':['Only proven integer absent defaults are filled; float defaults remain unresolved.',
              'Enum values remain numeric until the enum definitions are supplied.',
              'Accessor names do not prove server-side formula execution or source-build equality.']}
    for p in sorted(balance.glob('*.bytes')):
        raw=p.read_bytes()
        name=p.name[:-6]
        typename=name+'Table'
        item={'file':p.name,'sha256':hashlib.sha256(raw).hexdigest()}
        if typename not in schemas or not schemas[typename]['rootMethods']:
            item['status']='ROOT_SCHEMA_NOT_PROVEN'
        else:
            try:
                d=Decoder(raw,schemas)
                value=d.table(d.b.read('I',0),typename)
                (output/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
                item.update(status='DECODED_PRESENT_FIELDS',rootType=typename,nodes=d.nodes)
            except (ValueError,UnicodeError,OverflowError) as e:
                item.update(status='DECODE_FAILED',error=str(e))
        manifest['files'].append(item)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (output/'schema-evidence.json').write_text(json.dumps(schemas,ensure_ascii=False,indent=2),encoding='utf-8')
    return manifest


def recover_stages(balance, schemas, output):
    """Read indexed size-prefixed records; verify each explicit stage ID."""
    index = json.loads((output/'StageData.json').read_text(encoding='utf-8'))
    raw = (balance/'StageData.pack.bytes').read_bytes()
    if len(raw) > MAX_FILE:
        raise ValueError('Stage pack too large')
    records, failures = 0, []
    with (output/'stages.jsonl').open('x', encoding='utf-8') as stream:
        for key, offsets in index.items():
            if not key.endswith('StageDataOffsets'):
                continue
            ids = index[key.replace('StageDataOffsets', 'StageIds')]
            if len(ids) != len(offsets):
                raise ValueError('Stage index length mismatch')
            for stage_id, offset in zip(ids, offsets):
                try:
                    header = Buffer(raw)
                    length = header.read('I', offset)
                    if length < 8 or offset + 4 + length > len(raw):
                        raise ValueError('Invalid stage record length')
                    d = Decoder(raw[offset+4:offset+4+length], schemas)
                    value = d.table(d.b.read('I', 0), 'StageData')
                    if 'StageId' not in value or value['StageId'] != stage_id:
                        raise ValueError('Stage ID absent or mismatches index')
                    stream.write(json.dumps({'category':key.removesuffix('StageDataOffsets'),
                        'stageId':stage_id,'packOffset':offset,'data':value}, ensure_ascii=False, allow_nan=False)+'\n')
                    records += 1
                except (ValueError, UnicodeError) as e:
                    failures.append({'stageId':stage_id,'offset':offset,'error':str(e)})
    return {'records':records,'failures':failures}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--balance',required=True,type=Path)
    p.add_argument('--schemas',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    a=p.parse_args()
    result=recover(a.balance,a.schemas,a.output)
    if (a.output/'StageData.json').exists() and (a.balance/'StageData.pack.bytes').exists():
        result['stagePackRecovery']=recover_stages(a.balance,load_schemas(a.schemas),a.output)
        (a.output/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    counts={s:sum(f['status']==s for f in result['files']) for s in sorted({f['status'] for f in result['files']})}
    print(json.dumps(counts))


if __name__=='__main__':main()
