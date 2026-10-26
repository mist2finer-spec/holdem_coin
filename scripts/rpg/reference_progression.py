"""Audited-build growth arithmetic, separate from the web prototype's test balance.

Numeric evaluators mirror recovered ARM64. Quotes are offline planning, not claims
about the original server's purchase, RNG or condition-execution policies.
"""
import math
import struct
from reference_equipment import normalize_ability, require_level, final_stat
from reference_session_equipment import session_equipment
from vardian_cost import calc_segments


class Unresolved(ValueError):
    """Required evidence is absent; never silently grant a bonus or free upgrade."""


def f32(value):
    if not math.isfinite(value):
        raise ValueError('Non-finite skill parameter')
    return struct.unpack('<f', struct.pack('<f', value))[0]


def pairs(row, types='AbilTypes', values='AbilVals', nullable=False):
    # Only callers backed by proven native null-vector count paths use nullable.
    if nullable and types not in row and values not in row:
        return []
    if types not in row or values not in row or len(row[types]) != len(row[values]):
        raise Unresolved('Missing/mismatched '+types+'/'+values)
    return [(i, normalize_ability(i, v)) for i, v in zip(row[types], row[values])]


def combat_art_value(row, level):
    require_level(level)
    return normalize_ability(row['AbilType'], row['AbilValInc']*level)


def trait_value(row, level):
    require_level(level)
    # Native returns zero above MaxLevel; it does not clamp to MaxLevel.
    if level > row['MaxLevel']:
        return 0.
    return normalize_ability(row['AbilType'], row['AbilValInc']*level)


def skill_hold_values(row, level):
    require_level(level)
    keys=['HoldAbilTypes','HoldAbilVals','HoldAbilIncs']
    if any(k not in row for k in keys):
        raise Unresolved('Missing skill holding arrays')
    ids, bases, increments=(row[k] for k in keys)
    if not len(ids)==len(bases)==len(increments):
        raise Unresolved('Mismatched skill holding arrays')
    return [(a,normalize_ability(a,b+i*(level-1))) for a,b,i in zip(ids,bases,increments)]


def skill_awaken_values(row, level):
    require_level(level)
    result=[]
    if level==0:
        return result
    if 'AwakenAbilityDatas' not in row:
        raise Unresolved('Missing awakening definitions')
    for a in row['AwakenAbilityDatas']:
        if a['AbilType'] and level<=len(a['AbilVals']):
            result.append((a['AbilType'],normalize_ability(a['AbilType'],a['AbilVals'][level-1])))
    return result


def skill_parameters(row, level):
    """GetParamData: method0 selects L-1; method1 uses float32 base+inc*(L-1)."""
    require_level(level)
    rows=row.get('ParamDatas')
    if rows is None:
        raise Unresolved('Missing skill parameter rows')
    method=row['ParamCalcMethod']
    if method==0:
        if level<1 or level>len(rows):
            return [0.]*9
        return [f32(rows[level-1]['V'+str(i)]) for i in range(1,10)]
    if method==1:
        if len(rows)!=2:
            return [0.]*9
        n=f32(level-1)
        return [f32(f32(rows[0]['V'+str(i)])+f32(f32(rows[1]['V'+str(i)])*n)) for i in range(1,10)]
    return [0.]*9


def will_values(table, grade, level):
    require_level(level)
    if type(grade) is not int or grade<0:raise ValueError('Invalid will grade')
    row=next((r for r in table['WillGradeDatas'] if r['Grade']==grade),None)
    if row is None or not 0<=level<=row['Level']:
        raise ValueError('Invalid will grade/level')
    result=pairs(row,nullable=True)
    for a,v in zip(table['WillAbilTypes'],table['WillAbilIncPerLevels']):
        result.append((a,normalize_ability(a,v*level)))
    return result


def art_requirements(table, type_id, current, levels):
    row=next(r for r in table['CombatArtDatas'] if r['Type']==type_id)
    missing=[]
    if row['ReqAllPrevMax']:
        missing.extend({'type':r['Type'],'level':r['MaxLevel']} for r in table['CombatArtDatas']
                       if r['Tier']==row['Tier']-1 and levels.get(r['Type'],0)<r['MaxLevel'])
    if row['ReqType'] and levels.get(row['ReqType'],0)<row['ReqLevel']:
        missing.append({'type':row['ReqType'],'level':row['ReqLevel']})
    # These rows name a target level: reaching Level requires ReqType at ReqLevel.
    for preq in table['CombatArtLevelPreqDatas']:
        if preq['Type']==type_id and current+1>=preq['Level'] and levels.get(preq['ReqType'],0)<preq['ReqLevel']:
            missing.append({'type':preq['ReqType'],'level':preq['ReqLevel']})
    return missing


def curve_quote(curves, current, maximum, count, material, *, level_offset=0, budget=None):
    """No mutation. Caller must explicitly select recovered UI level convention."""
    require_level(current)
    if type(count) is not int or not 1<=count<=10000:
        raise ValueError('Count must be 1..10000')
    if current>maximum:
        raise ValueError('Level exceeds cap')
    if budget is not None and (not math.isfinite(budget) or budget<0):
        raise ValueError('Invalid budget')
    total=0.;steps=[];stop='requested-count'
    for level in range(current,min(maximum,current+count)):
        amount=calc_segments(curves,level+level_offset)
        if amount<=0:
            stop='missing-or-zero-cost';break
        if budget is not None and total+amount>budget:
            stop='insufficient-material';break
        total+=amount
        if not math.isfinite(total):
            raise ValueError('Non-finite total cost')
        steps.append({'from':level,'to':level+1,'curveLevel':level+level_offset,'cost':amount})
    if current+len(steps)==maximum:
        stop='max-level'
    return {'materialType':material,'current':current,'maximum':maximum,'quantity':len(steps),
            'total':total,'steps':steps,'stop':stop,'arithmetic':'binary64-with-intermediate-floors'}


def evaluate_growth(tables, profile, enum_map, plans):
    """Explicit stored profile subset. Unknown condition/effect systems stay pending."""
    values={};ledger=[];pending=[];used_traits=0;skill_views=[]
    def add(source, ident, entries):
        for ability,value in entries:
            values[ability]=values.get(ability,0.)+value
            ledger.append({'source':source,'type':ident,'ability':ability,'value':value})
    team=tables['TeamData'];add('team-base',0,pairs(team,'BaseAbilTypes','BaseAbilVals'))
    for cat,tab,key in [('weapon','WeaponData','WeaponDatas'),('armor','ArmorData','ArmorDatas'),('ring','RingData','RingDatas')]:
        group=profile.get(cat,{'owned':[],'equipped':[]});d=tables[tab]
        if len(group['equipped'])>len(d.get(cat.title()+'SlotDatas',[])):
            raise ValueError('Too many equipped slots')
        definitions={r['Type']:r for r in d[key]}
        for owned in group['owned']:
            row=definitions[owned['type']];require_level(owned['level'])
            cap=next(g['MaxLevel'] for g in d['WeaponGradeDatas'] if g['Tier']==row['Tier'] and g['Grade']==row['Grade']) if cat=='weapon' else row['MaxLevel']
            if not 1<=owned['level']<=cap:
                raise Unresolved('Equipment level outside base cap; resolve breakthrough context separately')
        result=session_equipment({r['Type']:(cat,r) for r in d[key]},group['owned'],group['equipped'],group.get('presetType',0),{r['Kind']:r for r in tables['WeaponData']['WeaponKindDatas']})
        add(cat,0,list(result['abilities'].items()));pending.extend(result['pending'])
    art_rows={r['Type']:r for r in tables['CombatArtData']['CombatArtDatas']}
    for key,level in profile.get('combatArts',{}).items():
        row=art_rows[int(key)];require_level(level)
        if level>row['MaxLevel']:
            raise ValueError('Combat art above cap')
        add('combat-art',row['Type'],[(row['AbilType'],combat_art_value(row,level))])
    trait_rows={r['Type']:r for r in tables['TraitData']['TraitDatas']}
    for key,level in profile.get('traits',{}).items():
        row=trait_rows[int(key)];require_level(level)
        if level>row['MaxLevel']:
            raise ValueError('Trait above cap')
        used_traits+=level;add('trait',row['Type'],[(row['AbilType'],trait_value(row,level))])
    mastery=profile.get('masteryType')
    unlocks=None
    if mastery is not None:
        row=next(r for r in tables['MasteryData']['MasteryDatas'] if r['Type']==mastery)
        add('mastery-snapshot',mastery,pairs(row,nullable=True))
        unlocks={k:row[k] for k in ['UnlockPowerBlow','UnlockFinishBlow']}
    if 'will' in profile:
        will=profile['will'];add('will',will['grade'],will_values(tables['WillData'],will['grade'],will['level']))
    skills={r['Type']:r for r in tables['SkillData']['SkillDatas']};grades={r['Grade']:r for r in tables['SkillData']['SkillGradeDatas']};seen=set()
    for owned in profile.get('skills',[]):
        row=skills[owned['type']];level=owned['level'];awake=owned.get('awakenLevel',0)
        if row['Type'] in seen:
            raise ValueError('Duplicate skill schema')
        seen.add(row['Type']);require_level(level);require_level(awake)
        if row['Grade'] not in grades:
            raise Unresolved('Grade-zero skill needs its owning artifact/monster system level convention')
        if not 1<=level<=grades[row['Grade']]['MaxLevel'] or awake>row['AwakenMaxLevel']:
            raise ValueError('Skill level/awakening above cap')
        add('skill-hold',row['Type'],skill_hold_values(row,level));add('skill-awaken',row['Type'],skill_awaken_values(row,awake))
        skill_views.append({'type':row['Type'],'level':level,'parameters':skill_parameters(row,level),'flag':row['Flag'],'parameterMeaning':'not interpreted as damage without ActionData context'})
    limits=[]
    for a,maximum in zip(team['MaxAbilTypes'],team['MaxAbilVals']):
        if values.get(a,0)>maximum:
            limits.append({'ability':a,'before':values[a],'after':maximum});values[a]=maximum
    named={};unmapped=[]
    for a,v in values.items():
        if a in enum_map:named[enum_map[a]]=v
        elif v:unmapped.append({'ability':a,'value':v})
    pending.extend({'reason':'unmapped-stat-field',**r} for r in unmapped)
    unsupported=set(profile)-{'weapon','armor','ring','combatArts','traits','masteryType','will','skills','damageFlags'}
    pending.extend({'reason':'profile-system-not-executed','system':s} for s in sorted(unsupported))
    return {'scope':'explicit owned/equipped items + selected art/trait/mastery/will/skill numeric contributions',
            'completeForRequestedSubset':not pending,'abilities':values,'namedAbilities':named,'contributions':ledger,'limits':limits,
            'traitPointsUsed':used_traits,'traitPointPerLevelConfig':tables['TraitData']['TraitPointPerLevel'],
            'masteryUnlocks':unlocks,'skills':skill_views,'pending':pending,
            'attack':final_stat(named,plans['attack'],profile.get('damageFlags',0)),
            'hp':final_stat(named,plans['hp']),
            'notClaimed':['whole combat damage/effects','all growth systems session aggregation','server transactions','RNG','trait adjacency/unlock purchasing']}
