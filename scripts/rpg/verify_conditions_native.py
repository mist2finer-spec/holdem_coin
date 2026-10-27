"""Compare condition branches with original ARM64, supplying actor getter fixtures."""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import *
from unicorn.arm64_const import *
from elftools.elf.elffile import ELFFile
from reference_conditions import condition

def verify(native,output):
 raw=native.read_bytes();digest=hashlib.sha256(raw).hexdigest()
 if digest!='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5':raise ValueError('Native hash mismatch')
 with native.open('rb') as f:segments=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
 u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);base=0x100000000;u.mem_map(base,0x20000);stop=base+0x1f000;manager=base+0x1000;world=base+0x2000;actor=base+0x3000;ctx=base+0x4000
 u.mem_write(manager+16,struct.pack('<Q',world));state={};mapped=set()
 def page(e,access,addr,size,value,data):
  a=addr&~4095;s=next((s for s in segments if s['p_vaddr']<=addr<s['p_vaddr']+s['p_memsz']),None)
  if not s:raise RuntimeError(f'Unmapped native address {addr:#x}')
  u.mem_map(a,4096);start=max(a,s['p_vaddr']);end=min(a+4096,s['p_vaddr']+s['p_filesz'])
  if end>start:u.mem_write(start,raw[start-s['p_vaddr']+s['p_offset']:end-s['p_vaddr']+s['p_offset']])
  if a<=0x83fd659<a+4096:u.mem_write(0x83fd659,b'\1')
  return True
 u.hook_add(UC_HOOK_MEM_UNMAPPED,page)
 def get(i):return u.reg_read(UC_ARM64_REG_X0+i)
 def hook(e,addr,size,data):
  old=addr+0x100000
  if old==0x3d1685c:
   typ=get(1);hasctx=get(2)!=0
   present=state['present'] and (typ==2 or hasctx)
   e.reg_write(UC_ARM64_REG_X0,actor if present else 0)
  elif old in [0x3cdf410,0x3cdf488,0x3cdf734,0x3cdf7ac,0x3cdfda8]:
   key={0x3cdf410:'hp',0x3cdf488:'maxHP',0x3cdf734:'mp',0x3cdf7ac:'maxMP',0x3cdfda8:'shield'}[old]
   e.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',state[key]))[0])
  else:return
  e.reg_write(UC_ARM64_REG_PC,e.reg_read(UC_ARM64_REG_X30))
 u.hook_add(UC_HOOK_CODE,hook);cases=0
 for present in [False,True]:
  for context in [False,True]:
   for maxval in [0.,100.]:
    for value in [0.,1.,50.,100.]:
     state.update(present=present,hp=value,maxHP=maxval,mp=value,maxMP=maxval,shield=value)
     for kind in [0,1,20,21,30,40,41,255]:
      for typ in [0,1,2,3]:
       for threshold in [0.,49.999,50.,100.]:
        for reg,v in [(UC_ARM64_REG_X0,manager),(UC_ARM64_REG_X1,actor),(UC_ARM64_REG_X2,ctx if context else 0),(UC_ARM64_REG_X3,typ),(UC_ARM64_REG_X4,kind),(UC_ARM64_REG_X30,stop),(UC_ARM64_REG_SP,base+0x1e000),(UC_ARM64_REG_CPACR_EL1,3<<20)]:u.reg_write(reg,v)
        for reg,v in [(UC_ARM64_REG_S0,threshold),(UC_ARM64_REG_S1,0.)]:u.reg_write(reg,struct.unpack('<I',struct.pack('<f',v))[0])
        u.emu_start(0x3bf4494,stop,count=3000)
        if u.reg_read(UC_ARM64_REG_PC)!=stop:raise RuntimeError('Native condition instruction budget exhausted')
        expected=condition(dict(Condition=kind,ConditionTarget=typ,ConditionValue=threshold,ConditionValue2=0),actual=state if present else None,invoker=state if present else None,sensored=state if present else None,context=context)
        actual=bool(get(0)&1)
        if expected!=actual:raise AssertionError((kind,typ,present,context,maxval,value,threshold,expected,actual))
        cases+=1
 result={'nativeSha256':digest,'cases':cases,'nativeAddress':'0x3bf4494','scope':'Always/Never/HP/MP/shield/unknown conditions; actor lookup and getters are fixtures; marking conversion not verified','hooks':['GetTargetActor','HP/MP/max/shield getters']}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(verify(a.native,a.output)))
