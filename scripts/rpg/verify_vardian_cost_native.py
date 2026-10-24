"""Compare offline arithmetic with supplied ARM64 instructions in Unicorn.

Dependencies: capstone pyelftools unicorn. Never executes Android startup/network.
Only BigIntData's constructor is hooked, after checking its FRINTM instruction.
"""
import argparse
import hashlib
import json
import random
import struct
from pathlib import Path

from vardian_cost import calc_segment, rounded

EXPECTED = '42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'


def verify(native):
    from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM
    from elftools.elf.elffile import ELFFile
    from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
    from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X30, UC_ARM64_REG_SP, UC_ARM64_REG_PC, UC_ARM64_REG_D0, UC_ARM64_REG_CPACR_EL1
    raw=native.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=EXPECTED:
        raise ValueError('Native verifier supports only the audited build hash')
    with native.open('rb') as stream:
        elf=ELFFile(stream)
        seg=next(s for s in elf.iter_segments() if s['p_type']=='PT_LOAD' and s['p_vaddr']<=0x6b5d000<s['p_vaddr']+s['p_filesz'])
        offset=0x6b5d000-seg['p_vaddr']+seg['p_offset']
    code=raw[offset:offset+0x1000]
    ins=list(Cs(CS_ARCH_ARM64,CS_MODE_ARM).disasm(code[0xa78:0xa7c],0x6b5da78))
    if len(ins)!=1 or (ins[0].mnemonic,ins[0].op_str)!=('frintm','d0, d8'):
        raise ValueError('Constructor rounding evidence changed')
    rng=random.Random(1211)
    cases=[]
    for minimum,maximum in [(1,50),(50,100)]:
        for level in [minimum-1,minimum,minimum+1,maximum-1,maximum]:
            cases.append((minimum,maximum,1000.,100.,7000.,1000.,level))
    for _ in range(200):
        cases.append((1,100,rng.uniform(0,10000),rng.uniform(0,200),rng.uniform(0,9000),rng.choice([0.,1.,3.,1000.,1001.]),rng.randint(0,101)))
    for minimum,maximum,base,inc,rate,scaler,level in cases:
        u=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
        u.mem_map(0x6b5d000,0x1000);u.mem_write(0x6b5d000,code)
        u.mem_map(0x100000,0x10000)
        u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20)
        u.reg_write(UC_ARM64_REG_SP,0x10f000)
        u.mem_write(0x100000,struct.pack('<ii4d',minimum,maximum,base,inc,rate,scaler))
        u.reg_write(UC_ARM64_REG_X0,0x100000);u.reg_write(UC_ARM64_REG_X1,level&0xffffffff)
        u.reg_write(UC_ARM64_REG_X30,0x100800)
        def hook(emu,address,size,data):
            if address==0x6b5da2c:
                value=struct.unpack('<d',struct.pack('<Q',emu.reg_read(UC_ARM64_REG_D0)))[0]
                result=struct.pack('<d',rounded(value))
                emu.mem_write(emu.reg_read(UC_ARM64_REG_X0),result)
                emu.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',result)[0])
                emu.reg_write(UC_ARM64_REG_PC,emu.reg_read(UC_ARM64_REG_X30))
        u.hook_add(UC_HOOK_CODE,hook,begin=0x6b5da2c,end=0x6b5da2c)
        u.emu_start(0x6b5d82c,0x100800,timeout=100000,count=2000)
        if u.reg_read(UC_ARM64_REG_PC)!=0x100800:
            raise ValueError('Native emulation did not finish')
        actual=struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0)))[0]
        segment={'MinLevel':minimum,'MaxLevel':maximum,**{k:{'Value':v} for k,v in zip(('BaseValue','IncValue','IncRate','Scaler'),(base,inc,rate,scaler))}}
        expected=calc_segment(segment,level)
        if actual!=expected:
            raise ValueError(f'Native mismatch: {actual} != {expected}, {segment}, level {level}')
    return {'casesPassed':len(cases),'nativeSha256':EXPECTED,'scope':'single segment arithmetic; constructor floor hooked; field layout supplied as audited offsets'}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--native',required=True,type=Path)
    args=p.parse_args()
    print(json.dumps(verify(args.native)))
