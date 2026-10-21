"""
Build a self-contained preview.html with all assets inlined as base64 data URLs.

Strategy (line-based, regex-free for the JS function swap):
  1. CSS url(../assets/...) references → inlined as data: URIs (regex OK here, no nesting)
  2. The `renderChips` function is replaced by a version that looks up
     CHIPS_BASE64[id] instead of ../assets/... — replaced by finding the
     exact line range and substituting the whole block.
  3. CHIPS_BASE64 dictionary injected right before the final init call.
"""
import base64, json, re
from pathlib import Path

SRC_HTML = Path('/home/z/my-project/src/ui/demo/preview.html')
OUT_HTML = Path('/home/z/my-project/download/preview_standalone.html')
OUT_HTML.parent.mkdir(parents=True, exist_ok=True)

lines = SRC_HTML.read_text(encoding='utf-8').splitlines(keepends=True)

# ── 1. Inline CSS url(../assets/...) references ────────────────────────────
def inline_css_url(match):
    rel = match.group(1).strip('"\'').strip()
    abs_path = Path('/home/z/my-project/src/ui/demo') / rel
    if not abs_path.exists():
        return match.group(0)
    mime = 'image/png' if abs_path.suffix.lower() == '.png' else 'image/jpeg'
    b64 = base64.b64encode(abs_path.read_bytes()).decode('ascii')
    return f'url("data:{mime};base64,{b64}")'

# Apply CSS url() inlining across all lines
lines = [re.sub(r'url\((\.\./assets/[^)]+)\)', inline_css_url, ln) for ln in lines]

# ── 2. Build CHIPS_BASE64 dictionary ───────────────────────────────────────
chips_dir = Path('/home/z/my-project/src/ui/assets/chips')
chips_b64 = {}
for i in range(1, 11):
    p = chips_dir / f'Chip_{i:02d}.png'
    if not p.exists():
        continue
    b64 = base64.b64encode(p.read_bytes()).decode('ascii')
    chips_b64[f'Chip_{i:02d}'] = f'data:image/png;base64,{b64}'
chips_js_line = 'const CHIPS_BASE64 = ' + json.dumps(chips_b64) + ';\n'

# ── 3. Find and replace the renderChips function (line-range based) ────────
# Locate the line starting with "  function renderChips() {"
start_idx = None
for i, ln in enumerate(lines):
    if ln.strip() == 'function renderChips() {':
        start_idx = i
        break
if start_idx is None:
    raise RuntimeError('renderChips function not found in source HTML')

# Find the matching closing brace at column 2 (matching the function's indentation)
end_idx = None
for j in range(start_idx + 1, len(lines)):
    if lines[j].rstrip() == '  }':
        end_idx = j
        break
if end_idx is None:
    raise RuntimeError('closing brace for renderChips not found')

new_render_chips_lines = [
    '  function renderChips() {\n',
    '    const gallery = document.getElementById(\'chip-gallery\');\n',
    '    let html = \'\';\n',
    '    for (let i = 1; i <= 10; i++) {\n',
    '      const num = String(i).padStart(2, \'0\');\n',
    '      const id = \'Chip_\' + num;\n',
    '      const url = CHIPS_BASE64[id] || \'\';\n',
    '      html += `\n',
    '        <div class="chip-card">\n',
    '          <img src="${url}" alt="Chip ${num}" loading="lazy">\n',
    '          <div class="mt-2 text-xs gold-text font-mono">Chip_${num}</div>\n',
    '          <div class="text-[10px] text-amber-300/40">1024×1024 PNG</div>\n',
    '        </div>`;\n',
    '    }\n',
    '    gallery.innerHTML = html;\n',
    '  }\n',
]

lines[start_idx:end_idx + 1] = new_render_chips_lines

# ── 4. Inject CHIPS_BASE64 right before the final "render();" call ────────
# Find the line "  render();\n  renderChips();\n" and prepend CHIPS_BASE64
init_idx = None
for i, ln in enumerate(lines):
    if ln.strip() == 'render();' and i + 1 < len(lines) and lines[i + 1].strip() == 'renderChips();':
        init_idx = i
        break
if init_idx is None:
    raise RuntimeError('init block (render(); renderChips();) not found')

lines.insert(init_idx, chips_js_line)

OUT_HTML.write_text(''.join(lines), encoding='utf-8')
size_kb = OUT_HTML.stat().st_size / 1024
print(f'wrote: {OUT_HTML}')
print(f'size:  {size_kb:.1f} KB')
print(f'inlined: 10 chip PNGs as base64, 1 leaderboard gold frame as CSS data URL')
