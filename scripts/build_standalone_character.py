"""Build standalone character_animation.html with all 20 frames inlined as base64."""
import base64, json, re
from pathlib import Path

SRC_HTML = Path('/home/z/my-project/src/ui/demo/character_animation.html')
OUT_HTML = Path('/home/z/my-project/download/character_animation_standalone.html')
CHAR_DIR = Path('/home/z/my-project/src/ui/assets/character')

OUT_HTML.parent.mkdir(parents=True, exist_ok=True)

html = SRC_HTML.read_text(encoding='utf-8')

# Build FRAMES dictionary with inlined data URIs instead of relative paths
frames_inlined = {
    'right-attack': [],
    'right-walk':   [],
    'left-attack':  [],
    'left-walk':    [],
}
for direction in ['right', 'left']:
    for action in ['attack', 'walk']:
        for i in range(1, 6):
            fn = f'frame_{direction}_{action}_{i:02d}.png'
            p = CHAR_DIR / fn
            if not p.exists():
                print(f'  WARN: {p} not found')
                continue
            b64 = base64.b64encode(p.read_bytes()).decode('ascii')
            frames_inlined[f'{direction}-{action}'].append(f'data:image/png;base64,{b64}')

# Convert to JS literal
frames_js = 'const FRAMES = ' + json.dumps(frames_inlined, indent=2) + ';'

# Also inline the ASSET_BASE const so it's empty (frames are now data URIs)
html = re.sub(
    r"const ASSET_BASE = '[^']*';",
    "const ASSET_BASE = '';  // unused — FRAMES now contains data URIs",
    html,
)

# Replace the FRAMES = {...} block (which uses relative paths) with the inlined version
# Find: const FRAMES = { ... };  (multi-line)
pattern = re.compile(r'const FRAMES = \{[^}]+\};', re.DOTALL)
html = pattern.sub(frames_js, html)

# Also remove the img.src = `${ASSET_BASE}/${fn}` line, replace with img.src = fn
# (since fn now IS the data URI)
html = html.replace(
    "img.src = `${ASSET_BASE}/${fn}`;",
    "img.src = fn;  // fn is now a data URI",
)

OUT_HTML.write_text(html, encoding='utf-8')
size_kb = OUT_HTML.stat().st_size / 1024
print(f'wrote: {OUT_HTML}')
print(f'size:  {size_kb:.1f} KB')
print(f'inlined: {sum(len(v) for v in frames_inlined.values())} frames')
