"""InHouse.Core.RandomUtil.SelectIndex, caller-supplied integer RNG output.
This utility does not establish RewardGroup/PickNTimes replacement semantics.
"""
def weighted_index(weights,draw=None,*,signed=True):
 if any(type(w) is not int or (not signed and not 0<=w<=65535) for w in weights):raise ValueError('Invalid native weight type/range')
 if signed and any(not -(2**31)<=w<2**31 for w in weights):raise ValueError('Invalid int32 weight')
 values=[max(0,w) if signed else w for w in weights];total=sum(values)
 if total>2**31-1:raise ValueError('Native signed sum overflow is outside supported weight domain')
 if total==0:return -1
 if type(draw) is not int or not 0<=draw<total:raise ValueError('Original RNG integer draw must be in [0,total-1]')
 for i,w in enumerate(values):
  draw-=w
  if draw<0:return i
 return -1
