"""Original ARM64 DecShield with list/flag-predicate fixtures, not loop fixtures."""
import argparse,hashlib,json,random,struct,math
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import *
from unicorn.arm64_const import *
from reference_shields import ShieldLayer,consume_shields
HASH='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
def oracle(native):
 raw=native.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=HASH:raise ValueError('Native hash mismatch')
 with native.open('rb') as f:segs=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x30000);ret=base+0x2f000;actor=base+0x1000;lst=base+0x6000;state=[]
 u.mem_write(actor+0x3538,struct.pack('<Q',lst))
 def mem(e,access,a,size,value,data):
  page=a&~4095;s=next((s for s in segs if s['p_vaddr']<=a<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unexpected native memory {a:x}')
  u.mem_map(page,4096);start=max(page,s['p_vaddr']);end=min(page+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:u.mem_write(start,raw[start-s['p_vaddr']+s['p_offset']:end-s['p_vaddr']+s['p_offset']])
  return True
 u.hook_add(UC_HOOK_MEM_UNMAPPED,mem)
 def x(i):return u.reg_read(UC_ARM64_REG_X0+i)
 def hook(e,a,size,data):
  old=a+0x100000
  if old==0x37b9304:pass
  elif old==0x37b95b0:raise RuntimeError('Native null path')
  elif old==0x7c82bd0:u.mem_write(x(0),bytes([x(1)&255])*x(2))
  elif old==0x7c82be0:u.mem_write(x(0),bytes(u.mem_read(x(1),x(2))))
  elif old==0x539ad2c:u.mem_write(x(8),state[x(1)])
  elif old==0x539ad90:state[x(1)]=bytes(u.mem_read(x(2),0x88))
  elif old==0x6c653a8:u.reg_write(UC_ARM64_REG_X0,int(bool(u.mem_read(x(0),1)[0]&0x10)))
  else:return
  u.reg_write(UC_ARM64_REG_PC,u.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook)
 def run(layers,damage):
  state.clear()
  for layer in layers:
   buf=bytearray(0x88);buf[0x14]=0x10 if layer.is_shield else 0;buf[0x40]=int(layer.stop);struct.pack_into('<d',buf,0x50,layer.remaining);state.append(bytes(buf))
  u.mem_write(lst+0x18,struct.pack('<I',len(layers)))
  for reg,v in [(UC_ARM64_REG_X0,actor),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0x2e000),(UC_ARM64_REG_CPACR_EL1,3<<20),(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',damage))[0])]:u.reg_write(reg,v)
  u.emu_start(0x3bdff88,ret,count=20000)
  if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Native shield instruction budget')
  return [(struct.unpack_from('<d',row,0x50)[0],bool(row[0x40]&1)) for row in state]
 return run

def verify(native,output):
 run=oracle(native);rng=random.Random(20261027);cases=0
 for i in range(1000):
  layers=[ShieldLayer(rng.choice([0.,10.,50.,100.]),100.,rng.choice([True,False]),rng.choice([True,False])) for _ in range(i%9)]
  damage=rng.choice([0.,1.,25.,75.,100.,200.,1000.]);actual=run(layers,damage);expected,_=consume_shields(layers,damage)
  if actual!=[(l.remaining,l.stop) for l in expected]:raise AssertionError((layers,damage,actual,expected))
  cases+=1
 result={'passed':True,'cases':cases,'nativeSha256':HASH,'scope':'DecShield newest-to-oldest consumption and stop flag; list storage/flag predicate/libc are fixtures; full effect callbacks excluded'};output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();verify(a.native,a.output)
