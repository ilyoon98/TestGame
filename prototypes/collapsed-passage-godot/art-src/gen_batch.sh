#!/usr/bin/env bash
# Runs sprite-gen codex jobs from a job list, N at a time. Skips outputs that exist.
# Job line: <out.png>|<prompt.txt>|<transparent:yes/no>|<ref1>[,<ref2>...]
# usage: gen_batch.sh <jobs.txt> <status.txt> [parallel]
export PATH="/c/Users/imtl/AppData/Local/OpenAI/Codex/bin/5449c1f0f26f1f98:$PATH" PYTHONUTF8=1
SG=/c/Users/imtl/.claude/skills/sprite-gen/.venv/Scripts/sprite-gen.exe
JOBS=$1; STATUS=$2; PAR=${3:-4}
run_one() {
  IFS='|' read -r out prompt transparent refs <<< "$1"
  [ -f "$out" ] && { echo "$out skip" >> "$STATUS"; return; }
  args=(gen --provider codex --prompt-file "$prompt" --out "$out" --report "${out%.png}.json")
  [ "$transparent" = yes ] && args+=(--transparent --facing left)
  [ "$transparent" = icon ] && args+=(--transparent)
  IFS=',' read -ra rs <<< "$refs"
  for r in "${rs[@]}"; do [ -n "$r" ] && args+=(--ref "$r"); done
  "$SG" "${args[@]}" > "${out%.png}.log" 2>&1
  echo "$out exit $?" >> "$STATUS"
}
n=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  run_one "$line" &
  n=$((n+1))
  if [ $((n % PAR)) -eq 0 ]; then wait; fi
done < "$JOBS"
wait
echo done >> "$STATUS"
