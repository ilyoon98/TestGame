"""Write data/floors.json visuals for the framed floor 2-3 enemies.

Anchors (percent of the image) are where hit effects land. They are placed on
each pose's painted bounding box: enemies face left, so the face sits left of
centre. The hound is a four-legged body with the head at the left end.

usage: python visuals.py <project_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

POSES = ["idle", "attack", "hit", "guard", "defeat"]
FOES = ["keeper", "hound", "scalder", "halberdier", "chief", "informant", "lookout", "zealot", "gatekeeper", "warden"]
# Fractions of the painted box (x from left, y from top).
BIPED = {"head": (0.45, 0.12), "eyes": (0.40, 0.16), "arms": (0.30, 0.42), "chest": (0.48, 0.40),
         "belly": (0.50, 0.56), "legs": (0.50, 0.84)}
FOUR_LEGS = {"head": (0.16, 0.30), "eyes": (0.12, 0.30), "arms": (0.28, 0.75), "chest": (0.35, 0.50),
             "belly": (0.55, 0.60), "legs": (0.75, 0.80)}
LYING = {"head": (0.15, 0.45), "eyes": (0.12, 0.45), "arms": (0.35, 0.60), "chest": (0.38, 0.50),
         "belly": (0.58, 0.55), "legs": (0.82, 0.60)}


def anchors(path: Path, layout: dict) -> dict:
    alpha = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
    h, w = alpha.shape
    ys, xs = np.where(alpha > 24)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    return {part: [round(100 * (x0 + fx * (x1 - x0)) / w, 1), round(100 * (y0 + fy * (y1 - y0)) / h, 1)]
            for part, (fx, fy) in layout.items()}


def main(root: Path) -> None:
    data_path = root / "data" / "floors.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    for foe in FOES:
        files = {pose: f"art/characters/foes/{foe}-{pose}.webp" for pose in POSES}
        marks = {}
        for pose in POSES:
            layout = LYING if pose == "defeat" else FOUR_LEGS if foe == "hound" else BIPED
            marks[pose] = anchors(root / files[pose], layout)
        data["visuals"][foe] = {"idle": files["idle"], "poses": {p: files[p] for p in POSES if p != "idle"},
                                "anchors": marks, "armLoss": {}, "kneeling": {}}
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("visuals for", len(FOES), "foes")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
