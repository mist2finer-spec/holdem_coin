"""Execute original ARM64 reward baseline/interpolation, including floor helpers.
Vector access, DB chapter stage-count and class initialization are fixtures.
No reward formula is hooked. Server random selection is outside this verification.
"""
import argparse,hashlib,json,math,random,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_MEM_UNMAPPED,UC_HOOK_CODE
from unicorn.arm64_const import *
from reference_reward_scaling import scaled_baseline,stage_base_reward
from reference_rewards import CHAPTER_MATERIALS

HASH='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
def oracle(native,table):
 raw=native.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=HASH:raise ValueError('Unsupported native build')
 with native.open('rb') as f:segs=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x200000);ret=base+0x1ff000;manager=base+0x100000;klass=base+0x110000;vtable=base+0x120000;count_fn=base+0x130000;get_fn=count_fn+0x100;state={};mapped=set()
 def map_page(addr):
  a=addr&~4095
  if a in mapped:return
  s=next((s for s in segs if s['p_vaddr']<=addr<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unknown memory {addr:x}')
  u.mem_map(a,4096);mapped.add(a);start=max(a,s['p_vaddr']);end=min(a+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:
   off=start-s['p_vaddr']+s['p_offset'];u.mem_write(start,raw[off:off+end-start])
 u.hook_add(UC_HOOK_MEM_UNMAPPED,lambda e,access,a,size,value,data:(map_page(a) or True))
 offsets={1:0xd00,3:0xd08,101:0xd10,121:0xd18,2:0xd20,131:0xd28,112:0xd30,132:0xd38,146:0xd40,149:0xd48};vectors={}
 for i,(key,material) in enumerate(CHAPTER_MATERIALS.items()):
  obj=base+0x140000+i*0x100;u.mem_write(obj,struct.pack('<Q',klass));u.mem_write(manager+offsets[material],struct.pack('<Q',obj));vectors[obj]=[float(v['Value']) for v in table[key]]
 u.mem_write(klass,struct.pack('<Q',klass+0x1000));u.mem_write(klass+0x1000+0xe4,struct.pack('<I',1))
 map_page(0x7fd94e8);u.mem_write(0x7fd94e8,struct.pack('<Q',klass))
 def dset(n):u.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',n))[0])
 def hook(e,a,size,data):
  if a==ret:return
  old=a+0x100000
  if old in [0x37b9304,0x37b9484]:pass
  elif old==0x37b95b0:raise RuntimeError('Native null path')
  elif old==0x37f1a70:
   state['resolver']+=1;u.mem_write(vtable,struct.pack('<QQ',count_fn if state['resolver']%2 else get_fn,0));u.reg_write(UC_ARM64_REG_X0,vtable)
  elif a==count_fn:u.reg_write(UC_ARM64_REG_X0,len(vectors[u.reg_read(UC_ARM64_REG_X0)]))
  elif a==get_fn:dset(vectors[u.reg_read(UC_ARM64_REG_X0)][u.reg_read(UC_ARM64_REG_W1)])
  elif old==0x6c5443c:u.reg_write(UC_ARM64_REG_X0,state['stageCount'])
  else:return
  u.reg_write(UC_ARM64_REG_PC,u.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook)
 def run(chapter,material,scale,stage=None,stage_count=5):
  state.update(resolver=0,stageCount=stage_count)
  for reg,value in [(UC_ARM64_REG_X0,manager),(UC_ARM64_REG_W1,material),(UC_ARM64_REG_W2,chapter),(UC_ARM64_REG_W3,stage or 0),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0xf0000),(UC_ARM64_REG_CPACR_EL1,3<<20)]:u.reg_write(reg,value)
  dset(scale);u.emu_start(0x6b54368 if stage is not None else 0x6b54140,ret,count=20000)
  if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Native instruction budget')
  return struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0)))[0]
 return run

def verify(native,source,output):
 table=json.loads(source.read_text());run=oracle(native,table);rng=random.Random(20261027);cases=0
 for material in CHAPTER_MATERIALS.values():
  for chapter in [1,2,10,100,500,1200]:
   for scale in [0.,.37,1.,1.25,2.53]:
    expected=scaled_baseline(table,chapter,material,scale);actual=run(chapter,material,scale)
    if actual!=expected:raise AssertionError(('baseline',material,chapter,actual,expected))
    cases+=1
    for stage in range(1,6):
     expected=stage_base_reward(table,chapter,stage,material,5,scale);actual=run(chapter,material,scale,stage)
     if actual!=expected:raise AssertionError(('stage',material,chapter,stage,actual,expected))
     cases+=1
 result={'nativeSha256':HASH,'passed':True,'cases':cases,'scope':'Native base reward lookup and per-stage interpolation; original numeric floor helpers; vector storage and stage-count fixtures; no server random policy'}
 output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();verify(a.native,a.source,a.output)
