#!/usr/bin/env python3
"""
holdem_coin :: Generic character sprite sheet processor
─────────────────────────────────────────────────────────────────────────────
Processes any 2D sprite sheet into:
  - Individual PNG frames with transparent backgrounds
  - LEFT-direction flipped variants
  - Combined sprite sheet (rows × cols)
  - manifest.json

Each model is configured via a per-model spec dict. Supports:
  - Uniform grid (e.g. 5×2 with all cells same size)
  - Non-uniform row layouts (e.g. 5 small frames + 4 large frames)
  - Multiple named animations per model

Usage:
  python3 scripts/gen_character_sprites_v2.py [model_id]
  (no arg → process all 4 new models: model_2, model_3, model_4, model_5)
"""
from PIL import Image, ImageFilter
import numpy as np
import json
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# ─── Paths ────────────────────────────────────────────────────────────────
UPLOAD_DIR = Path('/home/z/my-project/upload')
OUT_BASE   = Path('/home/z/my-project/src/ui/assets/character')

# ─── Per-model specifications ─────────────────────────────────────────────
# Each spec describes how to slice the source sprite sheet.
#
# - source: filename in /upload/
# - out_dir: subdirectory of OUT_BASE for this model's frames
# - grid: (cols, rows) for the slicing grid (must match the source layout)
# - cell_size: explicit (w, h) per cell; if None, computed from source_size / grid
# - source_size: explicit (w, h) of the source image (used for sanity checks)
# - bg_threshold: luminance above which a pixel is treated as background
#                 (dark blue/green backgrounds → threshold ~150; light gray → ~175)
# - bg_color: optional RGB tuple for chroma key (uses distance from this color)
# - animations: list of {name, row, frame_count, fps, loop}
#   * row: 0-indexed row in the grid (for multi-row layouts)
#   * frame_count: how many frames in this animation (may be < cols)
#   * For non-uniform rows (e.g. slime with 5 small + 4 large), specify
#     cell_size=None and use explicit 'cells' list instead.

@dataclass
class AnimSpec:
    name: str
    row: int
    frame_count: int
    fps: int
    loop: bool

@dataclass
class ModelSpec:
    model_id: str
    source: str
    display_name: str
    display_name_ko: str
    grid: Tuple[int, int]  # (cols, rows)
    source_size: Tuple[int, int]
    animations: List[AnimSpec]
    bg_threshold: int = 150  # default for dark-blue backgrounds
    bg_color: Optional[Tuple[int, int, int]] = None  # if None, use luminance
    # For non-uniform rows: list of cell_size per row [(w,h), (w,h), ...]
    # If None, compute uniform cell size from source_size / grid
    row_cell_sizes: Optional[List[Tuple[int, int]]] = None
    # For non-uniform frame counts per row: list of frame counts per row
    # If None, every row has `grid[0]` frames
    row_frame_counts: Optional[List[int]] = None


# ─── 3 model specs (model_4 was discarded) ────────────────────────────────
MODELS = [
    # ── model_2: Skeleton warrior — 2 rows × 5 cols, both rows are "walk"
    ModelSpec(
        model_id='model_2',
        source='model_2.jpg',
        display_name='Skeleton Warrior',
        display_name_ko='해골 전사',
        grid=(5, 2),
        source_size=(2752, 1536),  # cell = 550x768
        animations=[
            AnimSpec('walk', row=0, frame_count=5, fps=10, loop=True),
            AnimSpec('walk_b', row=1, frame_count=5, fps=10, loop=True),
        ],
        bg_threshold=140,
    ),

    # ── model_3: Female warrior — 2 rows × 5 cols, both rows are "run"
    ModelSpec(
        model_id='model_3',
        source='model_3.jpg',
        display_name='Valkyrie',
        display_name_ko='발키리',
        grid=(5, 2),
        source_size=(3584, 1184),  # cell = 716x592
        animations=[
            AnimSpec('run', row=0, frame_count=5, fps=14, loop=True),
            AnimSpec('run_b', row=1, frame_count=5, fps=14, loop=True),
        ],
        bg_threshold=140,
    ),

    # ── model_5: Slime — non-uniform: row0=5 small (jump), row1=4 large (attack)
    # Image is 2752x1536. If we split evenly: row_h=768, col_w=2752/5=550 (row0)
    # For row1 with 4 frames: col_w=2752/4=688. But cells might overlap.
    # We use a 5x2 grid for row0 and 4x1 for row1.
    ModelSpec(
        model_id='model_5',
        source='model_5.jpg',
        display_name='Green Slime',
        display_name_ko='초록 슬라임',
        grid=(5, 2),  # for cell-size computation
        source_size=(2752, 1536),
        animations=[
            AnimSpec('jump',   row=0, frame_count=5, fps=8,  loop=True),
            AnimSpec('attack', row=1, frame_count=4, fps=10, loop=False),
        ],
        bg_threshold=140,
        # Override row frame counts: row0 has 5 frames, row1 has 4 frames
        row_frame_counts=[5, 4],
        # Different cell widths per row: row0 col_w=2752/5=550, row1 col_w=2752/4=688
        row_cell_sizes=[(550, 768), (688, 768)],
    ),
]


def log(msg):
    print(f'[gen_character_sprites_v2] {msg}', flush=True)


def remove_background(img_rgb, threshold, bg_color=None):
    """Convert dark/solid background to transparent."""
    arr = np.array(img_rgb.convert('RGBA'))
    rgb = arr[..., :3].astype(np.float32)

    if bg_color is not None:
        # Chroma key by distance from bg_color
        dr = rgb[..., 0] - bg_color[0]
        dg = rgb[..., 1] - bg_color[1]
        db = rgb[..., 2] - bg_color[2]
        dist = np.sqrt(dr * dr + dg * dg + db * db)
        alpha = np.clip(255 * (dist - 30) / 60.0, 0, 255).astype(np.uint8)
    else:
        # Luminance-based: dark backgrounds (blue, black) become transparent
        gray = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
        # For dark blue backgrounds (low luminance AND high blue component),
        # treat pixels with luminance < threshold as background
        alpha = np.where(gray < threshold, 0, 255).astype(np.uint8)
        # Add feathering at the threshold boundary
        feather_zone = (gray >= threshold - 15) & (gray < threshold + 15)
        alpha = np.where(feather_zone, ((gray - (threshold - 15)) / 30 * 255).astype(np.uint8), alpha)

    arr[..., 3] = alpha
    out = Image.fromarray(arr, 'RGBA')

    # Slight blur on alpha for smoother edges
    r, g, b, a = out.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=1.0))
    out = Image.merge('RGBA', (r, g, b, a))
    return out


def process_model(spec: ModelSpec):
    """Process a single model: split, debg, flip, save frames + sprite sheet + manifest."""
    src_path = UPLOAD_DIR / spec.source
    if not src_path.exists():
        log(f'  ERROR: source not found: {src_path}')
        return False

    src = Image.open(src_path).convert('RGB')
    actual_size = src.size
    if actual_size != spec.source_size:
        log(f'  WARN: source size {actual_size} ≠ spec {spec.source_size}; using actual')

    out_dir = OUT_BASE / spec.model_id
    out_dir.mkdir(parents=True, exist_ok=True)

    # Compute cell sizes per row
    if spec.row_cell_sizes:
        row_cell_sizes = spec.row_cell_sizes
    else:
        # Uniform: cell_w = width // cols, cell_h = height // rows
        cols, rows = spec.grid
        cell_w = actual_size[0] // cols
        cell_h = actual_size[1] // rows
        row_cell_sizes = [(cell_w, cell_h)] * rows

    log(f'  processing {spec.model_id}: {actual_size}, grid={spec.grid}, row_cells={row_cell_sizes}')

    # Build a uniform target cell size for the sprite sheet (max across rows)
    target_w = max(cw for cw, _ in row_cell_sizes)
    target_h = max(ch for _, ch in row_cell_sizes)

    # Process each animation
    manifest = {
        'model_id': spec.model_id,
        'display_name': spec.display_name,
        'display_name_ko': spec.display_name_ko,
        'source': str(src_path),
        'source_size': list(actual_size),
        'frame_size': [target_w, target_h],
        'directions': ['right', 'left'],
        'animations': [],
    }

    all_right_frames = []  # list of (filename, frame_image) for sprite sheet
    all_left_frames  = []

    for anim in spec.animations:
        row = anim.row
        n_frames = anim.frame_count
        cell_w, cell_h = row_cell_sizes[row]
        # Frame count per row override
        if spec.row_frame_counts:
            n_frames = spec.row_frame_counts[row]

        log(f'    anim "{anim.name}" row={row} frames={n_frames} cell={cell_w}x{cell_h} fps={anim.fps}')

        right_frames = []
        for f in range(n_frames):
            x0 = f * cell_w
            y0 = row * cell_h
            cell = src.crop((x0, y0, x0 + cell_w, y0 + cell_h))
            # Remove background
            cell_clean = remove_background(cell, spec.bg_threshold, spec.bg_color)
            # Resize/canvas to target_w × target_h, centered
            canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
            offset = ((target_w - cell_w) // 2, (target_h - cell_h) // 2)
            canvas.paste(cell_clean, offset, cell_clean)

            fname = f'frame_right_{anim.name}_{f+1:02d}.png'
            canvas.save(out_dir / fname, 'PNG')
            right_frames.append((fname, canvas))

            # Flip for LEFT direction
            flipped = canvas.transpose(Image.FLIP_LEFT_RIGHT)
            fname_l = f'frame_left_{anim.name}_{f+1:02d}.png'
            flipped.save(out_dir / fname_l, 'PNG')

            log(f'      ✓ {fname}  +  {fname_l}')

        # Add to manifest
        manifest['animations'].append({
            'name': anim.name,
            'direction': 'right',
            'frames': [fn for fn, _ in right_frames],
            'fps': anim.fps,
            'loop': anim.loop,
        })
        manifest['animations'].append({
            'name': anim.name,
            'direction': 'left',
            'frames': [f'frame_left_{anim.name}_{f+1:02d}.png' for f in range(n_frames)],
            'fps': anim.fps,
            'loop': anim.loop,
        })

        all_right_frames.extend(right_frames)
        all_left_frames.extend([(fn.replace('right', 'left'), img.transpose(Image.FLIP_LEFT_RIGHT))
                                for fn, img in right_frames])

    # Build combined sprite sheet (rows = animations × directions)
    # Layout: alternating right/left for each animation
    # Row 0: right anim0, Row 1: left anim0, Row 2: right anim1, Row 3: left anim1, ...
    max_frames_per_anim = max(a.frame_count for a in spec.animations)
    if spec.row_frame_counts:
        max_frames_per_anim = max(spec.row_frame_counts)
    n_rows = len(spec.animations) * 2
    sheet_w = max_frames_per_anim * target_w
    sheet_h = n_rows * target_h
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    # Group frames by animation
    # Frame filename pattern: frame_right_<anim>_<NN>.png
    # anim_name can contain underscores (e.g. "walk_b"), so we parse from
    # the right: strip ".png", strip last "_NN" segment, strip "frame_right_/" prefix.
    anim_right_groups = {}
    anim_left_groups = {}
    def parse_anim_name(fn):
        """Extract anim_name from 'frame_right_<anim>_<NN>.png' or 'frame_left_<anim>_<NN>.png'."""
        name = fn.replace('.png', '')
        # Remove the trailing _NN (frame number)
        idx = name.rfind('_')
        if idx == -1:
            return None
        name_no_num = name[:idx]
        # Now name_no_num = 'frame_right_<anim>' or 'frame_left_<anim>'
        # Strip 'frame_right_' or 'frame_left_'
        if name_no_num.startswith('frame_right_'):
            return name_no_num[len('frame_right_'):]
        if name_no_num.startswith('frame_left_'):
            return name_no_num[len('frame_left_'):]
        return None

    for fn, img in all_right_frames:
        anim_name = parse_anim_name(fn)
        if anim_name is None:
            continue
        if anim_name not in anim_right_groups:
            anim_right_groups[anim_name] = []
        anim_right_groups[anim_name].append(img)
    for fn, img in all_left_frames:
        anim_name = parse_anim_name(fn)
        if anim_name is None:
            continue
        if anim_name not in anim_left_groups:
            anim_left_groups[anim_name] = []
        anim_left_groups[anim_name].append(img)

    sheet_row = 0
    for anim in spec.animations:
        # Right row
        for col, img in enumerate(anim_right_groups[anim.name]):
            sheet.paste(img, (col * target_w, sheet_row * target_h), img)
        sheet_row += 1
        # Left row
        for col, img in enumerate(anim_left_groups[anim.name]):
            sheet.paste(img, (col * target_w, sheet_row * target_h), img)
        sheet_row += 1

    sheet_path = out_dir / 'sprite_sheet.png'
    sheet.save(sheet_path, 'PNG')
    log(f'    sprite sheet: {sheet_path.name}  ({sheet.size}, {sheet_path.stat().st_size // 1024} KB)')

    manifest['sprite_sheet'] = 'sprite_sheet.png'
    manifest['sprite_sheet_layout'] = f'{n_rows} rows × {max_frames_per_anim} cols (alternating right/left per animation)'

    manifest_path = out_dir / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    log(f'    manifest: {manifest_path.name}')

    total = sum(len(a['frames']) for a in manifest['animations'])
    log(f'  done: {spec.model_id} → {total} frames, {len(manifest["animations"])} animations, 1 sprite sheet')
    return True


def main():
    if len(sys.argv) > 1:
        target_id = sys.argv[1]
        specs = [m for m in MODELS if m.model_id == target_id]
        if not specs:
            log(f'ERROR: unknown model_id "{target_id}". Available: {[m.model_id for m in MODELS]}')
            sys.exit(1)
    else:
        specs = MODELS

    log(f'processing {len(specs)} model(s): {[s.model_id for s in specs]}')
    success = 0
    for spec in specs:
        log(f'── {spec.model_id} ({spec.display_name} / {spec.display_name_ko}) ──')
        if process_model(spec):
            success += 1
    log(f'\n{success}/{len(specs)} models processed successfully')
    if success != len(specs):
        sys.exit(1)


if __name__ == '__main__':
    main()
