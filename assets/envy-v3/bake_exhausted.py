"""Bake Envy's exhausted breathing loop with planted hands and shoes."""

import json
import math

import numpy as np
from PIL import Image, ImageDraw

from bake_idle import ramp
from bake_walk import GROUND, ROOT, SIZE, premultiply, sample_texture
from bake_walk_v2 import offset_from_pivot


OUTPUT = ROOT / "exhausted"
FRAME_COUNT = 24
FRAME_MS = 70
COLUMNS = 6
ORIGIN = [253.25, GROUND]
HANDS_FIXED_FROM = 333

# Two panting breaths. The second comes a little quicker and shallower.
BREATH = ((0.00, 0.12), (0.19, 1.00), (0.27, 0.88), (0.48, 0.08),
          (0.57, 0.19), (0.72, 0.84), (0.80, 0.70), (1.00, 0.12))

# Phase, origin x/y, sideways travel, fall distance, lifetime, width, height.
DROPS = (
    (0.00, 203, 179, -23, 90, 0.52, 8, 15),
    (0.05, 350, 188, 26, 111, 0.48, 7, 14),
    (0.09, 177, 224, -16, 84, 0.42, 5, 10),
    (0.13, 365, 214, 30, 92, 0.48, 8, 16),
    (0.18, 228, 145, -10, 102, 0.45, 6, 12),
    (0.22, 342, 235, 22, 81, 0.50, 9, 16),
    (0.27, 185, 193, -22, 113, 0.47, 8, 15),
    (0.31, 355, 171, 18, 117, 0.48, 5, 11),
    (0.36, 167, 252, -15, 68, 0.42, 6, 11),
    (0.40, 365, 247, 22, 82, 0.46, 7, 14),
    (0.45, 217, 155, -18, 90, 0.43, 5, 11),
    (0.49, 347, 206, 28, 111, 0.49, 8, 16),
    (0.54, 190, 208, -22, 105, 0.50, 8, 15),
    (0.59, 368, 174, 19, 95, 0.45, 6, 12),
    (0.64, 180, 246, -18, 79, 0.44, 6, 12),
    (0.69, 352, 222, 33, 105, 0.46, 9, 17),
    (0.74, 205, 166, -25, 109, 0.50, 7, 13),
    (0.80, 363, 198, 17, 94, 0.43, 5, 10),
    (0.85, 173, 235, -20, 85, 0.45, 7, 13),
    (0.91, 340, 236, 18, 88, 0.49, 8, 14),
    (0.95, 355, 152, 19, 99, 0.45, 5, 10),
)


def load_pose():
    source = Image.open(OUTPUT / "body-hood-fit.png").convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: value if value >= 8 else 0)
    source.putalpha(alpha)
    with Image.open(OUTPUT / "body-round-face.png") as previous:
        left, top, right, bottom = previous.getchannel("A").point(lambda value: value if value >= 8 else 0).getbbox()
    feet_left, _, feet_right, _ = alpha.crop((0, bottom - 85, source.width, bottom)).getbbox()
    scale = 335 / (bottom - top)
    width = round((right - left) * scale)
    horizontal_scale = width / (right - left)
    edited_left, _, edited_right, _ = alpha.getbbox()
    # Give the hood tips room without shifting the hands or shoes.
    left_edge = min(0, math.floor((edited_left - left) * horizontal_scale))
    right_edge = max(width, math.ceil((edited_right - left) * horizontal_scale))
    bounds = (left + left_edge / horizontal_scale, top, left + right_edge / horizontal_scale, bottom)
    cutout = source.resize((right_edge - left_edge, 335), Image.Resampling.LANCZOS, box=bounds)
    feet_center = (feet_left + feet_right) / 2
    pose = Image.new("RGBA", (SIZE, SIZE))
    pose.paste(cutout, (round(ORIGIN[0] - (feet_center - left) * scale) + left_edge, GROUND - cutout.height))
    return pose


def breathing_amount(phase):
    for (start, rest), (end, peak) in zip(BREATH, BREATH[1:]):
        if phase <= end:
            weight = (1 - math.cos(math.pi * (phase - start) / (end - start))) / 2
            return rest + (peak - rest) * weight
    return BREATH[-1][1]


def breathing_pose(pose, texture, phase):
    breath = breathing_amount(phase)
    y, x = np.mgrid[102:HANDS_FIXED_FROM, 129:384].astype(np.float32)
    shoulder_weight = 1 - ramp(y, 258, HANDS_FIXED_FROM)
    chest_weight = ramp(y, 202, 252) * shoulder_weight
    hood_weight = 1 - ramp(y, 212, 264)
    nod_x, nod_y = offset_from_pivot(x, y, (268, 259), math.radians(-2.5 * breath) * hood_weight)
    mouth_weight = np.clip(1 - ((x - 304) / 13)**2 - ((y - 251) / 9)**2, 0, 1)
    mouth = (y - 251) * 0.33 * breath * mouth_weight
    sample_x = x - (x - 262) * 0.04 * breath * chest_weight + nod_x
    sample_y = y + 11 * breath * shoulder_weight + nod_y - mouth
    frame = np.array(pose)
    frame[102:HANDS_FIXED_FROM, 129:384] = sample_texture(
        texture, sample_x.ravel(), sample_y.ravel(),
    ).reshape((*x.shape, 4))
    return Image.fromarray(frame)


def sweat_sprite(width, height):
    antialias = 4
    drop = Image.new("RGBA", ((width + 4) * antialias, (height + 3) * antialias))
    draw = ImageDraw.Draw(drop)
    contour = ((0.54, 0.03), (0.69, 0.27), (0.88, 0.51), (0.98, 0.70),
               (0.90, 0.85), (0.73, 0.96), (0.51, 1.0), (0.28, 0.95),
               (0.09, 0.82), (0.03, 0.67), (0.13, 0.49), (0.35, 0.23))
    points = [((2 + u * width) * antialias, (1 + v * height) * antialias) for u, v in contour]
    draw.polygon(points, fill="#57cfed")
    draw.line(points + points[:1], fill="#256a94", width=antialias)
    draw.ellipse(((2 + 0.24 * width) * antialias, (1 + 0.43 * height) * antialias,
                  (2 + 0.48 * width) * antialias, (1 + 0.67 * height) * antialias),
                 fill="#e4fbff")
    return drop.resize((width + 4, height + 3), Image.Resampling.LANCZOS)


def add_sweat(frame, phase, sprites):
    for start, x, y, drift, fall, lifetime, width, height in DROPS:
        age = (phase - start) % 1
        if age >= lifetime:
            continue
        progress = age / lifetime
        opacity = min(1, progress * 10, (1 - progress) * 5)
        drop = sprites[width, height].copy()
        drop.putalpha(drop.getchannel("A").point(lambda value: round(value * opacity)))
        start_y = y - 8 * breathing_amount(start)
        position = (round(x + drift * progress), round(start_y + fall * progress**1.55))
        frame.alpha_composite(drop, position)


def bake():
    pose = load_pose()
    texture = premultiply(pose)
    sprites = {(w, h): sweat_sprite(w, h) for _, _, _, _, _, _, w, h in DROPS}
    atlas = Image.new("RGBA", (COLUMNS * SIZE, (FRAME_COUNT // COLUMNS) * SIZE))
    frames = []
    source_contacts = np.asarray(pose)[HANDS_FIXED_FROM:]
    for index in range(FRAME_COUNT):
        phase = index / FRAME_COUNT
        frame = breathing_pose(pose, texture, phase)
        if not np.array_equal(np.asarray(frame)[HANDS_FIXED_FROM:], source_contacts):
            raise ValueError("Breathing displaced the hands, knees, or shoes.")
        add_sweat(frame, phase, sprites)
        if frame.getchannel("A").getbbox()[3] != GROUND:
            raise ValueError("A frame moved the shoe baseline.")
        row, column = divmod(index, COLUMNS)
        atlas.paste(frame, (column * SIZE, row * SIZE))
        frames.append(frame)

    name = "envy-exhausted"
    atlas.save(OUTPUT / f"{name}-sheet.png", optimize=True)
    (OUTPUT / "animation.json").write_text(json.dumps({
        "name": name,
        "spriteSheet": f"{name}-sheet.png",
        "poseReference": "../references/envy-exhausted-open-hood.png",
        "orientationReference": "../references/envy-turnaround-hood-fit.png",
        "facing": "right, three-quarter",
        "originPx": ORIGIN,
        "frameSize": [SIZE, SIZE],
        "columns": COLUMNS,
        "rows": FRAME_COUNT // COLUMNS,
        "frameCount": FRAME_COUNT,
        "frameDurationMs": FRAME_MS,
        "durationMs": FRAME_COUNT * FRAME_MS,
        "loop": True,
    }, indent=2) + "\n", encoding="utf-8")

    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    left, top, right = min(b[0] for b in boxes) - 10, min(b[1] for b in boxes) - 12, max(b[2] for b in boxes) + 10
    crop = (left, top, right, GROUND + 12)
    preview = []
    for frame in frames:
        board = Image.new("RGB", (right - left, GROUND + 12 - top), "#e5ebf5")
        ImageDraw.Draw(board).line((0, GROUND - top, right - left, GROUND - top), fill="#9baac0")
        sprite = frame.crop(crop)
        board.paste(sprite, (0, 0), sprite)
        preview.append(board)
    preview[0].save(OUTPUT / f"{name}-preview.png", save_all=True, append_images=preview[1:],
                    duration=FRAME_MS, loop=0, disposal=0, blend=0, optimize=True)


if __name__ == "__main__":
    bake()
