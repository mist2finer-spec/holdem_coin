"""Build standalone HTML files for each model demo, with all frames inlined as base64.

For each model_X_animation.html:
  - Read its manifest.json
  - Build FRAMES dict with data: URIs instead of relative paths
  - Replace ASSET_BASE const with empty string
  - Replace FRAMES_JSON literal in the JS with the inlined version
  - Save to /home/z/my-project/download/character_<model_id>_standalone.html
"""
import base64, json, re
from pathlib import Path

DEMOS = [
    ('model_2', '/home/z/my-project/src/ui/demo/model_2_animation.html',
                 '/home/z/my-project/src/ui/assets/character/model_2/manifest.json'),
    ('model_3', '/home/z/my-project/src/ui/demo/model_3_animation.html',
                 '/home/z/my-project/src/ui/assets/character/model_3/manifest.json'),
    ('model_5', '/home/z/my-project/src/ui/demo/model_5_animation.html',
                 '/home/z/my-project/src/ui/assets/character/model_5/manifest.json'),
]


def build_frames_data_uri(manifest_path: Path) -> dict:
    """Build FRAMES dict where each filename is replaced with a data: URI."""
    with open(manifest_path) as f:
        manifest = json.load(f)
    char_dir = manifest_path.parent
    frames = {}
    for anim in manifest['animations']:
        key = f"{anim['direction']}-{anim['name']}"
        frames[key] = []
        for fn in anim['frames']:
            p = char_dir / fn
            if not p.exists():
                print(f'  WARN: {p} not found')
                continue
            mime = 'image/png' if p.suffix.lower() == '.png' else 'image/jpeg'
            b64 = base64.b64encode(p.read_bytes()).decode('ascii')
            frames[key].append(f'data:{mime};base64,{b64}')
    return frames


def process(model_id: str, src_html_path: str, manifest_path: str):
    src_html = Path(src_html_path)
    out_html = Path(f'/home/z/my-project/download/character_{model_id}_standalone.html')
    out_html.parent.mkdir(parents=True, exist_ok=True)

    html = src_html.read_text(encoding='utf-8')

    # Build inlined FRAMES dict
    frames_inlined = build_frames_data_uri(Path(manifest_path))
    frames_js = json.dumps(frames_inlined, ensure_ascii=False)

    # Replace ASSET_BASE const value with empty string
    html = re.sub(
        r"const ASSET_BASE = '[^']*';",
        "const ASSET_BASE = '';  // unused — FRAMES now contains data URIs",
        html,
    )

    # Replace the FRAMES_JSON literal in the JS (between 'const FRAMES = ' and ';')
    # The HTML template emits: const FRAMES = {{FRAMES_JSON}};
    # After substitution it becomes: const FRAMES = {...literal...};
    # We need to find this and replace the literal with the inlined version.
    # Match: const FRAMES = <anything up to the matching closing brace and semicolon>;
    pattern = re.compile(r'const FRAMES = (\{[^;]+\});', re.DOTALL)
    html = pattern.sub(f'const FRAMES = {frames_js};', html)

    # Also fix the image load line: img.src = `${ASSET_BASE}/${fn}`
    # Since ASSET_BASE is now '', `${ASSET_BASE}/${fn}` would become '/frame_...'
    # which is wrong. Replace with just fn (since fn is now the full data URI).
    html = html.replace(
        'img.src = `${ASSET_BASE}/${fn}`;',
        'img.src = fn;  // fn is now a data URI',
    )

    out_html.write_text(html, encoding='utf-8')
    size_kb = out_html.stat().st_size / 1024
    n_frames = sum(len(v) for v in frames_inlined)
    print(f'wrote: {out_html}  ({size_kb:.1f} KB, {n_frames} frames inlined)')


def main():
    for model_id, src_path, manifest_path in DEMOS:
        print(f'── {model_id} ──')
        process(model_id, src_path, manifest_path)


if __name__ == '__main__':
    main()
