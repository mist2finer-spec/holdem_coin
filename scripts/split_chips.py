#!/usr/bin/env python3
"""
holdem_coin :: Chip Sprite Splitter
─────────────────────────────────────────────────────────────────────────────
Splits `chipimage_bulk.jpg` (10 chip icons in a 3x5 grid) into individual
`Chip_01.png` ... `Chip_10.png` files with transparent backgrounds.

Algorithm (hybrid):
  1) Coarse grid detection — assume 3 rows × 5 cols (per VLM analysis).
     Compute the dark gap rows/cols to refine cell boundaries.
  2) For each grid cell, find the largest contiguous bright region (the chip)
     using flood-fill on a luminance threshold.
  3) Compute a tight bounding box around the chip, crop with alpha mask.
  4) Save as 256×256 PNG (transparent padding, chip centered).

Output: /home/z/my-project/src/ui/assets/chips/Chip_01.png .. Chip_10.png
"""
from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path
import sys, json

# ── paths ─────────────────────────────────────────────────────────────────
SRC      = Path('/home/z/my-project/scripts/chipimage_bulk.jpg')
OUT_DIR  = Path('/home/z/my-project/src/ui/assets/chips')
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Output canonical size (square, alpha channel)
OUT_SIZE = 256
# Luminance threshold for "chip pixel" (0=black bg, 255=white chip)
LUMA_THRESHOLD = 35
# Minimum chip area (relative to cell area) to count as a real chip
MIN_CHIP_RATIO  = 0.02

# Grid dimensions per VLM analysis (3 rows × 5 cols, with empty cells)
GRID_ROWS = 3
GRID_COLS = 5

# Mapping grid position → chip index 1..10
# Per VLM: row1: 01,02,03,04,05 ; row2: 06,07 ; row3: 08,09,10
GRID_MAP = {
    (0, 0): 1,  (0, 1): 2,  (0, 2): 3,  (0, 3): 4,  (0, 4): 5,
    (1, 0): 6,  (1, 1): 7,
    (2, 0): 8,  (2, 1): 9,  (2, 2): 10,
}

# ── helpers ───────────────────────────────────────────────────────────────
def log(msg):
    print(f"[split_chips] {msg}", file=sys.stderr)

def detect_grid_boundaries(arr_gray):
    """
    Detect row/col separators by looking for darker bands.
    Returns list of row ranges [(y0, y1), ...] and col ranges [(x0, x1), ...].
    """
    h, w = arr_gray.shape
    row_brightness = arr_gray.mean(axis=1)
    col_brightness = arr_gray.mean(axis=0)

    # Threshold: dark bands are below mean - 0.5*std
    row_thr = row_brightness.mean() - row_brightness.std() * 0.3
    col_thr = col_brightness.mean() - col_brightness.std() * 0.3

    # Find dark row indices, group them into bands
    dark_rows = np.where(row_brightness < row_thr)[0]
    dark_cols = np.where(col_brightness < col_thr)[0]

    def group_into_bands(idx):
        if len(idx) == 0:
            return []
        bands = []
        start = idx[0]
        prev = idx[0]
        for i in idx[1:]:
            if i - prev > 8:
                bands.append((start, prev))
                start = i
            prev = i
        bands.append((start, prev))
        return bands

    row_bands = group_into_bands(dark_rows)
    col_bands = group_into_bands(dark_cols)

    # Cell boundaries = midpoints between bands
    # Add image edges as virtual bands
    def cells(bands, total):
        if not bands:
            return [(0, total)]
        # First cell from 0 to first band start
        cells = []
        prev_end = 0
        for b_start, b_end in bands:
            cells.append((prev_end, b_start))
            prev_end = b_end + 1
        cells.append((prev_end, total))
        # Filter out tiny cells
        return [(s, e) for s, e in cells if (e - s) > total // 20]

    return cells(row_bands, h), cells(col_bands, w)

def find_chip_bbox(cell_gray, cell_rgba):
    """
    Find the tight bounding box of the largest bright (chip) region in the cell.
    Uses a simple connected-component-like flood fill from the brightest point.
    Returns (x0, y0, x1, y1) in cell-local coords, or None if no chip found.
    """
    h, w = cell_gray.shape
    # Mask of "bright" pixels (likely chip)
    mask = cell_gray > LUMA_THRESHOLD
    if mask.sum() == 0:
        return None

    # Find the largest connected component via simple BFS using scipy-like approach
    # We use a numpy-based label-free approximation: dilate mask, find biggest blob.
    # For simplicity, just take the bounding box of all bright pixels — works well
    # because each cell contains only one chip with dark background.
    ys, xs = np.where(mask)
    if len(xs) < 20:
        return None

    # Tighten: use 5th–95th percentile to reject stray pixels
    x0 = int(np.percentile(xs, 2))
    x1 = int(np.percentile(xs, 98))
    y0 = int(np.percentile(ys, 2))
    y1 = int(np.percentile(ys, 98))

    # Sanity check: chip area should be at least MIN_CHIP_RATIO of cell area
    chip_area = (x1 - x0) * (y1 - y0)
    cell_area = w * h
    if chip_area / cell_area < MIN_CHIP_RATIO:
        return None

    return (x0, y0, x1, y1)

def crop_chip_to_png(cell_rgba, bbox, out_path, idx):
    """Crop, remove background (make transparent), resize, save."""
    x0, y0, x1, y1 = bbox
    # Add small padding
    pad = max(2, (x1 - x0) // 20)
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(cell_rgba.width, x1 + pad)
    y1 = min(cell_rgba.height, y1 + pad)

    chip_img = cell_rgba.crop((x0, y0, x1, y1)).convert('RGBA')
    arr = np.array(chip_img)

    # Build alpha mask: transparent where pixel is very dark (background)
    gray = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    alpha = np.where(gray > LUMA_THRESHOLD, 255, 0).astype(np.uint8)
    # Feather edges slightly: dilate-then-erode for smoothing
    # (lightweight approximation: just use the alpha as-is for now)
    arr[..., 3] = alpha
    chip_img = Image.fromarray(arr, 'RGBA')

    # Resize to OUT_SIZE with aspect-ratio preservation (centered, transparent padding)
    final = Image.new('RGBA', (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    cw, ch = chip_img.size
    scale = min(OUT_SIZE * 0.85 / cw, OUT_SIZE * 0.85 / ch)
    new_w, new_h = int(cw * scale), int(ch * scale)
    chip_resized = chip_img.resize((new_w, new_h), Image.LANCZOS)
    offset = ((OUT_SIZE - new_w) // 2, (OUT_SIZE - new_h) // 2)
    final.paste(chip_resized, offset, chip_resized)

    final.save(out_path, 'PNG')
    return out_path

# ── main ──────────────────────────────────────────────────────────────────
def main():
    if not SRC.exists():
        log(f"ERROR: source image not found: {SRC}")
        sys.exit(1)

    img = Image.open(SRC).convert('RGBA')
    arr_gray = np.array(img.convert('L'))
    log(f"loaded: {SRC.name}  size={img.size}")

    row_cells, col_cells = detect_grid_boundaries(arr_gray)
    log(f"detected row cells: {len(row_cells)}  col cells: {len(col_cells)}")
    log(f"  row ranges: {row_cells[:6]}")
    log(f"  col ranges: {col_cells[:6]}")

    # If detection didn't find expected grid, fall back to equal split
    if len(row_cells) < GRID_ROWS or len(col_cells) < GRID_COLS:
        log("detection imperfect — falling back to equal grid split")
        h, w = arr_gray.shape
        row_cells = [(i * h // GRID_ROWS, (i + 1) * h // GRID_ROWS) for i in range(GRID_ROWS)]
        col_cells = [(j * w // GRID_COLS, (j + 1) * w // GRID_COLS) for j in range(GRID_COLS)]

    manifest = []
    for (r, c), idx in sorted(GRID_MAP.items(), key=lambda kv: kv[1]):
        if r >= len(row_cells) or c >= len(col_cells):
            log(f"  Chip_{idx:02d}: SKIPPED (grid out of range)")
            continue
        y0, y1 = row_cells[r]
        x0, x1 = col_cells[c]
        cell_rgba = img.crop((x0, y0, x1, y1))
        cell_gray = arr_gray[y0:y1, x0:x1]
        bbox = find_chip_bbox(cell_gray, cell_rgba)
        if bbox is None:
            log(f"  Chip_{idx:02d}: SKIPPED (no chip detected in cell r={r} c={c})")
            continue
        out_path = OUT_DIR / f"Chip_{idx:02d}.png"
        crop_chip_to_png(cell_rgba, bbox, out_path, idx)
        rel_size = out_path.stat().st_size
        log(f"  Chip_{idx:02d}: saved → {out_path.name} ({rel_size} bytes)")
        manifest.append({
            'id': f"Chip_{idx:02d}",
            'index': idx,
            'src_grid': {'row': r, 'col': c},
            'file': str(out_path.relative_to('/home/z/my-project')),
            'size_px': OUT_SIZE,
            'bytes': rel_size,
        })

    manifest_path = OUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps({
        'source': str(SRC),
        'grid': {'rows': GRID_ROWS, 'cols': GRID_COLS},
        'output_size_px': OUT_SIZE,
        'chips': manifest,
    }, indent=2, ensure_ascii=False))
    log(f"manifest written: {manifest_path}  ({len(manifest)} chips)")

if __name__ == '__main__':
    main()
