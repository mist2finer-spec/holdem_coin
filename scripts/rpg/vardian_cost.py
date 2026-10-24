"""Offline reconstruction of the supplied ARM64 build's quadratic evaluator.

No gameplay integration. Values use binary64 and the original intermediate floors.
Runtime struct offsets: min/max 0/4, base/inc/rate/scaler 8/16/24/32.
"""
import math
import struct


def rounded(value):
    if not math.isfinite(value):
        raise ValueError('Non-finite cost arithmetic')
    return float(math.floor(value))


def calc_segment(segment, level):
    if type(level) is not int or not -(2**31) <= level < 2**31:
        raise ValueError('Level must be int32')
    minimum, maximum = segment['MinLevel'], segment['MaxLevel']
    base, inc, rate, scaler = (float(segment[k]['Value']) for k in ('BaseValue','IncValue','IncRate','Scaler'))
    if not all(math.isfinite(v) for v in (base,inc,rate,scaler)):
        raise ValueError('Non-finite coefficients')
    if scaler == 0 or level < minimum or level >= maximum:
        return 0.0
    n = float(struct.unpack('<f', struct.pack('<f', level - minimum))[0])
    quadratic = rounded(rounded(rate*n)*n)
    half = rounded(scaler*0.5)
    quadratic = rounded(rounded(quadratic+half)/scaler)
    linear = rounded(inc*n)
    return rounded(linear+rounded(base+quadratic))


def calc_segments(segments, level):
    for segment in segments:
        if segment['MinLevel'] <= level < segment['MaxLevel']:
            return calc_segment(segment, level)
    return 0.0
