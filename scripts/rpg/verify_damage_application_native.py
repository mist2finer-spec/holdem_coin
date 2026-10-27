"""Execute original InflictDamage; actor storage and passive callbacks are fixtures."""
import argparse,hashlib,json,struct,math,itertools
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import *
from unicorn.arm64_const import *
from reference_damage_application import DamageTarget,inflict_damage


def oracle(native):
 raw=native.read_bytes();digest=hashlib.sha256(raw).hexdigest()
 if digest!='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5':raise ValueError('Native hash mismatch')
 with native.open('rb') as f:segments=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x30000);ret=base+0x2f000;manager=base+0x1000;target=base+0x2000;invoker=base+0x6000;flagptr=base+0x11000;world=base+0x12000;events=base+0x13000;klass=base+0x14000
 u.mem_write(manager+16,struct.pack('<Q',world));u.mem_write(klass,struct.pack('<Q',klass+0x1000));u.mem_write(klass+0x1000+0xe4,struct.pack('<I',1));state={};triggers=[]
 def memory(e,access,addr,size,value,data):
  a=addr&~4095;s=next((s for s in segments if s['p_vaddr']<=addr<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unexpected memory {addr:#x}')
  u.mem_map(a,4096);start=max(a,s['p_vaddr']);end=min(a+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:u.mem_write(start,raw[start-s['p_vaddr']+s['p_offset']:end-s['p_vaddr']+s['p_offset']])
  if a<=0x83fd61d<a+4096:u.mem_write(0x83fd61d,b'\1')
  if a==0x7fd9000:u.mem_write(0x7fd94e8,struct.pack('<Q',klass))
  return True
 u.hook_add(UC_HOOK_MEM_UNMAPPED,memory)
 def x(i):return u.reg_read(UC_ARM64_REG_X0+i)
 def dget(i=0):return struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0+i)))[0]
 def dout(v):u.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',v))[0])
 def sin(v):u.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',v))[0])
 def hook(e,addr,size,data):
  old=addr+0x100000
  if old==0x3cdf6c4:e.reg_write(UC_ARM64_REG_X0,int(state['hp']<=0))
  elif old==0x3cdf16c:e.reg_write(UC_ARM64_REG_X0,int(bool(state['actor_flags']&x(1))))
  elif old==0x3ce2a70:e.reg_write(UC_ARM64_REG_X0,int(state['invincible'] and x(1)==100))
  elif old==0x3ce2c28:e.reg_write(UC_ARM64_REG_X0,int(state['invincible_shield']))
  elif old==0x3cdf410:dout(state['hp'])
  elif old==0x3cdfda8:dout(state['shield'])
  elif old==0x3cdf4f8:sin(state['hp']/state['max_hp'] if state['max_hp']>0 else 0.)
  elif old==0x3cdff88:state['shield']=max(0.,state['shield']-dget())
  elif old==0x3cdf5a8:state['hp']=min(state['max_hp'],max(0.,state['hp']+dget()))
  elif old==0x6ea3178:dout(min(dget(),dget(1)))
  elif old==0x3ce75b0:triggers.append(x(2))
  elif old==0x3d0fe84:e.reg_write(UC_ARM64_REG_X0,events)
  elif old==0x37b95b0:raise RuntimeError('Native null-reference path')
  else:return
  e.reg_write(UC_ARM64_REG_PC,e.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook)
 def run(t,damage,bonus=0,flags=0):
  state.clear();state.update(vars(t));state['max_hp']=t.max_hp;triggers.clear();u.mem_write(invoker+0x3590,struct.pack('<d',0.));u.mem_write(flagptr,struct.pack('<Q',flags))
  for reg,v in [(UC_ARM64_REG_X0,manager),(UC_ARM64_REG_X1,target),(UC_ARM64_REG_X2,invoker),(UC_ARM64_REG_X3,2010),(UC_ARM64_REG_X4,flagptr),(UC_ARM64_REG_X5,0),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0x2e000),(UC_ARM64_REG_CPACR_EL1,3<<20)]:u.reg_write(reg,v)
  dout(damage);u.reg_write(UC_ARM64_REG_S1,struct.unpack('<I',struct.pack('<f',bonus))[0]);
  try:u.emu_start(0x3be7264,ret,count=5000)
  except Exception as error:raise RuntimeError(f'Native PC={u.reg_read(UC_ARM64_REG_PC):x}, LR={u.reg_read(UC_ARM64_REG_X30):x}, state={state}') from error
  if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Instruction budget')
  return state['hp'],state['shield'],struct.unpack('<d',u.mem_read(invoker+0x3590,8))[0],struct.unpack('<Q',u.mem_read(flagptr,8))[0],list(triggers)
 return run


def verify(native,output):
 run=oracle(native);cases=0
 for hp,shield,damage,bonus,actorflags,invincible,invshield,flags in itertools.product([0.,25.,100.],[0.,50.,200.],[0.,1.,30.,500.],[-20.,0.,50.,100.],[0,0x200,0x400],[False,True],[False,True],[0,0x4000]):
  t=DamageTarget(hp,100.,shield,actorflags,invincible,invshield);e=inflict_damage(t,damage,bonus,flags);actual=run(t,damage,bonus,flags);expected=(e.hp,e.shield,e.gross_damage,e.flags,e.passive_triggers)
  if not all(math.isclose(a,b,abs_tol=1e-7,rel_tol=1e-7) for a,b in zip(actual[:3],expected[:3])) or actual[3:]!=expected[3:]:raise AssertionError((vars(t),damage,bonus,flags,expected,actual))
  cases+=1
 result={'cases':cases,'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'nativeAddress':'0x3be7264','scope':'InflictDamage settlement and passive trigger ordering; actor storage/callbacks are fixtures; effects triggered by passives not executed'}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(verify(a.native,a.output)))
