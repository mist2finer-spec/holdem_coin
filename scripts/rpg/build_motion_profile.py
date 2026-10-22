"""Generate asset-verified motion lengths. No guessed combat timings in this file."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/rpg/Hero_Axe01.json'


def times(value):
    if isinstance(value, dict):
        if isinstance(value.get('time'), (int, float)):
            yield value['time']
        for child in value.values():
            yield from times(child)
    elif isinstance(value, list):
        for child in value:
            yield from times(child)


if __name__ == '__main__':
    raw = SOURCE.read_bytes()
    data = json.loads(raw)
    profile = {'evidence': 'ASSET_VERIFIED', 'source': 'public/rpg/Hero_Axe01.json',
               'sha256': hashlib.sha256(raw).hexdigest(), 'spine': data['skeleton']['spine'],
               'durations': {name: max(times(anim), default=0) for name, anim in data['animations'].items()},
               'attackHitEventsPresent': any(anim.get('events') for name, anim in data['animations'].items()
                                             if name.startswith('attack'))}
    (ROOT / 'src/components/rpg/motion-profile.json').write_text(json.dumps(profile, indent=2) + '\n')
    print('MOTION_PROFILE_GENERATED')
