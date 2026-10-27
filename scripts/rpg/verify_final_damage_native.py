"""Differential verification against original CalcFinalDamage ARM64, ability-only scope.
The formula itself is not hooked. Actor state, numeric decoding, lookup helpers and
resolved DmgRate/DefRate magnitudes and other empty effect iterators are explicit fixtures; full effects are not verified.
Requires unicorn and pyelftools, and the exact audited binary kept outside git.
"""
import argparse,struct,hashlib,json,math,random
from pathlib import Path
from unicorn import *
from unicorn.arm64_const import *
from elftools.elf.elffile import ELFFile
from reference_damage import final_damage,heal_amount

def create_oracle(native,layout):
    raw=native.read_bytes();assert hashlib.sha256(raw).hexdigest()=='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5'
    with native.open('rb') as f: segs=[dict(s.header) for s in ELFFile(f).iter_segments() if s['p_type']=='PT_LOAD']
    u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);mapped=set();base=0x100000000
    u.mem_map(base,0x200000);ret=base+0x1ff000;att=base+0x100000;target=att+0x10000;flags=att+0x30000;dummy=att+0x40000
    context={};hp=1000

    def page(addr):
     a=addr&~4095
     if a in mapped:return
     s=next((s for s in segs if s['p_vaddr']<=addr<s['p_vaddr']+s['p_memsz']),None)
     if not s:raise RuntimeError(f'Unknown memory {addr:x}, pc {u.reg_read(UC_ARM64_REG_PC):x}')
     u.mem_map(a,4096);mapped.add(a);start=max(a,s['p_vaddr']);end=min(a+4096,s['p_vaddr']+s['p_filesz'])
     if end>start:
      off=start-s['p_vaddr']+s['p_offset'];u.mem_write(start,raw[off:off+end-start])
     if a<=0x83fd85b<a+4096:u.mem_write(0x83fd85b,b'\1')

    def invalid(e,access,addr,size,value,data):page(addr);return True
    u.hook_add(UC_HOOK_MEM_UNMAPPED,invalid)
    def x(i):return u.reg_read(UC_ARM64_REG_X0+i)
    def dout(v):u.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',v))[0])
    def sin(v):u.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',v))[0])
    def dget(i=0):return struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0+i)))[0]
    seen={}
    def hook(e,a,size,data):
     if a==ret:return
     # Addresses from source-build decompilation are 0x100000 above audited binary.
     old=a+0x100000
     if old in [0x37b9304,0x37b9484]:e.reg_write(UC_ARM64_REG_X0,0)
     elif old==0x37b95b0:raise RuntimeError('Native null-reference path')
     elif old==0x5ba3b34:e.reg_write(UC_ARM64_REG_X0,dummy)
     elif old==0x6c5d944:e.reg_write(UC_ARM64_REG_X0,context.get('attribute',0)&0xffffffff)
     elif old==0x6c40504:e.reg_write(UC_ARM64_REG_X0,dummy)
     elif old==0x6c404e4:e.reg_write(UC_ARM64_REG_X0,dummy)
     elif old==0x3cdf17c:e.reg_write(UC_ARM64_REG_X0,x(0)+0x1000)
     elif old in [0x3cdf19c,0x3cdfd7c]:e.reg_write(UC_ARM64_REG_X0,dummy)
     elif old==0x3cdf410:dout(hp)
     elif old==0x3cdf488:dout(context.get('maxHP',1000))
     elif old==0x3cdf4f8:sin(.5)
     elif old==0x3cdfda8:dout(0)
     elif old==0x3ce3968:
      value=context.get('damageRate',0) if x(0)==att and x(1)==222 else context.get('healRate') if x(0)==target and x(1)==229 else None
      if value is not None:u.mem_write(x(2),struct.pack('<f',value))
      e.reg_write(UC_ARM64_REG_X0,int(value is not None and (value!=0 or x(1)==229)))
     elif old==0x3ce3a8c and x(0)==target and x(1)==224:
      values=context.get('defenseRates',());index=context.get('defenseIndex',0)
      if index<len(values):u.mem_write(x(2),struct.pack('<f',values[index]));context['defenseIndex']=index+1
      e.reg_write(UC_ARM64_REG_X0,int(index<len(values)))
     elif old in [0x3cdf16c,0x3ce2a70,0x3ce3a8c,0x3ce3bac,0x3ce3d80,0x3ce605c,0x3ce6328]:e.reg_write(UC_ARM64_REG_X0,0)
     elif old==0x38e143c or old==0x38e1440:dout(struct.unpack('<d',u.mem_read(x(0),8))[0])
     elif old in [0x6c30840,0x6c30990]:
      idx=8 if old==0x6c30840 else 9;value=struct.unpack('<d',u.mem_read(x(0)+idx*40,8))[0];rate=struct.unpack('<d',u.mem_read(x(0)+(idx+4)*40,8))[0];dout(round(value*(1+rate/100)))
     elif old==0x6c30d90:dout(context.get('actorBonus',0))
     elif old==0x3d54f34 or old==0x3d55020:dout(math.tanh((dget()-dget(1))/300*1.2)*.2)
     elif old==0x6cf74c0:sin(.5)
     elif old==0x3d4f334:e.reg_write(UC_ARM64_REG_X0,0)
     elif old in [0x7c82bc0,0x7c82be0]:u.mem_write(x(0),bytes(u.mem_read(x(1),x(2))))
     elif old==0x7c82bd0:u.mem_write(x(0),bytes([x(1)&255])*x(2))
     else:return
     seen[hex(old)]=seen.get(hex(old),0)+1;e.reg_write(UC_ARM64_REG_PC,e.reg_read(UC_ARM64_REG_X30))
    u.hook_add(UC_HOOK_CODE,hook)
    def run(damage,bits,attacker=None,defender=None,bonus=0.,attribute=0,actorBonus=0.,maxDef=90.,damageRate=0.,defenseRates=()):
     context.update(attribute=attribute,actorBonus=actorBonus,damageRate=damageRate,defenseRates=defenseRates,defenseIndex=0)
     for actor,values in [(att,attacker or {}),(target,defender or {})]:
      u.mem_write(actor+0x1000,bytes(0x30c0))
      for name,value in values.items():u.mem_write(actor+0x1000+layout[name],struct.pack('<d',value))
     u.mem_write(dummy+0x60,struct.pack('<d',maxDef))
     u.mem_write(flags,struct.pack('<Q',bits));u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20);u.reg_write(UC_ARM64_REG_SP,base+0xf0000);u.reg_write(UC_ARM64_REG_X30,ret)
     for reg,v in [(UC_ARM64_REG_X0,att),(UC_ARM64_REG_X1,target),(UC_ARM64_REG_X2,dummy),(UC_ARM64_REG_X3,flags),(UC_ARM64_REG_X4,0)]:u.reg_write(reg,v)
     dout(damage);u.reg_write(UC_ARM64_REG_S1,struct.unpack('<I',struct.pack('<f',bonus))[0])
     u.emu_start(0x3c515f4,ret,count=100000)
     if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('instruction budget')
     return dget(),struct.unpack('<Q',u.mem_read(flags,8))[0]
    def heal(percent,maxHP,override=0.,healRate=None,minimum=-100.):
     context.update(maxHP=maxHP,healRate=healRate)
     u.mem_write(target+0x3490,struct.pack('<d',override));u.mem_write(dummy+0x58,struct.pack('<f',minimum))
     for reg,value in [(UC_ARM64_REG_X0,att),(UC_ARM64_REG_X1,target),(UC_ARM64_REG_X2,0),(UC_ARM64_REG_X30,ret),(UC_ARM64_REG_SP,base+0xf0000),(UC_ARM64_REG_CPACR_EL1,3<<20)]:u.reg_write(reg,value)
     dout(percent);u.emu_start(0x3c553d0,ret,count=3000)
     if u.reg_read(UC_ARM64_REG_PC)!=ret:raise RuntimeError('Heal instruction budget')
     return dget()
    run.heal=heal
    return run

def verify(native,output):
    layout_path=Path(__file__).resolve().parents[2]/'docs/rpg/actor-ability-layout.json'
    fields=json.loads(layout_path.read_text())['fields'];layout={r['name']:r['offset'] for r in fields}
    oracle=create_oracle(native,layout);cases=0;rng=random.Random(20261027)
    masks=[0,64,128,0x50,0xa0,0x90,0x20040,0x80040,0x40040,0x100040,0x800080,0x1000080,0x2000080,0x4000080,0x8000080,0x10000040,0x100000040,0x1f00000cc,0x800,0x1000]
    def compare(damage,flags,a=None,d=None,bonus=0,attribute=0,actorBonus=0,maxDef=90,damageRate=0.,defenseRates=()):
        nonlocal cases
        a=a or {};d=d or {}
        relative=lambda name:tuple(round(v.get(name,0)*(1+v.get(name+'Rate',0)/100)) for v in [a,d])
        expected=final_damage(damage,flags,a,d,valor=relative('valor'),mental=relative('mental'),critical_effect_bonus=bonus,attribute_adjustment=attribute,actor_type_bonus=actorBonus,maximum_defense_percent=maxDef,damage_rate=damageRate,defense_rates=defenseRates)
        actual=oracle(damage,flags,a,d,bonus,attribute,actorBonus,maxDef,damageRate,defenseRates)
        if not math.isclose(actual[0],expected[0],rel_tol=2e-12,abs_tol=2e-10) or actual[1]!=expected[1]:
            raise AssertionError(dict(damage=damage,flags=hex(flags),a=a,d=d,bonus=bonus,attribute=attribute,actorBonus=actorBonus,maxDef=maxDef,expected=expected,actual=actual))
        cases+=1
    # Independently exercise every actual struct slot used in the recovered ability-only path.
    names=['defaultAtkDmgRate','skillDmgRate','weaponTypeDmgRate','phyDmgRate','magDmgRate','artifactSkillDmgRate','overchargeSkillDmgRate','guildRaidGearArtifactSkillDmgRate','guildRaidGearOverchargeSkillDmgRate','skillAttrDmgRate','skillAttrDefaultAtkDmgRate','skillAttrSkillDmgRate','skillAttrPhyDmgRate','skillAttrMagDmgRate','expBuffDefaultAtkDmgRate','expBuffSkillDmgRate','expBuffPhyDmgRate','expBuffMagDmgRate','fireMagDmgRate','waterMagDmgRate','earthMagDmgRate','impactPhyDmgRate','darkMagDmgRate','lightMagDmgRate','powerBlowDmgRate','finishBlowDmgRate','vsMobDmgRate','vsBossDmgRate','expBuffVsMobDmgRate','expBuffVsBossDmgRate']
    defenses=['defaultAtkDefRate','skillDefRate','phyDefRate','magDefRate','impactPhyDefRate','fireMagDefRate','waterMagDefRate','earthMagDefRate','lightMagDefRate','darkMagDefRate','skillAttrDefRate','expBuffPhyDefRate','expBuffMagDefRate','expBuffAllDefRate','vsMobDefRate','expBuffVsMobDefRate','vsBossDefRate','expBuffVsBossDefRate']
    for name in names+defenses:
        for val in [-20,15,150]:
            for mask in masks:
                compare(100,mask,{name:val} if name in names else {},{name:val} if name in defenses else {})
    for _ in range(600):
        a={name:rng.uniform(-20,80) for name in rng.sample(names,8)};d={name:rng.uniform(-10,100) for name in rng.sample(defenses,6)}
        a.update(valor=rng.randrange(1000),mental=rng.randrange(1000));d.update(valor=rng.randrange(1000),mental=rng.randrange(1000))
        compare(rng.uniform(.01,10000),rng.choice(masks)|rng.randrange(16),a,d,rng.choice([0,15.25,50]),rng.choice([-100,-20,0,25]),rng.choice([0,20]),rng.choice([0,50,90,100]))
    for damage in [-1,0,.1,1,100]:
        for mask in masks:compare(damage,mask)
    for rate in [-50.,0.,20.,100.]:
        for reductions in [(),(-10.,),(20.,30.),(100.,),(-50.,50.)]:
            for mask in masks:compare(100,mask|1,dict(skillDmgRate=25),dict(defaultAtkDefRate=10,expBuffAllDefRate=15),bonus=15.25,damageRate=rate,defenseRates=reductions)
    heal_cases=0
    for maxHP in [0.,100.,1000.]:
     for percent in [0.,10.,100.]:
      for override in [-1.,0.,500.]:
       for rate in [None,-100.,-35.,0.,20.]:
        for minimum in [-90.,-50.,0.]:
         expected=heal_amount(percent,maxHP,override=override,heal_rate=rate,heal_rate_lower_bound=minimum)
         actual=oracle.heal(percent,maxHP,override,rate,minimum)
         if not math.isclose(actual,expected,rel_tol=2e-12,abs_tol=2e-10):raise AssertionError(('heal',maxHP,percent,override,rate,minimum,actual,expected))
         heal_cases+=1
    result={'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'nativeAddress':'0x3c515f4','cases':cases,'healCases':heal_cases,'healNativeAddress':'0x3c553d0','scope':'CalcFinalDamage ability path plus resolved effect 222 and 224 values; not full active-effect state restoration','testedAbilityFields':names+defenses,'hooks':['actor state getters','resolved DmgRate/DefRate fixtures; other effect iterators empty','numeric value decoder','valor/mental accessors and tanh helpers','attribute/actor-type lookup results','CombatData.MaxDefRate lookup','libc memory functions'],'limitations':['Active effects, proc RNG, armor/groggy multipliers and shield consumption require separate verification.','Numeric storage decoding is supplied as a fixture; ordinary finite doubles only.']}
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(verify(a.native,a.output)))
