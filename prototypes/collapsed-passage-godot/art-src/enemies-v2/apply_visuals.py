"""Point visuals.<foe> at the redrawn art with per-pose anchors (percent of image).
Edits only those four blocks in place, leaving the rest of the file as it is."""
import json, re, sys
from pathlib import Path

ANCHORS = {
    "janitor": {
        "idle":   {"head": [37, 28], "eyes": [37, 33], "arms": [70, 57], "chest": [50, 48], "belly": [52, 62], "legs": [50, 82]},
        "attack": {"head": [34, 30], "eyes": [32, 36], "arms": [62, 22], "chest": [45, 50], "belly": [50, 62], "legs": [50, 82]},
        "hit":    {"head": [64, 29], "eyes": [64, 33], "arms": [30, 45], "chest": [55, 52], "belly": [52, 63], "legs": [45, 82]},
        "guard":  {"head": [41, 36], "eyes": [40, 41], "arms": [60, 53], "chest": [48, 58], "belly": [50, 68], "legs": [50, 83]},
        "defeat": {"head": [23.6, 79.0], "eyes": [21.6, 81.5], "arms": [45.1, 85.1], "chest": [50.0, 77.5], "belly": [64.7, 79.0], "legs": [84.2, 79.0]},
    },
    "crawler": {
        "idle":   {"head": [24, 47], "eyes": [24, 54], "arms": [70, 57], "chest": [50, 62], "belly": [55, 72], "legs": [62, 82]},
        "attack": {"head": [33, 57], "eyes": [31, 63], "arms": [12, 70], "chest": [48, 70], "belly": [60, 72], "legs": [80, 82]},
        "hit":    {"head": [40, 52], "eyes": [40, 58], "arms": [20, 68], "chest": [55, 68], "belly": [60, 75], "legs": [70, 82]},
        "guard":  {"head": [42, 55], "eyes": [40, 62], "arms": [42, 68], "chest": [52, 70], "belly": [55, 78], "legs": [55, 88]},
        "defeat": {"head": [23.6, 80.7], "eyes": [26.2, 82.7], "arms": [36.8, 89.4], "chest": [51.8, 84.4], "belly": [63.2, 84.4], "legs": [83.5, 86.2]},
    },
    "medic": {
        "idle":   {"head": [50, 27], "eyes": [44, 34], "arms": [30, 46], "chest": [48, 50], "belly": [48, 62], "legs": [48, 82]},
        "attack": {"head": [52, 34], "eyes": [45, 42], "arms": [25, 52], "chest": [55, 57], "belly": [55, 66], "legs": [55, 82]},
        "hit":    {"head": [64, 34], "eyes": [58, 38], "arms": [35, 30], "chest": [50, 55], "belly": [48, 65], "legs": [45, 82]},
        "guard":  {"head": [37, 38], "eyes": [32, 46], "arms": [35, 58], "chest": [40, 60], "belly": [42, 70], "legs": [45, 84]},
        "defeat": {"head": [18.6, 74.7], "eyes": [19.5, 80.2], "arms": [36.5, 82.8], "chest": [45.5, 76.3], "belly": [59.0, 77.9], "legs": [81.4, 77.9]},
    },
    "sentinel": {
        "idle":   {"head": [42, 14], "eyes": [42, 22], "arms": [78, 58], "chest": [60, 40], "belly": [55, 58], "legs": [50, 85]},
        "attack": {"head": [37, 38], "eyes": [37, 44], "arms": [85, 58], "chest": [60, 52], "belly": [55, 65], "legs": [55, 85]},
        "hit":    {"head": [70, 33], "eyes": [72, 40], "arms": [45, 42], "chest": [60, 57], "belly": [58, 67], "legs": [50, 82]},
        "guard":  {"head": [42, 34], "eyes": [42, 40], "arms": [55, 60], "chest": [55, 57], "belly": [55, 68], "legs": [55, 86]},
        "defeat": {"head": [7.5, 75.7], "eyes": [11.6, 79.2], "arms": [19.7, 84.3], "chest": [34.8, 77.2], "belly": [50.0, 75.7], "legs": [75.3, 75.7]},
    },
}

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
visuals_at = text.index('\n  "visuals": {')
for foe, anchors in ANCHORS.items():
    block = {
        "idle": f"art/characters/foes/{foe}-idle.webp",
        "poses": {p: f"art/characters/foes/{foe}-{p}.webp" for p in ("attack", "hit", "guard", "defeat")},
        "anchors": anchors,
        "armLoss": {},
        "kneeling": {},
    }
    start = text.index(f'\n    "{foe}": {{', visuals_at) + 1
    end = text.index('\n    }', start) + len('\n    }')
    body = json.dumps(block, indent=2, ensure_ascii=False).replace("\n", "\n    ")
    text = text[:start] + f'    "{foe}": ' + body + text[end:]
json.loads(text)
path.write_text(text, encoding="utf-8")
print("ok")
