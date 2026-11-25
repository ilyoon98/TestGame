"""Set floor 2-3 foe numbers in data/floors.json. hp order: head, eyes, arms, chest, belly, legs."""
import json, sys
from pathlib import Path
STATS = json.loads(sys.argv[2])
p = Path(sys.argv[1])
d = json.loads(p.read_text(encoding="utf-8"))
for foe, s in STATS.items():
    d["foes"][foe].update(s)
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("tuned", ", ".join(STATS))
