#!/usr/bin/env python3
"""
holdem_coin :: Character sprite sheet processor
─────────────────────────────────────────────────────────────────────────────
Source: /home/z/my-project/upload/model_1.jpg  (3168x1344, 2 rows × 5 cols)
  - Row 1 (frames 1-5): Attack animation (5 frames)
  - Row 2 (frames 6-10): Walk animation (5 frames)
  - Original orientation: facing RIGHT

Outputs:
  /home/z/my-project/src/ui/assets/character/
    - frame_right_attack_01..05.png  (5 frames, facing right, attack)
    - frame_right_walk_01..05.png    (5 frames, facing right, walk)
    - frame_left_attack_01..05.png   (5 frames, facing left = horizontal flip)
    - frame_left_walk_01..05.png    (5 frames, facing left = horizontal flip)
    - sprite_sheet.png              (combined 4x5 grid for game engines)
    - manifest.json                 (frame metadata: paths, sizes, fps hints)

Frame processing:
  1. Split 3168x1344 into 5x2 grid (each cell = 633x672)
  2. Background removal: light-gray background → alpha=0
     Uses chroma key on near-white pixels (luminance > 175)
  3. Apply slight edge feathering for smooth alpha
  4. Keep all frames at identical 633x672 size (so animation is steady)
  5. For LEFT variants: mirror horizontally (PIL transpose FLIP_LEFT_RIGHT)
"""
from PIL import Image, ImageFilter
import numpy as np
import json
import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────
SRC = Path('/home/z/my-project/upload/model_1.jpg')
OUT_DIR = Path('/home/z/my-project/src/ui/assets/character')
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Grid: 5 cols × 2 rows = 10 frames
N_COLS = 5
N_ROWS = 2
CELL_W = 633  # 3168 / 5
CELL_H = 672  # 1344 / 2

# Background chroma key: pixels with luminance > this are treated as background
BG_LUMA_THRESHOLD = 175
# Feathering: amount of soft edge anti-aliasing (in pixels)
FEATHER_RADIUS = 1.5

# Animations
ANIM_NAMES = ['attack', 'walk']  # row 0 = attack, row 1 = walk

# Fps suggestions (each anim cycle = N frames at this rate)
ANIM_FPS = {'attack': 12, 'walk': 10}


def log(msg):
    print(f'[gen_character_sprites] {msg}', flush=True)


def remove_background(img_rgb):
    """Convert near-white background to transparent, with feathered edges."""
    arr = np.array(img_rgb.convert('RGBA'))
    rgb = arr[..., :3].astype(np.float32)
    # Luminance (Rec. 601)
    gray = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # Initial alpha: opaque for dark pixels, transparent for light
    # Use smooth transition around threshold for anti-aliasing
    threshold = BG_LUMA_THRESHOLD
    # Soft transition: alpha goes from 255 (gray=140) to 0 (gray=threshold+30)
    alpha = np.clip(255 * (threshold - gray) / 30.0, 0, 255).astype(np.uint8)
    arr[..., 3] = alpha
    out = Image.fromarray(arr, 'RGBA')
    # Slight blur on alpha channel for smoother edges
    if FEATHER_RADIUS > 0:
        # Split channels, blur alpha only
        r, g, b, a = out.split()
        a = a.filter(ImageFilter.GaussianBlur(radius=FEATHER_RADIUS))
        out = Image.merge('RGBA', (r, g, b, a))
    return out


def process_frame(src_img, col, row):
    """Extract one frame and remove its background."""
    x0 = col * CELL_W
    y0 = row * CELL_H
    cell = src_img.crop((x0, y0, x0 + CELL_W, y0 + CELL_H))
    return remove_background(cell)


def main():
    log(f'source: {SRC}  size={Image.open(SRC).size}')
    src = Image.open(SRC).convert('RGB')

    manifest = {
        'source': str(SRC),
        'source_size': list(src.size),
        'frame_size': [CELL_W, CELL_H],
        'grid': {'cols': N_COLS, 'rows': N_ROWS},
        'directions': ['right', 'left'],
        'animations': [],
    }

    # Process right-facing frames (original)
    right_frames = {anim: [] for anim in ANIM_NAMES}
    for row, anim in enumerate(ANIM_NAMES):
        for col in range(N_COLS):
            frame = process_frame(src, col, row)
            idx = col + 1
            name = f'frame_right_{anim}_{idx:02d}.png'
            frame.save(OUT_DIR / name, 'PNG')
            right_frames[anim].append(name)
            log(f'  ✓ {name}  ({frame.size})')

    # Create left-facing frames (horizontal flip)
    left_frames = {anim: [] for anim in ANIM_NAMES}
    for anim, frame_names in right_frames.items():
        for fn in frame_names:
            img = Image.open(OUT_DIR / fn).convert('RGBA')
            flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
            out_name = fn.replace('frame_right_', 'frame_left_')
            flipped.save(OUT_DIR / out_name, 'PNG')
            left_frames[anim].append(out_name)
            log(f'  ✓ {out_name}  (flipped)')

    # Build combined sprite sheet (4 rows × 5 cols)
    # Row 0: right attack | Row 1: right walk | Row 2: left attack | Row 3: left walk
    sheet_w = N_COLS * CELL_W
    sheet_h = 4 * CELL_H
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    rows_data = [
        ('right_attack', right_frames['attack']),
        ('right_walk',   right_frames['walk']),
        ('left_attack',  left_frames['attack']),
        ('left_walk',    left_frames['walk']),
    ]
    for r, (label, frames) in enumerate(rows_data):
        for c, fn in enumerate(frames):
            img = Image.open(OUT_DIR / fn)
            sheet.paste(img, (c * CELL_W, r * CELL_H), img)
    sheet_path = OUT_DIR / 'sprite_sheet.png'
    sheet.save(sheet_path, 'PNG')
    log(f'sprite sheet: {sheet_path}  ({sheet.size}, {sheet_path.stat().st_size // 1024} KB)')

    # Build manifest
    for anim in ANIM_NAMES:
        manifest['animations'].append({
            'name': anim,
            'direction': 'right',
            'frames': [f'frame_right_{anim}_{i+1:02d}.png' for i in range(N_COLS)],
            'fps': ANIM_FPS[anim],
            'loop': anim == 'walk',
        })
        manifest['animations'].append({
            'name': anim,
            'direction': 'left',
            'frames': [f'frame_left_{anim}_{i+1:02d}.png' for i in range(N_COLS)],
            'fps': ANIM_FPS[anim],
            'loop': anim == 'walk',
        })
    manifest['sprite_sheet'] = 'sprite_sheet.png'
    manifest['sprite_sheet_layout'] = '4 rows × 5 cols (right-attack, right-walk, left-attack, left-walk)'

    manifest_path = OUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    log(f'manifest: {manifest_path}')

    # Summary
    total = sum(len(a['frames']) for a in manifest['animations'])
    log(f'done: {total} frames, {len(manifest["animations"])} animations, 1 sprite sheet')


if __name__ == '__main__':
    main()
