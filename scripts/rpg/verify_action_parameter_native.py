"""Execute the original action-parameter selector without function hooks."""
import argparse,hashlib,json,struct
from elftools.elf.elffile import ELFFile
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM
from unicorn.arm64_const import UC_ARM64_REG_CPACR_EL1,UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X30,UC_ARM64_REG_S0
from recover_combat_gaps import action_parameter
p=argparse.ArgumentParser();p.add_argument('--native',required=True);p.add_argument('--output',required=True);a=p.parse_args()
raw=open(a.native,'rb').read();digest=hashlib.sha256(raw).hexdigest()
assert digest=='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
with open(a.native,'rb') as f: segment=next(s for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD' and s['p_vaddr']<=0x6b64a98<s['p_vaddr']+s['p_filesz']);offset=segment['p_offset']+0x6b64000-segment['p_vaddr']
u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);u.mem_map(0x6b64000,4096);u.mem_write(0x6b64000,raw[offset:offset+4096]);u.mem_map(0x100000,8192);u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20)
params=[1.25,-2.5,0,123.5,4,5,6,7,8];u.mem_write(0x100000,struct.pack('<9f',*params));cases=0
for kind in range(256):
 for literal in [-50.,0.,100.,1.25]:
  u.reg_write(UC_ARM64_REG_X0,0x100000);u.reg_write(UC_ARM64_REG_X1,kind);u.reg_write(UC_ARM64_REG_X30,0x101000);u.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',literal))[0]);u.emu_start(0x6b64a98,0x101000,count=100)
  actual=struct.unpack('<f',struct.pack('<I',u.reg_read(UC_ARM64_REG_S0)))[0]
  assert actual==action_parameter(kind,literal,params),(kind,literal,actual)
  cases+=1
result={'cases':cases,'nativeSha256':digest,'nativeAddress':'0x6b64a98','sourceBuildAddress':'0x6c64a98','hooks':[], 'scope':'ActionParamType selector, not full effect application'}
open(a.output,'w').write(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
