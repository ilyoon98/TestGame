"""Place generated enemy stills on the ally canvas.

Every pose goes on one 1280x1536 canvas (ally art is 1024x1536 with the same
floor): feet on y=FLOOR, centred, with HEAD_MATCH keeping the head the same
size across poses. The defeat pose lies on the same floor at DEFEAT_WIDTH, so
the battle box (fitted by height) draws it at the standing scale.
Edges keyed from magenta get a small despill so no purple rim shows on the
dark arena.

usage: python frame.py <out_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).parent
CANVAS = (1280, 1536)  # wider than the ally 1024 so lunges fit; the fighter box is height-limited
FLOOR = 1445          # ally soles sit at y 1433-1453
MAX_W = 1240
# Idle figure height on the canvas, per enemy (allies are ~1340-1400 tall).
IDLE_HEIGHT = {"janitor": 1150, "crawler": 820, "medic": 1100, "sentinel": 1320}
# Each pose was drawn at its own scale. These factors (idle head width / pose
# head width, measured by eye on the generated art) keep the head the same
# size in every pose.
HEAD_MATCH = {
    "janitor": {"attack": 1.26, "hit": 1.09, "guard": 1.0},
    "crawler": {"attack": 1.17, "hit": 1.28, "guard": 1.0},
    "medic": {"attack": 1.58, "hit": 1.2, "guard": 1.18},
    "sentinel": {"attack": 1.06, "hit": 1.085, "guard": 1.085},
}
# Body length of the lying defeat pose on the canvas, about the standing height.
DEFEAT_WIDTH = {"janitor": 1200, "crawler": 1080, "medic": 1100, "sentinel": 1240}
POSES = ["idle", "attack", "hit", "guard", "defeat"]


def despill(im: Image.Image) -> Image.Image:
    a = np.asarray(im).astype(np.float32)
    alpha = a[:, :, 3]
    # Pixels near the matte edge: partial alpha, or within 3 px of transparency.
    hole = Image.fromarray(((alpha < 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    edge = (np.asarray(hole) > 0) & (alpha > 0)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    m = np.minimum(r, b)
    spill = np.clip(m - g, 0, None) * edge
    a[:, :, 0] = r - spill
    a[:, :, 2] = b - spill
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def solid_bbox(im: Image.Image) -> tuple:
    alpha = np.asarray(im)[:, :, 3]
    ys, xs = np.where(alpha > 24)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {}
    for foe, idle_h in IDLE_HEIGHT.items():
        idle = Image.open(HERE / "master" / f"{foe}-idle.png").convert("RGBA")
        x0, y0, x1, y1 = solid_bbox(idle)
        scale = min(idle_h / (y1 - y0), MAX_W / (x1 - x0))
        report[foe] = {"scale": round(scale, 4)}
        for pose in POSES:
            src = HERE / ("master" if pose == "idle" else "poses") / f"{foe}-{pose}.png"
            im = despill(Image.open(src).convert("RGBA"))
            x0, y0, x1, y1 = solid_bbox(im)
            fig = im.crop((x0, y0, x1, y1))
            if pose == "defeat":
                wanted = DEFEAT_WIDTH[foe] / fig.width
            else:
                wanted = scale * HEAD_MATCH[foe].get(pose, 1.0)
            s = wanted
            if fig.width * s > MAX_W or fig.height * s > FLOOR - 40:
                s = min(MAX_W / fig.width, (FLOOR - 40) / fig.height)
            fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
            canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            canvas.alpha_composite(fig, ((CANVAS[0] - fig.width) // 2, FLOOR - fig.height))
            arr = np.asarray(canvas).copy()
            arr[arr[:, :, 3] == 0, :3] = 0
            canvas = Image.fromarray(arr, "RGBA")
            dest = out_dir / f"{foe}-{pose}.webp"
            canvas.save(dest, lossless=True, quality=100, method=6)
            report[foe][pose] = {"size": canvas.size, "scale": round(s, 4), "wanted": round(wanted, 4)}
    (HERE / "frame-report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
