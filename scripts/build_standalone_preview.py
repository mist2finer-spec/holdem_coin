"""
Build a self-contained preview.html with ALL assets inlined as base64 data URLs.
(Recreated after stash mishap)
"""
import base64, json, re
from pathlib import Path

SRC_HTML = Path('/home/z/my-project/src/ui/demo/preview.html')
OUT_HTML = Path('/home/z/my-project/download/preview_standalone.html')
OUT_HTML.parent.mkdir(parents=True, exist_ok=True)

ASSETS_ROOT = Path('/home/z/my-project/src/ui/assets')

# ── 1. Inline CSS url(../assets/...) references ────────────────────────────
lines = SRC_HTML.read_text(encoding='utf-8').splitlines(keepends=True)

def inline_css_url(match):
    rel = match.group(1).strip('"\'').strip()
    abs_path = Path('/home/z/my-project/src/ui/demo') / rel
    if not abs_path.exists():
        return match.group(0)
    mime = 'image/png' if abs_path.suffix.lower() == 'png' else 'image/jpeg'
    b64 = base64.b64encode(abs_path.read_bytes()).decode('ascii')
    return f'url("data:{mime};base64,{b64}")'

lines = [re.sub(r'url\((\.\./assets/[^)]+)\)', inline_css_url, ln) for ln in lines]

# ── 2. Build asset dictionaries ─────────────────────────────────────────────
def collect_assets(subdir, predicate):
    out = {}
    root = ASSETS_ROOT / subdir
    if not root.exists():
        return out
    for p in root.rglob('*'):
        if p.is_file() and predicate(p):
            mime = 'image/png' if p.suffix.lower() == '.png' else 'image/jpeg'
            b64 = base64.b64encode(p.read_bytes()).decode('ascii')
            out[p.name] = f'data:{mime};base64,{b64}'
    return out

chips_b64    = collect_assets('chips',    lambda p: p.suffix.lower() == '.png')
currency_b64 = collect_assets('currency', lambda p: p.suffix.lower() == '.png')
store_b64    = collect_assets('store',    lambda p: p.suffix.lower() == '.png')
shop_b64     = collect_assets('shop',     lambda p: p.suffix.lower() in ('.png', '.jpg', '.jpeg'))

chips_js    = 'const CHIPS_BASE64 = ' + json.dumps(chips_b64) + ';\n'
currency_js = 'const CURRENCY_BASE64 = ' + json.dumps(currency_b64) + ';\n'
store_js    = 'const STORE_BASE64 = ' + json.dumps(store_b64) + ';\n'
shop_js     = 'const SHOP_BASE64 = ' + json.dumps(shop_b64) + ';\n'

combined_js = (
    '  // ── Inlined asset dictionaries (auto-generated) ──\n' +
    '  ' + chips_js +
    '  ' + currency_js +
    '  ' + store_js +
    '  ' + shop_js +
    '\n'
)

asset_helper_js = (
    '  function asset(relpath) {\n'
    '    const parts = relpath.split("/");\n'
    '    if (parts.length < 2) return relpath;\n'
    '    const filename = parts[parts.length - 1];\n'
    '    if (CHIPS_BASE64[filename])    return CHIPS_BASE64[filename];\n'
    '    if (CURRENCY_BASE64[filename]) return CURRENCY_BASE64[filename];\n'
    '    if (STORE_BASE64[filename])    return STORE_BASE64[filename];\n'
    '    if (SHOP_BASE64[filename])     return SHOP_BASE64[filename];\n'
    '    return relpath;\n'
    '  }\n'
)

# ── 3. Replace renderChips function ────────────────────────────────────────
start_idx = None
for i, ln in enumerate(lines):
    if ln.strip() == 'function renderChips() {':
        start_idx = i
        break
if start_idx is None:
    raise RuntimeError('renderChips function not found')

end_idx = None
for j in range(start_idx + 1, len(lines)):
    if lines[j].rstrip() == '  }':
        end_idx = j
        break

new_render_chips_lines = [
    '  function renderChips() {\n',
    '    const gallery = document.getElementById(\'chip-gallery\');\n',
    '    let html = \'\';\n',
    '    const variants = [\'Chip_01\', \'Chip_01_a\', \'Chip_01_b\'];\n',
    '    const variantLabels = [\'Original (Red)\', \'Variant A (Blue)\', \'Variant B (Purple)\'];\n',
    '    variants.forEach((v, i) => {\n',
    '      html += `<div class="chip-card"><img src="${CHIPS_BASE64[v] || \'\'}" alt="${v}" loading="lazy"><div class="mt-2 text-xs gold-text font-mono">${v}</div><div class="text-[10px] text-amber-300/40">${variantLabels[i]}</div></div>`;\n',
    '    });\n',
    '    for (let i = 2; i <= 10; i++) {\n',
    '      const num = String(i).padStart(2, \'0\');\n',
    '      const id = \'Chip_\' + num;\n',
    '      html += `<div class="chip-card"><img src="${CHIPS_BASE64[id] || \'\'}" alt="Chip ${num}" loading="lazy"><div class="mt-2 text-xs gold-text font-mono">Chip_${num}</div><div class="text-[10px] text-amber-300/40">1024×1024 PNG</div></div>`;\n',
    '    }\n',
    '    gallery.innerHTML = html;\n',
    '  }\n',
]
lines[start_idx:end_idx + 1] = new_render_chips_lines

# ── 4. Replace renderCurrencyDisplay function ──────────────────────────────
for i, ln in enumerate(lines):
    if 'renderCurrencyDisplay' in ln and 'function' in ln:
        start = i
        end = None
        for j in range(i + 1, len(lines)):
            if lines[j].rstrip() == '  }':
                end = j
                break
        if end:
            new_block = [
                '  function renderCurrencyDisplay(containerId, chipId, amount) {\n',
                '    const el = document.getElementById(containerId);\n',
                '    if (!el) return;\n',
                '    el.innerHTML = `\n',
                '      <div class="chip-overlay">\n',
                '        <img src="${asset(\'../assets/chips/\' + chipId + \'.png\')}" alt="${chipId}">\n',
                '      </div>\n',
                '      <div class="amount-block">\n',
                '        <span class="amount-num text-lg">${amount.toLocaleString(\'en-US\')} K</span>\n',
                '        <span class="amount-label">Holdem Coin</span>\n',
                '      </div>\n',
                '      <button class="plus-btn" data-chip="${chipId}" aria-label="Recharge currency / 재화 충전" title="재화 충전 · Recharge">\n',
                '        <img src="${asset(\'../assets/currency/plus_01.png\')}" alt="">\n',
                '      </button>`;\n',
                '  }\n',
            ]
            lines[start:end + 1] = new_block
            break

# ── 5. Replace item-img src to use asset() helper ──────────────────────────
for i, ln in enumerate(lines):
    if 'item-img' in ln and '${item.img}' in ln:
        lines[i] = ln.replace('${item.img}', '${asset(item.img)}')
    if 'item-price-chip' in ln and '../assets/chips/${item.chip}.png' in ln:
        old = '../assets/chips/${item.chip}.png'
        new = "${asset(`../assets/chips/${item.chip}.png`)}"
        lines[i] = lines[i].replace(old, new)

# ── 6. Inject dictionaries + helper before init calls ─────────────────────
init_idx = None
for i, ln in enumerate(lines):
    if ln.strip() == 'render();' and i + 1 < len(lines) and lines[i + 1].strip() == 'renderChips();':
        init_idx = i
        break
if init_idx is None:
    raise RuntimeError('init block not found')

lines.insert(init_idx, combined_js)
lines.insert(init_idx + 1, asset_helper_js)

OUT_HTML.write_text(''.join(lines), encoding='utf-8')
size_kb = OUT_HTML.stat().st_size / 1024
print(f'wrote: {OUT_HTML}')
print(f'size:  {size_kb:.1f} KB')
print(f'inlined: {len(chips_b64)} chips, {len(currency_b64)} currency, {len(store_b64)} store, {len(shop_b64)} shop items')
