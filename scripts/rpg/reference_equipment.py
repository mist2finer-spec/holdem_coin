"""Offline, audited-build equipment evaluator. Not the live web combat balance.
Values are keyed by original numeric ability IDs. No random option rolls or server charges.
"""
import math
from vardian_cost import calc_segments


def require_level(level):
    if type(level) is not int or not 0 <= level < 2**31:
        raise ValueError('Level must be a non-negative int32')


def normalize_ability(ability, value):
    if not math.isfinite(value):
        raise ValueError('Non-finite ability')
    # Native CalcAbilityValue: core Atk..Focus round to integer; others to 2 digits.
    # .NET midpoint-to-even; do not use Python round(value, 2), whose algorithm differs.
    digits = 0 if 7 <= ability <= 12 else 2
    multiplier = 10**digits
    if abs(value) >= 1e16:
        return value  # .NET Math.Round decimal-digit path leaves large doubles unchanged.
    return float(round(value*multiplier)/multiplier)


def step_ability(row, level):
    require_level(level)
    mins, bases, incs = (row.get(k, []) for k in ('MinLevels','AbilBaseVals','AbilIncVals'))
    if not mins or not len(mins) == len(bases) == len(incs):
        raise ValueError('Missing or mismatched step arrays')
    if any(type(x) is not int for x in mins) or any(a >= b for a,b in zip(mins,mins[1:])):
        raise ValueError('Steps must be strictly increasing integers')
    value = 0.
    for minimum, base, inc in zip(mins,bases,incs):
        if minimum > level:
            break
        # Native overwrites the selected segment value; it does NOT sum segments.
        value = base + inc*(level-minimum)
    return normalize_ability(row['AbilType'], value)


def item_abilities(row, level, category, channel):
    require_level(level)
    if category not in ('weapon','armor','ring') or channel not in ('Equip','Hold'):
        raise ValueError('Unknown equipment category/channel')
    if row.get('UseStep'+channel+'AbilData'):
        steps = row.get('Step'+channel+'AbilDatas')
        if steps is None:
            raise ValueError('Unresolved step data')
        return [(r['AbilType'],step_ability(r,level)) for r in steps]
    keys = [channel+'AbilTypes',channel+'AbilBaseVals',channel+'AbilIncVals']
    if any(k not in row for k in keys):
        raise ValueError('Unresolved linear ability data')
    types,bases,incs = (row[k] for k in keys)
    if not len(types)==len(bases)==len(incs):
        raise ValueError('Mismatched linear ability arrays')
    # Confirmed ARM64: ring uses L; weapon and armor use L-1.
    delta = level if category == 'ring' else level-1
    return [(t,normalize_ability(t,b+i*delta)) for t,b,i in zip(types,bases,incs)]


def equipment_cost(row, level):
    require_level(level)
    if level >= row['MaxLevel']:
        return None
    curves = row.get('ReqLevelUpMatFuncDatas')
    if curves is None:
        raise ValueError('Missing upgrade curve')
    cost = calc_segments(curves,level)
    if cost <= 0:
        return None  # No free upgrades on missing/out-of-range curves.
    return {'materialType':row['ReqLevelUpMatType'],'amount':cost}


def aggregate_equipment(entries):
    """Explicit contribution ledger; caller must supply eligible owned/equipped items.

    Does not guess original ownership/dedup/slot policy. Options enter only after
    their native generation/unlock rules have been separately established.
    """
    values={};ledger=[]
    for entry in entries:
        category,row,level=entry['category'],entry['definition'],entry['level']
        for channel in entry['channels']:
            for ability,value in item_abilities(row,level,category,channel):
                values[ability]=values.get(ability,0.)+value
                ledger.append({'category':category,'type':row['Type'],'level':level,
                               'channel':channel,'ability':ability,'value':value})
    return {'abilities':values,'contributions':ledger}


def final_stat(abilities, formula, flags=0):
    """Execute a recovered ordered multiplication plan; not a full damage solver."""
    if type(flags) is not int or not 0 <= flags < 2**64:
        raise ValueError('Flags must be uint64')
    value=float(abilities.get(formula['base'],0.))
    if not math.isfinite(value):raise ValueError('Non-finite base stat')
    trace=[]
    for term in formula['factors']:
        if term.get('mask') and not flags & int(term['mask'],16):continue
        rate=float(abilities.get(term['field'],0.))
        if not math.isfinite(rate):raise ValueError('Non-finite factor')
        value *= 1.+rate/100.
        trace.append({'field':term['field'],'rate':rate,'result':value})
    if not math.isfinite(value) or abs(value)>=2**53:
        raise ValueError('Stat exceeds safe reference integer range')
    return {'value':max(0.,float(round(value))),'trace':trace}
