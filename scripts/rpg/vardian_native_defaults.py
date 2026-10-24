"""Optional capstone/pyelftools pass proving simple floating getter defaults."""
import hashlib
import re
from pathlib import Path


def enrich_defaults(schemas, source, native):
    from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM
    from elftools.elf.elffile import ELFFile
    raw = native.read_bytes()
    native_hash=hashlib.sha256(raw).hexdigest()
    if native_hash!='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5':
        raise ValueError('Default recovery supports only the audited native build hash')
    with native.open('rb') as stream:
        elf = ELFFile(stream)
        if elf['e_machine'] != 'EM_AARCH64':
            raise ValueError('Expected ARM64 native library')
        segments = [dict(s.header) for s in elf.iter_segments() if s['p_type']=='PT_LOAD']
    def read(address, count):
        for seg in segments:
            if seg['p_vaddr'] <= address and address+count <= seg['p_vaddr']+seg['p_filesz']:
                offset=address-seg['p_vaddr']+seg['p_offset']
                return raw[offset:offset+count]
        raise ValueError('Native address outside load segments')
    engine=Cs(CS_ARCH_ARM64,CS_MODE_ARM)
    proofs=[]
    for schema in schemas.values():
        text=(source/schema['source']).read_text(encoding='utf-8-sig')
        blocks={b.splitlines()[0]:b for b in re.split(r'\nMethod: ',text)[1:]}
        for field in schema['fields']:
            if field['kind']!='scalar' or field.get('vector') or field.get('fmt') not in ('f','d'):
                continue
            block=blocks[field['method']]
            match=re.search(r'Disassembly:\s+0x([0-9a-fA-F]+)',block)
            if not match:continue
            address=int(match[1],16)
            ins=list(engine.disasm(read(address,160),address))
            branch=None
            for i,op in enumerate(ins):
                if op.mnemonic=='ret':break
                if op.mnemonic=='cbz' and op.op_str.startswith('w0,'):
                    # Slot setup must agree with the independently parsed ISIL.
                    slots=[p.op_str for p in ins[:i] if p.mnemonic=='mov' and p.op_str.startswith('w1, #')]
                    if slots and int(slots[-1].split('#')[1],0)==field['slot']:
                        branch=int(op.op_str.split('#')[1],16)
                    break
            if branch is None:continue
            value=None
            for op in engine.disasm(read(branch,64),branch):
                if op.mnemonic=='movi' and op.op_str.startswith(('d0,','v0.')) and op.op_str.split('#')[-1].strip('0x ')=='':
                    value=0.0
                elif op.mnemonic=='fmov' and op.op_str.startswith(('s0, #','d0, #')):
                    value=float(op.op_str.split('#')[1])
                elif op.mnemonic in ('ldp','ldr','add') and ('sp' in op.op_str) and not op.op_str.startswith(('s0,','d0,','q0,','v0')):
                    pass
                elif op.mnemonic=='ret':
                    if value is not None:
                        proof={'value':value,'evidence':'ARM64_SLOT_MATCH_AND_CONSTANT_RETURN',
                               'methodVA':hex(address),'defaultBranchVA':hex(branch)}
                        field['provenDefault']=proof
                        proofs.append({'source':schema['source'],'field':field['name'],**proof})
                    break
                else:break
    return {'nativeSha256':native_hash,'floatingDefaultProofs':proofs}
