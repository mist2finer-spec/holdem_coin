"""Original MapEntityReactorWave scheduler. Not an invented encounter layout.
Source methods OnReceiveMessage/OnAdvance/CheckEndCondition use scene reactors.
"""
from dataclasses import dataclass,replace
import math
from reference_progression import f32

@dataclass(frozen=True)
class Wave:
 wave_no:int
 spawn_delay:float=0.
 repeat:bool=False
 repeat_interval:float=0.
 repeat_count:int=0
 started:bool=False
 trigger_on_start:bool=False
 ended:bool=False
 current_repeat_count:int=0
 timer:float=0.
 def __post_init__(self):
  for field in ['spawn_delay','repeat_interval','timer']:
   value=getattr(self,field)
   if not math.isfinite(value):raise ValueError('Invalid wave timing')
   object.__setattr__(self,field,f32(value))

def receive_wave_message(wave,message,trigger_on_start=False):
 if message!=3 or wave.started:return wave,[]
 return replace(wave,started=True,trigger_on_start=bool(trigger_on_start),timer=f32(wave.spawn_delay)),[('start-wave',wave.wave_no)]

def advance_wave(wave,dt):
 """One native update: overshooting delay clamps to zero and spawns NEXT update.
 Repeat count 0 means unbounded repeats, not zero spawns. No catch-up while loop.
 """
 if not math.isfinite(dt) or dt<0 or not all(math.isfinite(v) for v in [wave.timer,wave.spawn_delay,wave.repeat_interval]):raise ValueError('Invalid wave timing')
 if not wave.started or wave.ended:return wave,[]
 commands=[];timer=f32(wave.timer);count=wave.current_repeat_count
 if timer>0:timer=max(0.,f32(timer-f32(dt)))
 elif wave.repeat and (wave.repeat_count==0 or count<wave.repeat_count):
  commands.append(('spawn-group',wave.wave_no,wave.trigger_on_start));timer=f32(wave.repeat_interval);count+=1
 elif not wave.repeat and timer==0:
  commands.append(('spawn-group',wave.wave_no,wave.trigger_on_start));timer=-1.
 else:commands.append(('check-group-deaths',wave.wave_no))
 return replace(wave,timer=timer,current_repeat_count=count,trigger_on_start=False),commands

def finish_wave(wave,group_alive):
 """Only spawned actors tagged with this wave's group participate in this check.
 Another wave's live actors are not a reason to keep this wave running.
 """
 if not wave.started or wave.ended:return wave,[]
 if any(group_alive):return wave,[]
 return replace(wave,ended=True),[('end-wave',wave.wave_no)]
