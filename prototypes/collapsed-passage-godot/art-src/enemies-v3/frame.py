"""Place floor 2-3 enemy stills on the enemy canvas.

Standing poses go on a 1536-tall canvas, at least 1280 wide (same as the floor 1
redraw) and wider when a weapon reaches far: feet on y=FLOOR, body centred.
The battle box is wider than tall, so the game scales by height and a wider
canvas does not shrink the body. Each pose is scaled so its painted area matches the idle
pose, which keeps the body the same size although the model drew every pose at
its own scale. Defeat poses are tight crops like the ally defeat art.
Key tint is removed from matte edges and from semi-transparent pixels (steam,
smoke) so no magenta or green shows on the dark arena.

usage: python frame.py <out_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).parent
CANVAS = (1280, 1536)
FLOOR = 1445
MAX_W = 1240
# Idle bounding-box height on the canvas (allies are ~1340-1400 tall; bosses larger).
IDLE_HEIGHT = {
    "keeper": 1180, "hound": 900, "scalder": 1150, "halberdier": 1390, "chief": 1360,
    "informant": 1150, "lookout": 1180, "zealot": 1200, "gatekeeper": 1340, "warden": 1390,
}
POSES = ["idle", "attack", "hit", "guard", "defeat"]


def despill(im: Image.Image) -> Image.Image:
    a = np.asarray(im).astype(np.float32)
    alpha = a[:, :, 3]
    hole = Image.fromarray(((alpha < 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    zone = ((np.asarray(hole) > 0) | (alpha < 250)) & (alpha > 0)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    magenta = np.clip(np.minimum(r, b) - g, 0, None) * zone
    green = np.clip(g - np.maximum(r, b), 0, None) * zone
    a[:, :, 0] = r - magenta
    a[:, :, 2] = b - magenta
    a[:, :, 1] = g - green
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def solid(im: Image.Image) -> tuple:
    alpha = np.asarray(im)[:, :, 3]
    ys, xs = np.where(alpha > 24)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), float((alpha > 128).sum())


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {}
    for foe, idle_h in IDLE_HEIGHT.items():
        idle = Image.open(HERE / "master" / f"{foe}-idle.png").convert("RGBA")
        (x0, y0, x1, y1), idle_area = solid(idle)
        scale = min(idle_h / (y1 - y0), MAX_W / (x1 - x0))
        report[foe] = {"scale": round(scale, 4)}
        for pose in POSES:
            src = HERE / ("master" if pose == "idle" else "poses") / f"{foe}-{pose}.png"
            im = despill(Image.open(src).convert("RGBA"))
            (x0, y0, x1, y1), area = solid(im)
            fig = im.crop((x0, y0, x1, y1))
            if pose == "defeat":
                pad = 24
                s = min(1.0, 1100 / fig.width)
                fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
                canvas = Image.new("RGBA", (fig.width + pad * 2, fig.height + pad * 2), (0, 0, 0, 0))
                canvas.alpha_composite(fig, (pad, pad))
            else:
                s = scale * (idle_area / area) ** 0.5
                s = min(s, (FLOOR - 40) / fig.height)
                fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
                # Centre the body, not the weapon: the median painted column sits on the body.
                body = int(np.median(np.where(np.asarray(fig)[:, :, 3] > 128)[1]))
                half = max(body, fig.width - body) + 20
                width = max(CANVAS[0], 2 * half)
                canvas = Image.new("RGBA", (width, CANVAS[1]), (0, 0, 0, 0))
                canvas.alpha_composite(fig, (width // 2 - body, FLOOR - fig.height))
            arr = np.asarray(canvas).copy()
            arr[arr[:, :, 3] == 0, :3] = 0
            Image.fromarray(arr, "RGBA").save(out_dir / f"{foe}-{pose}.webp", lossless=True, quality=60, method=2)
            report[foe][pose] = {"size": canvas.size, "scale": round(s, 4)}
    (HERE / "frame-report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("framed", len(report), "foes")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
