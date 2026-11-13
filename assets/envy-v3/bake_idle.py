"""Bake Envy's idle from the approved sprite. Requires NumPy and Pillow."""

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
FRAME_COUNT = 24
FPS = 12
FRAME_SIZE = 512
COLUMNS = 6
PIVOT_X, PIVOT_Y = 591.5, 584.0


def ramp(values, start, end):
    progress = np.clip((values - start) / (end - start), 0.0, 1.0)
    return progress * progress * (3.0 - 2.0 * progress)


def idle_frame(source, texture, x, y, phase):
    breath = (1.0 - math.cos(phase)) / 2.0
    upper_body = 1.0 - ramp(y, 423.0, 682.0)
    hood = 1.0 - ramp(y, 177.0, 256.0)
    hood_lag = math.sin(phase - 0.50) * breath

    # Let the console swing around the lower link. Feather the deformation
    # into the surrounding cloth and hold the hand beside it in place.
    swing = math.radians(7.5) * math.sin(phase - 0.42) * (0.30 + 0.70 * breath)
    swing -= math.radians(7.5) * math.sin(-0.42) * 0.30 * math.cos(phase)
    keyring = (
        ramp(y, 584.0, 608.0)
        * (1.0 - ramp(y, 684.0, 707.0))
        * ramp(x, 545.0, 574.0)
        * (1.0 - ramp(x, 623.0, 631.0))
    )
    dx, dy = x - PIVOT_X, y - PIVOT_Y
    cosine, sine = math.cos(swing), math.sin(swing)
    sample_x = x + keyring * ((cosine - 1.0) * dx + sine * dy)
    sample_y = y + keyring * (-sine * dx + (cosine - 1.0) * dy)
    sample_x -= 4.5 * hood_lag * hood
    sample_y += 5.5 * breath * upper_body + 1.5 * hood_lag * hood

    # Sample premultiplied RGBA so clear edge pixels cannot tint the art.
    left = np.floor(sample_x).astype(np.int32)
    top = np.floor(sample_y).astype(np.int32)
    u, v = (sample_x - left)[..., None], (sample_y - top)[..., None]
    above = texture[top, left] * (1.0 - u) + texture[top, left + 1] * u
    below = texture[top + 1, left] * (1.0 - u) + texture[top + 1, left + 1] * u
    rgba = above * (1.0 - v) + below * v
    alpha = rgba[..., 3:4]
    np.divide(rgba[..., :3] * 255.0, alpha, out=rgba[..., :3], where=alpha > 0)
    output = source.copy()
    output[112:710, 328:700] = np.rint(rgba).clip(0, 255).astype(np.uint8)
    return Image.fromarray(output).resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)


def main():
    source = np.asarray(Image.open(ROOT / "master_rgba.png").convert("RGBA"))
    if source.shape != (1024, 1024, 4):
        raise ValueError("The rig expects the registered 1024 × 1024 Envy master.")
    texture = source.astype(np.float32)
    texture[..., :3] *= texture[..., 3:4] / 255.0
    y, x = np.mgrid[112:710, 328:700].astype(np.float32)
    frames = [
        idle_frame(source, texture, x, y, math.tau * index / FRAME_COUNT)
        for index in range(FRAME_COUNT)
    ]
    stack = np.stack([np.asarray(frame) for frame in frames])
    if not np.all(stack[:, 380:] == stack[0, 380:]):
        raise ValueError("Pixels around the feet moved during the idle.")
    if any(frame.getchannel("A").getbbox()[3] != frames[0].getchannel("A").getbbox()[3] for frame in frames):
        raise ValueError("The alpha baseline shifted.")
    if len({frame.tobytes() for frame in frames}) != FRAME_COUNT:
        raise ValueError("The animation contains duplicate frames.")

    output = ROOT / "idle"
    output.mkdir(exist_ok=True)
    rows = math.ceil(FRAME_COUNT / COLUMNS)
    sheet = Image.new("RGBA", (COLUMNS * FRAME_SIZE, rows * FRAME_SIZE))
    for index, frame in enumerate(frames):
        row, column = divmod(index, COLUMNS)
        sheet.paste(frame, (column * FRAME_SIZE, row * FRAME_SIZE))
    sheet.save(output / "envy-idle-sheet.png", optimize=True)
    durations = [
        round((index + 1) * 1000 / FPS) - round(index * 1000 / FPS)
        for index in range(FRAME_COUNT)
    ]
    frames[0].save(
        output / "envy-idle-preview.png", save_all=True, append_images=frames[1:],
        duration=durations, loop=0, disposal=0, blend=0, optimize=True,
    )
    metadata = {
        "name": "envy-idle",
        "art_source": "code",
        "texture": "../master_rgba.png",
        "spriteSheet": "envy-idle-sheet.png",
        "frameSize": [FRAME_SIZE, FRAME_SIZE],
        "columns": COLUMNS,
        "rows": rows,
        "frameCount": FRAME_COUNT,
        "framesPerSecond": FPS,
        "durationsMs": durations,
        "originPx": [253.25, 463.0],
        "loop": True,
        "checks": {"feetFixed": True, "baselineFixed": True, "uniqueFrames": FRAME_COUNT},
    }
    (output / "animation.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
