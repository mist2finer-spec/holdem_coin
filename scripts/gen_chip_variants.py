#!/usr/bin/env python3
"""
holdem_coin :: Chip_01 color variants
─────────────────────────────────────────────────────────────────────────────
Generates Chip_01_a (blue) and Chip_01_b (purple) by hue-shifting the
original Chip_01.png. Form, lighting, shadows are preserved exactly —
only the chip color is changed.

Strategy:
  1. Load Chip_01.png (1024x1024 RGB on dark background)
  2. Convert to HSV
  3. For "blue": rotate hue so red (0°) → blue (~210°). Keep S, V intact.
  4. For "purple": rotate hue so red (0°) → purple (~280°).
  5. Apply only to non-background pixels (luminance > threshold).
  6. Save as PNG.

Outputs:
  src/ui/assets/chips/Chip_01_a.png  (blue)
  src/ui/assets/chips/Chip_01_b.png  (purple)
"""
from PIL import Image
import numpy as np
import colorsys
from pathlib import Path

SRC = Path('/home/z/my-project/src/ui/assets/chips/Chip_01.png')
OUT_A = Path('/home/z/my-project/src/ui/assets/chips/Chip_01_a.png')  # blue
OUT_B = Path('/home/z/my-project/src/ui/assets/chips/Chip_01_b.png')  # purple

# Hue rotation (in radians; full circle = 1.0 in PIL's HSV)
# Red is at hue=0 in HSV. Blue ≈ 240°/360 = 0.667, Purple ≈ 280°/360 = 0.778
HUE_SHIFTS = {
    'blue':   0.667,   # 0° + 240° → blue
    'purple': 0.778,   # 0° + 280° → purple
}

# Luminance threshold for "chip pixel" (vs dark background)
LUMA_THRESHOLD = 35


def log(msg):
    print(f"[gen_chip_variants] {msg}")


def hue_shift_chip(src_path, out_path, target_hue):
    """
    Hue-shift the chip pixels of `src_path` so the dominant red becomes
    `target_hue` (0..1). Save to `out_path`.
    """
    img = Image.open(src_path).convert('RGB')
    arr = np.array(img)  # (H, W, 3) uint8 RGB

    # Convert RGB → HSV vectorized
    rgb_norm = arr.astype(np.float32) / 255.0
    r, g, b = rgb_norm[..., 0], rgb_norm[..., 1], rgb_norm[..., 2]
    maxc = np.max(rgb_norm, axis=-1)
    minc = np.min(rgb_norm, axis=-1)
    v = maxc
    delta = maxc - minc
    s = np.where(maxc > 0, delta / np.where(maxc == 0, 1, maxc), 0)

    # Compute current hue
    h = np.zeros_like(maxc)
    mask = delta > 0
    # Where max == r
    mr = (maxc == r) & mask
    h[mr] = ((g[mr] - b[mr]) / delta[mr]) % 6.0
    mg = (maxc == g) & mask
    h[mg] = 2.0 + ((b[mg] - r[mg]) / delta[mg])
    mb = (maxc == b) & mask
    h[mb] = 4.0 + ((r[mb] - g[mb]) / delta[mb])
    h = h / 6.0  # normalize to [0, 1]

    # Luminance mask — only recolor chip pixels (not background)
    gray = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    chip_mask = gray > LUMA_THRESHOLD  # boolean HxW

    # For chip pixels, shift hue so red (h≈0) becomes target_hue.
    # Strategy: compute hue offset = target_hue - 0 (assume red dominant).
    # For non-red chip pixels (highlights, shadows), shift relative by same amount.
    # We detect "redness" by how close h is to 0/1.
    # Simpler approach: shift ALL chip pixels' hue by (target_hue - mean_red_hue)
    # where mean_red_hue is computed from pixels with high red saturation.

    # Find "red dominant" pixels (R significantly > G and B)
    red_dominant = (r > g + 0.15) & (r > b + 0.15) & chip_mask
    if red_dominant.sum() == 0:
        log(f'  WARN: no red-dominant pixels found in {src_path.name}')
        red_hue_mean = 0.0
    else:
        red_hue_mean = float(np.mean(h[red_dominant]))

    hue_offset = (target_hue - red_hue_mean) % 1.0
    log(f'  target_hue={target_hue:.3f}  red_hue_mean={red_hue_mean:.3f}  offset={hue_offset:.3f}')

    # Apply hue shift only on chip pixels
    h_new = h.copy()
    h_new[chip_mask] = (h[chip_mask] + hue_offset) % 1.0

    # Convert HSV → RGB
    # Vectorized version of colorsys.hsv_to_rgb
    i = np.floor(h_new * 6.0).astype(np.int32)
    f = h_new * 6.0 - i
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))
    i_mod = i % 6

    r_new = np.choose(i_mod, [v, q, p, p, t, v])
    g_new = np.choose(i_mod, [t, v, v, q, p, p])
    b_new = np.choose(i_mod, [p, p, t, v, v, q])

    rgb_new = np.stack([r_new, g_new, b_new], axis=-1)
    # Preserve original background (no recolor)
    rgb_preserved = rgb_norm.copy()
    rgb_preserved[chip_mask] = rgb_new[chip_mask]

    out_arr = np.clip(rgb_preserved * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(out_arr, 'RGB').save(out_path, 'PNG')
    log(f'  saved: {out_path.name}  ({out_path.stat().st_size} bytes)')


def main():
    log(f'source: {SRC}')
    if not SRC.exists():
        log(f'ERROR: {SRC} not found')
        raise SystemExit(1)
    for label, hue in HUE_SHIFTS.items():
        out = OUT_A if label == 'blue' else OUT_B
        log(f'generating {label} variant → {out.name}')
        hue_shift_chip(SRC, out, hue)
    log('done')


if __name__ == '__main__':
    main()
