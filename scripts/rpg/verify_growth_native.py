"""Compare numeric growth evaluators with the supplied ARM64 build in Unicorn.

Requires capstone/pyelftools/unicorn only for this independent offline check.
List getters, .NET decimal rounding and libc modf are hooked; growth arithmetic,
branching, float32 SIMD and index selection execute original instructions.
"""
import argparse,hashlib,json,math,struct
from pathlib import Path
from elftools.elf.elffile import ELFFile
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import *
from reference_progression import combat_art_value,trait_value,skill_hold_values,skill_parameters,skill_awaken_values
from reference_equipment import normalize_ability


def verify(native,decoded,output):
    raw=native.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    if digest!='42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5':
        raise ValueError('Native build hash mismatch')
    with native.open('rb') as f:
        elf=ELFFile(f);loads=[dict(s.header) for s in elf.iter_segments() if s['p_type']=='PT_LOAD']
    u=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
    regions=[(0x6b5d000,0x1000),(0x6b61000,0x6000),(0x6b3e000,0x1000),(0x6da3000,0x1000),(0x7b82000,0x1000),(0x8405000,0x1000),(0x7fd9000,0x6000),(0x8014000,0x1000),(0x5316000,0x1000),(0x555d000,0x1000),(0x100000,0x40000)]
    for a,size in regions:
        u.mem_map(a,size);seg=next((s for s in loads if s['p_vaddr']<=a<s['p_vaddr']+s['p_filesz']),None)
        if seg:u.mem_write(a,raw[a-seg['p_vaddr']+seg['p_offset']:a-seg['p_vaddr']+seg['p_offset']+size])
    u.mem_write(0x8405000,b'\1'*4096)
    for a in [0x7fd9000,0x7fda000,0x7fdb000,0x7fdc000,0x7fdd000,0x7fde000,0x8014000]:u.mem_write(a,struct.pack('<Q',0x120000)*512)
    u.mem_write(0x120000,struct.pack('<Q',0x121000));u.mem_write(0x1210e4,struct.pack('<I',1))
    lists={};ids=[];counts={}
    def dget():return struct.unpack('<d',struct.pack('<Q',u.reg_read(UC_ARM64_REG_D0)))[0]
    def dset(v):u.reg_write(UC_ARM64_REG_D0,struct.unpack('<Q',struct.pack('<d',v))[0])
    def hook(emu,a,size,data):
        x0=emu.reg_read(UC_ARM64_REG_X0);idx=emu.reg_read(UC_ARM64_REG_X1)&0xffffffff
        if a in [0x6b64c34,0x6b61574,0x6b66558,0x6b66800]:emu.reg_write(UC_ARM64_REG_X0,ids[idx])
        elif a==0x5316a90:dset(lists[x0][idx])
        elif a==0x555d95c:emu.mem_write(emu.reg_read(UC_ARM64_REG_X8),struct.pack('<9f',*lists[x0][idx]))
        elif a==0x7b82b90:
            frac,whole=math.modf(dget());emu.mem_write(x0,struct.pack('<d',whole));dset(frac)
        elif a==0x6da3374:
            if x0!=2 or idx!=0:raise AssertionError('Unexpected .NET rounding overload')
            v=dget();dset(v if abs(v)>=1e16 else round(v*100)/100)
        else:return
        emu.reg_write(UC_ARM64_REG_PC,emu.reg_read(UC_ARM64_REG_X30))
    u.hook_add(UC_HOOK_CODE,hook)
    def li(a,vals):lists[a]=vals;u.mem_write(a+0x18,struct.pack('<I',len(vals)));return a
    def ptr(off,a):u.mem_write(0x100000+off,struct.pack('<Q',a))
    def execute(start,idx,level=None,kind='numeric'):
        u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20);u.reg_write(UC_ARM64_REG_SP,0x13e000);u.reg_write(UC_ARM64_REG_X0,0x100000);u.reg_write(UC_ARM64_REG_X1,idx);u.reg_write(UC_ARM64_REG_X2,level or 0);u.reg_write(UC_ARM64_REG_X8,0x110000);u.reg_write(UC_ARM64_REG_X30,0x13f000)
        u.emu_start(start,0x13f000,timeout=300000,count=10000)
        if u.reg_read(UC_ARM64_REG_PC)!=0x13f000:raise AssertionError('Native did not return')
        counts[kind]=counts.get(kind,0)+1
        return list(struct.unpack('<9f',u.mem_read(0x110000,36))) if kind=='skill-parameters' else dget()
    load=lambda n:json.loads((decoded/(n+'.json')).read_text())
    for category,key,addr in [('CombatArtData','CombatArtDatas',0x6b5d7f4),('TraitData','TraitDatas',0x6b65930)]:
        for row in load(category)[key]:
            for lv in sorted(set([0,1,2,row['MaxLevel']//2,row['MaxLevel'],row['MaxLevel']+1])):
                u.mem_write(0x100000,b'\0'*256)
                if category=='CombatArtData':u.mem_write(0x100006,struct.pack('<Hd',row['AbilType'],row['AbilValInc']));expected=combat_art_value(row,lv)
                else:
                    u.mem_write(0x10000a,struct.pack('<H',row['AbilType']));u.mem_write(0x100010,struct.pack('<dH',row['AbilValInc'],row['MaxLevel']));expected=trait_value(row,lv)
                actual=execute(addr,lv,kind=category)
                if actual!=expected:raise AssertionError((category,row['Type'],lv,actual,expected))
    skills=load('SkillData')
    for row in skills['SkillDatas']:
        maximum=next((g['MaxLevel'] for g in skills['SkillGradeDatas'] if g['Grade']==row['Grade']),max(12,len(row['ParamDatas'])))
        ids=row.get('HoldAbilTypes',[]);u.mem_write(0x100000,b'\0'*256)
        for off,vals,a in [(0x18,ids,0x102000),(0x20,row.get('HoldAbilVals',[]),0x103000),(0x28,row.get('HoldAbilIncs',[]),0x104000)]:ptr(off,li(a,vals))
        for lv in [1,2,maximum]:
            for i,(_,expected) in enumerate(skill_hold_values(row,lv) if ids else []):
                actual=execute(0x6b64cb4,i,lv,kind='skill-hold')
                if actual!=expected:raise AssertionError(('skill-hold',row['Type'],i,lv,actual,expected))
        u.mem_write(0x100000,b'\0'*256);u.mem_write(0x100054,bytes([row['ParamCalcMethod']]))
        ptr(0x58,li(0x102000,[[p['V'+str(i)] for i in range(1,10)] for p in row['ParamDatas']]))
        for lv in range(0,maximum+2):
            expected=skill_parameters(row,lv);actual=execute(0x6b64f38,lv,kind='skill-parameters')
            if actual!=expected:raise AssertionError(('skill-parameters',row['Type'],lv,actual,expected))
        for awake in row.get('AwakenAbilityDatas',[]):
            u.mem_write(0x100000,struct.pack('<H6xQ',awake['AbilType'],li(0x102000,awake['AbilVals'])))
            for lv in range(0,len(awake['AbilVals'])+2):
                expected=normalize_ability(awake['AbilType'],awake['AbilVals'][lv-1]) if awake['AbilType'] and 1<=lv<=len(awake['AbilVals']) else 0
                actual=execute(0x6b64b54,lv,kind='skill-awaken')
                if actual!=expected:raise AssertionError(('skill-awaken',row['Type'],lv,actual,expected))
    for table,key,method in [('MasteryData','MasteryDatas',0x6b615cc),('WillData','WillGradeDatas',0x6b665d8)]:
        for row in load(table)[key]:
            ids=row.get('AbilTypes',[]);values=row.get('AbilVals',[]);u.mem_write(0x100000,b'\0'*256)
            if table=='MasteryData':ptr(0x18,li(0x102000,values))
            else:ptr(0x40,li(0x102000,values))
            for i,(a,v) in enumerate(zip(ids,values)):
                actual=execute(method,i,kind=table);expected=normalize_ability(a,v)
                if actual!=expected:raise AssertionError((table,i,actual,expected))
    table=load('WillData');ids=table['WillAbilTypes'];u.mem_write(0x100000,b'\0'*256);ptr(0,li(0x102000,ids));ptr(8,li(0x103000,table['WillAbilIncPerLevels']))
    for lv in [0,1,2,99,100,1000,10000]:
        for i,(a,inc) in enumerate(zip(ids,table['WillAbilIncPerLevels'])):
            actual=execute(0x6b66880,i,lv,kind='will-per-level');expected=normalize_ability(a,inc*lv)
            if actual!=expected:raise AssertionError(('will',i,lv,actual,expected))
    result={'nativeSha256':digest,'cases':counts,'total':sum(counts.values()),'scope':'numeric evaluators only; no server/RNG/whole-session emulator','hooks':['list element getters','ability type getters','libc modf','.NET Round overload2']}
    output.write_text(json.dumps(result,indent=2));return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['native','decoded','output']:p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args();print(json.dumps(verify(a.native,a.decoded,a.output)))
