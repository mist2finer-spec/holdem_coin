"""Original RandomUtil.SelectIndex, signed and ushort overloads.
Native accumulation/negative clamp/selection are executed; list pool and RNG fixtures.
"""
import argparse,hashlib,json,random,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import *
from unicorn.arm64_const import *
from reference_weighted_selection import weighted_index
HASH='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
def oracle(native):
 raw=native.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=HASH:raise ValueError('Native build mismatch')
 with native.open('rb') as f:segs=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x30000);ret=base+0x2f000;lst=base+0x1000;klass=base+0x2000;state={}
 u.mem_write(klass,struct.pack('<Q',klass+0x1000));u.mem_write(klass+0x1000+0xe4,struct.pack('<I',1))
 def mem(e,access,a,size,value,data):
  page=a&~4095;s=next((s for s in segs if s['p_vaddr']<=a<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unexpected memory {a:x} PC={u.reg_read(UC_ARM64_REG_PC):x}')
  u.mem_map(page,4096);start=max(page,s['p_vaddr']);end=min(page+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:u.mem_write(start,raw[start-s['p_vaddr']+s['p_offset']:end-s['p_vaddr']+s['p_offset']])
  for ptr in [0x7fe10a8,0x7fdc4b8]:
   if page<=ptr<page+4096:u.mem_write(ptr,struct.pack('<Q',klass))
  return True
 u.hook_add(UC_HOOK_MEM_UNMAPPED,mem)
 def x(i):return u.reg_read(UC_ARM64_REG_X0+i)
 def hook(e,a,size,data):
  old=a+0x100000
  if old in [0x37b9304,0x37b9484,0x56d3d98,0x54dae7c,0x5baa0f4]:pass
  elif old==0x37b95b0:raise RuntimeError('Native null path')
  elif old in [0x63d7bf4,0x63d0d9c]:u.mem_write(x(0),struct.pack('<Q',lst));u.reg_write(UC_ARM64_REG_X0,lst);u.reg_write(UC_ARM64_REG_X1,0)
  elif old in [0x56d3894,0x54da978]:u.reg_write(UC_ARM64_REG_W0,state['weights'][x(1)]&0xffffffff)
  elif old==0x54da9cc:state['weights'][x(1)]=x(2)
  elif old==0x6cf73f8:
   expected=sum(max(0,w) for w in state['weights']);actual=(x(1),x(2))
   if actual!=(0,expected-1):raise AssertionError(('Native RNG bounds',actual,expected))
   state['rngCalls']+=1;u.reg_write(UC_ARM64_REG_X0,state['draw'])
  else:return
  u.reg_write(UC_ARM64_REG_PC,u.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook)
 def run(weights,draw,signed):
  state.update(weights=list(weights),draw=draw,rngCalls=0);u.mem_write(lst+0x18,struct.pack('<I',len(weights)))
  for reg,v in [(UC_ARM64_REG_X0,lst),(UC_ARM64_REG_X1,lst),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0x2e000),(UC_ARM64_REG_CPACR_EL1,3<<20)]:u.reg_write(reg,v)
  try:u.emu_start(0x6bf7a3c if signed else 0x6bf77fc,ret,count=20000)
  except Exception as err:raise RuntimeError(f'PC={u.reg_read(UC_ARM64_REG_PC):x}, LR={u.reg_read(UC_ARM64_REG_X30):x}, state={state}') from err
  if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Weighted selection instruction budget')
  r=u.reg_read(UC_ARM64_REG_W0);return r if r<2**31 else r-2**32,state['rngCalls']
 return run

def verify(native,output):
 run=oracle(native);rng=random.Random(20261027);cases=0
 for signed in [False,True]:
  for i in range(500):
   weights=[rng.choice([-10,0,1,5,10,40,100]) if signed else rng.choice([0,1,5,10,40,100,65535]) for _ in range(i%12)];total=sum(max(0,w) for w in weights)
   for draw in sorted(set([0,total//2,total-1])) if total else [None]:
    actual,calls=run(weights,draw,signed);expected=weighted_index(weights,draw,signed=signed)
    if actual!=expected or calls!=int(total>0):raise AssertionError((signed,weights,draw,actual,expected,calls))
    cases+=1
 result={'passed':True,'cases':cases,'nativeSha256':HASH,'nativeAddresses':['0x6bf77fc','0x6bf7a3c'],'scope':'RandomUtil.SelectIndex signed/ushort: accumulation, negative clamp, one integer draw and subtract-until-negative; list/RNG fixtures; NOT proof of server reward-group policy'};output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();verify(a.native,a.output)
