"""Compare original ARM64 CalcTanH helpers; hook config lookup and libc tanh only."""
import argparse,hashlib,json,math,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import *
p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args();raw=args.native.read_bytes();digest=hashlib.sha256(raw).hexdigest();assert digest=='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
with args.native.open('rb') as f:loads=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
u=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for a,size in [(0x3c51000,0x1000),(0x3c54000,0x3000),(0x5aa3000,0x1000),(0x6b40000,0x1000),(0x7b82000,0x1000),(0x7fd9000,0x2000),(0x83fd000,0x1000),(0x100000,0x40000)]:
 u.mem_map(a,size);s=next((s for s in loads if s['p_vaddr']<=a<s['p_vaddr']+s['p_filesz']),None)
 if s:off=a-s['p_vaddr']+s['p_offset'];u.mem_write(a,raw[off:off+size])
u.mem_write(0x83fd000,b'\1'*4096)
for a in [0x7fd9000,0x7fda000]:u.mem_write(a,struct.pack('<Q',0x120000)*512)
u.mem_write(0x120000,struct.pack('<Q',0x121000));u.mem_write(0x1210e4,struct.pack('<I',1));u.mem_write(0x110000,struct.pack('<12d',300,1.2,.2,300,1.2,.2,300,1.2,.5,300,1.2,.2))
def dset(reg,value):u.reg_write(reg,struct.unpack('<Q',struct.pack('<d',value))[0])
def dget():return struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0)))[0]
def hook(e,a,size,data):
 if a==0x5aa3b34:e.reg_write(UC_ARM64_REG_X0,0x120000)
 elif a==0x6b404e4:e.reg_write(UC_ARM64_REG_X0,0x110000)
 elif a==0x7b82c50:dset(UC_ARM64_REG_D0,math.tanh(dget()))
 else:return
 e.reg_write(UC_ARM64_REG_PC,e.reg_read(UC_ARM64_REG_X30))
u.hook_add(UC_HOOK_CODE,hook);count=0
for name,addr,limit in [('Valor',0x3c54f34,.2),('Mental',0x3c55020,.2),('Tenacity',0x3c551b4,.5),('Focus',0x3c510d4,.2)]:
 for a in [0,1,50,100,300,1000,190110]:
  for b in [0,1,50,100,300,1000,190110]:
   u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20);u.reg_write(UC_ARM64_REG_SP,0x13e000);u.reg_write(UC_ARM64_REG_X30,0x13f000);dset(UC_ARM64_REG_D0,a);dset(UC_ARM64_REG_D1,b);u.emu_start(addr,0x13f000,count=3000)
   actual=dget();expected=math.tanh((a-b)/300*1.2)*limit;assert math.isclose(actual,expected,rel_tol=1e-12,abs_tol=1e-12),(name,a,b,actual,expected);count+=1
r={'cases':count,'nativeSha256':digest,'helpers':['CalcTanHValor','CalcTanHMental','CalcTanHTenacity','CalcTanHFocus'],'hooks':['combat config lookup','libc tanh'],'scope':'named relative-stat substeps only, not complete damage/effect processing'};args.output.write_text(json.dumps(r,indent=2));print(json.dumps(r))
