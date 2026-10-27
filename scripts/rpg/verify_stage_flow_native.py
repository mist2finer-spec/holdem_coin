"""Execute original OnAdvance; Spawn/CheckEndCondition are observed callbacks."""
import argparse,hashlib,json,itertools,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import *
from unicorn.arm64_const import *
from reference_stage_flow import Wave,advance_wave
HASH='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
def oracle(native):
 raw=native.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=HASH:raise ValueError('Native build mismatch')
 with native.open('rb') as f:segments=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x20000);wave=base+0x1000;ret=base+0x1f000;commands=[]
 def mem(e,access,addr,size,value,data):
  page=addr&~4095;s=next((s for s in segments if s['p_vaddr']<=addr<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unknown native address {addr:x}')
  u.mem_map(page,4096);start=max(page,s['p_vaddr']);end=min(page+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:u.mem_write(start,raw[start-s['p_vaddr']+s['p_offset']:end-s['p_vaddr']+s['p_offset']])
  return True
 u.hook_add(UC_HOOK_MEM_UNMAPPED,mem)
 def hook(e,a,size,data):
  old=a+0x100000
  if old==0x3c95d24:commands.append(('spawn-group',7,bool(u.mem_read(wave+0x141,1)[0])))
  elif old==0x3c95e3c:commands.append(('check-group-deaths',7))
  else:return
  u.reg_write(UC_ARM64_REG_PC,u.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook)
 def run(w,dt):
  commands.clear();u.mem_write(wave+0x134,bytes([w.repeat]));u.mem_write(wave+0x138,struct.pack('<fi',w.repeat_interval,w.repeat_count));u.mem_write(wave+0x140,bytes([w.started,w.trigger_on_start,w.ended,0]));u.mem_write(wave+0x144,struct.pack('<if',w.current_repeat_count,w.timer))
  for reg,v in [(UC_ARM64_REG_X0,wave),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0x1e000),(UC_ARM64_REG_CPACR_EL1,3<<20),(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',dt))[0])]:u.reg_write(reg,v)
  u.emu_start(0x3b95c7c,ret,count=500)
  if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Native wave instruction budget')
  count,timer=struct.unpack('<if',u.mem_read(wave+0x144,8));trigger=bool(u.mem_read(wave+0x141,1)[0]);return timer,count,trigger,list(commands)
 return run

def verify(native,output):
 run=oracle(native);cases=0
 for started,ended,repeat,count,limit,timer,dt,trigger in itertools.product([False,True],[False,True],[False,True],[0,1,3],[0,1,3],[-1.,0.,.1,1.],[0.,.01,.5,2.],[False,True]):
  w=Wave(7,repeat=repeat,repeat_interval=.3,repeat_count=limit,started=started,ended=ended,current_repeat_count=count,timer=timer,trigger_on_start=trigger);e,cmd=advance_wave(w,dt);expected=(e.timer,e.current_repeat_count,e.trigger_on_start,cmd);actual=run(w,dt)
  if actual!=expected:raise AssertionError((w,dt,actual,expected))
  cases+=1
 result={'passed':True,'cases':cases,'nativeSha256':HASH,'nativeAddress':'0x3b95c7c','scope':'Wave OnAdvance scheduling only; Spawn and group-death checks are observed callbacks; scene layout not synthesized'};output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();verify(a.native,a.output)
