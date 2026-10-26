"""Independent ARM64 validation of SetBossFlag; no stubs or random gameplay."""
import argparse,hashlib,json,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM
from unicorn.arm64_const import *
from reference_monsters import boss_flags


def verify(native,output):
    raw=native.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    if digest!='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5':raise ValueError('Native hash mismatch')
    with native.open('rb') as f:
        elf=ELFFile(f);s=next(s for s in elf.iter_segments() if s['p_type']=='PT_LOAD' and s['p_vaddr']<=0x3c4f000<s['p_vaddr']+s['p_filesz']);off=0x3c4f000-s['p_vaddr']+s['p_offset']
    u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);u.mem_map(0x3c4f000,4096);u.mem_write(0x3c4f000,raw[off:off+4096]);u.mem_map(0x100000,4096);count=0
    for base in [0,1,0xffff,1<<17,1<<19,0x1f0000000,0xffffffffffffffff]:
        for invoker in range(32):
            for target in range(32):
                for reg,val in [(UC_ARM64_REG_X0,base),(UC_ARM64_REG_X1,invoker),(UC_ARM64_REG_X2,target),(UC_ARM64_REG_X30,0x100000)]:u.reg_write(reg,val)
                u.emu_start(0x3c4f244,0x100000,count=100)
                assert u.reg_read(UC_ARM64_REG_PC)==0x100000
                expected=boss_flags(base,invoker,target);actual=u.reg_read(UC_ARM64_REG_X0)
                if actual!=expected:raise AssertionError((base,invoker,target,actual,expected))
                count+=1
    r={'nativeSha256':digest,'cases':count,'scope':'SetBossFlag exact ARM64; OR preserves existing bits, Boss takes precedence over Mob per actor','hooks':[]};output.write_text(json.dumps(r,indent=2));return r

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(verify(a.native,a.output)))
