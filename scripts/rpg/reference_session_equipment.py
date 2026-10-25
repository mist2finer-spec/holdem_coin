"""Original session equipment reference: stored rows and stored options only.
No server mutation, random reroll generation or speculative condition success.
"""
import math
from reference_equipment import item_abilities,normalize_ability


def decode_option(code):
    if type(code) is not int or not -(2**31)<=code<2**32:
        raise ValueError('Option must be int32/uint32')
    bits=code&0xffffffff
    return {'locked':bool(bits>>31),'grade':(bits>>8)&255,'index':bits&255}


def selected_option_codes(schema,preset_type=0):
    pairs=schema.get('opPresets',[])
    if len(pairs)%2:raise ValueError('Malformed option preset pairs')
    idx=0
    for i in range(0,len(pairs),2):
        if pairs[i]==preset_type:idx=pairs[i+1];break
    return schema.get('ops'+str(idx+1),[]) if 0<=idx<5 else []


def stored_option_values(definition,codes):
    op=definition.get('OpSetData',{});num=op.get('OpNum')
    if num is None:raise ValueError('Missing option slot count')
    rows=op.get('OpDatasByIdx',[]);result=[]
    for slot in range(num):
        code=codes[slot] if slot<len(codes) else 0;decoded=decode_option(code)
        index,grade=decoded['index'],decoded['grade']
        if index>=len(rows):continue  # Native invalid index returns None ability.
        row=rows[index];vals=row.get('AbilValsByGradeIdx',[])
        value=vals[grade-1] if 1<=grade<=len(vals) else 0.
        if not math.isfinite(value):raise ValueError('Non-finite option')
        result.append({'slot':slot,'ability':row['AbilType'],'value':value,**decoded})
    return result


def session_equipment(definitions,owned,equipped,preset_type=0,weapon_kinds=None):
    """Per-type schema rows, not physical duplicate copies. Caller resolves preset equips.

    SessionWeapon/Armor BuildAbilitySet adds Hold for every row, Equip and normal
    options for equipped types, then separately visits conditional HoldOpDatas.
    Unsupported conditions are returned as pending, never granted automatically.
    """
    result={};ledger=[];pending=[];seen=set();equipped=set(equipped)
    if len({v[0] for v in definitions.values()})>1:raise ValueError('Use a separate builder per equipment category')
    def add(ability,value,kind,typ):
        result[ability]=result.get(ability,0.)+value
        ledger.append({'type':typ,'channel':kind,'ability':ability,'value':value})
    for schema in owned:
        typ=schema['type']
        if typ in seen:raise ValueError('Duplicate per-type schema row')
        seen.add(typ)
        if typ not in definitions:raise ValueError('Missing equipment definition')
        category,definition=definitions[typ]
        # Stored count is never a stat multiplier in this builder path.
        for ability,value in item_abilities(definition,schema['level'],category,'Hold'):add(ability,value,'Hold',typ)
        if typ in equipped:
            for ability,value in item_abilities(definition,schema['level'],category,'Equip'):add(ability,value,'Equip',typ)
            if category=='weapon':
                if weapon_kinds is None:raise ValueError('Weapon kind data required')
                kind=weapon_kinds[definition['Kind']]
                for ability,key in [(43,'ExtraAtkSpdRate'),(42,'ExtraDmgRate')]:
                    add(ability,normalize_ability(ability,kind[key]),'WeaponKind',typ)
            codes=selected_option_codes(schema,preset_type)
            for op in stored_option_values(definition,codes):add(op['ability'],op['value'],'StoredOption',typ)
        for op in definition.get('HoldOpDatas',[]):
            conditions=op.get('Conditions')
            if conditions is None:
                unresolved='Conditions' in op.get('_absentDefaultsUnresolved',[])
                if unresolved:pending.append({'type':typ,'ability':op['AbilType'],'reason':'unresolved-conditions'});continue
                conditions=[]
            if not conditions:add(op['AbilType'],op['AbilVal'],'HoldConditional',typ)
            else:
                # All supplied weapon/armor/ring HoldOp definitions have one own-type
                # OpsGrade condition. More complex condition lists stay unresolved.
                condition=conditions[0] if len(conditions)==1 else None
                accepted=own_option_grade_condition(definition,schema,category,condition) if condition else None
                if accepted is True:add(op['AbilType'],op['AbilVal'],'HoldConditional',typ)
                elif accepted is None:pending.append({'type':typ,'ability':op['AbilType'],'value':op['AbilVal'],'conditions':conditions,'reason':'condition-executor-not-restored'})
    missing=equipped-seen
    if missing:raise ValueError('Equipped type has no owned schema row')
    return {'abilities':result,'contributions':ledger,'pending':pending,'complete':not pending}


def breakthrough_status(definition,schema,grade_def,breakthroughs,condition_check=None):
    degree=schema.get('breakthroughDegree',0)
    if type(degree) is not int or degree<0:raise ValueError('Invalid breakthrough degree')
    nxt=next((b for b in breakthroughs if b['Grade']==definition['Grade'] and b['Degree']==degree+1),None)
    if nxt is None:return {'hasNext':False,'allowed':False,'reason':'no-next-definition'}
    current=grade_def['MaxLevel']
    if degree:
        prev=next((b for b in breakthroughs if b['Grade']==definition['Grade'] and b['Degree']==degree),None)
        if prev is None:raise ValueError('Missing current breakthrough definition')
        current=prev['MaxLevel']
    if schema['level']<current:return {'hasNext':True,'allowed':False,'reason':'level-below-current-cap','requiredLevel':current}
    conditions=nxt.get('Conditions')
    if conditions is None:raise ValueError('Unresolved breakthrough conditions')
    checks=[condition_check(c) if condition_check else None for c in conditions]
    allowed=False if any(x is False for x in checks) else None if any(x is None for x in checks) else True
    return {'hasNext':True,'allowed':allowed,'requiredLevel':current,'nextMaxLevel':nxt['MaxLevel'],'conditions':conditions,'conditionResults':checks,'reason':'pending-condition-proof' if allowed is None else 'conditions-evaluated'}


def tanh_difference(a,b,diff,slope,limit):
    if not all(math.isfinite(x) for x in [a,b,diff,slope,limit]) or diff<=0:raise ValueError('Invalid tanh input')
    return limit*math.tanh((a-b)/diff*slope)


def armor_gauge_loss(armor,flags):
    """CalcArmorDamage returns armor/groggy gauge loss, NOT HP damage mitigation."""
    terms=[(1,'DecArmorOnCriHit'),(0x1f0000000,'DecArmorOnPhyDmg'),(0xf800000,'DecArmorOnMagDmg'),(1<<6,'DecArmorOnDefaultAtkDmg'),(1<<7,'DecArmorOnSkillDmg')]
    value=0.
    for mask,key in terms:
        v=armor.get(key,0.)
        if not math.isfinite(v):raise ValueError('Non-finite armor gauge loss')
        if flags&mask and v>0:value+=v
    return value


def own_option_grade_condition(definition,schema,category,condition):
    expected={'weapon':30,'armor':38,'ring':43}.get(category)
    if not condition or condition.get('Type')!=expected or condition.get('V1')!=definition['Type']:return None
    threshold=condition.get('V2')
    if type(threshold) not in (int,float) or not math.isfinite(threshold) or int(threshold)!=threshold:return None
    num=definition.get('OpSetData',{}).get('OpNum')
    if num is None:return None
    # Native checks every option preset (not only the equipped preset).
    return any(sum(decode_option(c)['grade']>=threshold for c in schema.get('ops'+str(i+1),[]))>=num for i in range(5))


def breakthrough_condition(condition,weapon_definitions,owned_weapons,subweapon_definitions,owned_subweapons):
    """Static Session.CheckCondition branches 32/33, bounded to the supplied build.
    None means unsupported; never turn an unknown condition into success.
    """
    typ=condition.get('Type');v1=condition.get('V1');v2=condition.get('V2')
    if typ not in (32,33) or not all(type(v) in (int,float) and math.isfinite(v) and int(v)==v for v in [v1,v2]):return None
    if typ==32:
        definitions=[r for r in weapon_definitions if r['Tier']==1 and r['Grade']==v1]
        count=sum(owned_weapons.get(r['Type'],{}).get('level',-1)>=v2 for r in definitions)
        # Native fallback when no matching grade list exists is a required count of 4.
        required=len(definitions) if definitions else 4
    else:
        definitions=[r for r in subweapon_definitions if r['Tier']==1 and r['Grade']==v1]
        count=sum(owned_subweapons.get(r['Type'],{}).get('level',-1)>=r['MaxLevel'] for r in definitions)
        required=v2
    return count>=required


def encode_option(locked,grade,index):
    if type(locked) is not bool or type(grade) is not int or type(index) is not int or not 0<=grade<=255 or not 0<=index<=255:raise ValueError('Invalid option components')
    bits=(int(locked)<<31)|(grade<<8)|index
    return bits-2**32 if bits>=2**31 else bits


def reroll_cost(definition,locked_count):
    if type(locked_count) is not int or locked_count<0:return None
    costs=definition.get('OpSetData',{}).get('ReqMatCntsByLockedNum')
    # Native returns BigInt(-1) when the index/list is unavailable.
    # Quote API maps that sentinel to None, never to a free reroll.
    if costs is None or locked_count>=len(costs):return None
    value=costs[locked_count]['Value']
    if not math.isfinite(value) or value<0:return None
    return value
