extends SceneTree
## Plays full three-floor runs with real combat and prints balance telemetry.
## Policies see only what the screen shows (map types, HP, coins, margin).
##   first    - monotonous: first path, accept recruits, first reward, no rest/shop use
##   sensible - human-limited decisions: equips learned attacks, rests when hurt,
##              shops with coins, avoids elites when weak, treats the worst wound
##   builder  - sensible routing plus full deck building: every party member equips
##              its learned cards over its lowest-level card, rewards upgrade equipped cards
## usage: godot --headless --path . --script res://tests/sim_balance.gd -- [runs] [policy,...] [json_out]

const Run := preload("res://combat/threshold_run.gd")
const SeedMap := preload("res://world/seed_map.gd")
const STARTERS := ["strike", "heavy", "guard"]


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var runs := int(args[0]) if args.size() > 0 else 40
	var policies: PackedStringArray = (args[1] if args.size() > 1 else "first,sensible").split(",")
	var results := []
	for policy in policies:
		for i in runs:
			results.append(_play("SIM-%d" % i, policy))
	if args.size() > 2:
		var file := FileAccess.open(args[2], FileAccess.WRITE)
		file.store_string(JSON.stringify(results))
	_summarize(results, policies)
	quit()


func _play(seed: String, policy: String) -> Dictionary:
	var run := Run.new(seed, SeedMap.DEFAULT_OPTIONS)
	var fights := []
	var arrivals := [run.distance]
	for guard in 400:
		match run.phase:
			"prep":
				if policy == "sensible":
					_equip_learned(run)
				elif policy == "builder":
					_build_deck(run)
				fights.append(_fight(run))
			"recruit":
				var full: bool = run.party_sides().size() == Run.RANKS.size()
				run.decide_recruit(not full)
			"reward":
				run.choose_reward(_pick_reward(run, policy))
			"route":
				var before: int = run.floor
				_route(run, policy)
				if run.floor != before:
					arrivals.append(run.distance)
			_:
				break
	var decks := {}
	for side: String in run.party_sides():
		decks[run.get(side).kind] = run.side_loadout(side).map(func(id): return "%s:%d" % [id, int(run.levels.get(id, 0))] if id != null else "-")
	return {"decks": decks, "growth": _growth(run), "seed": seed, "policy": policy, "phase": run.phase, "cause": run.loss_cause, "floor": run.floor + 1,
		"area": run.area, "foe": run.enemy.get("kind", ""), "fights": fights, "arrivals": arrivals,
		"party": run.party_sides().size(), "coins": run.coins}


func _party_hp(run: RefCounted) -> float:
	var hp := 0.0
	var top := 0.0
	# Fallen allies count as zero so a death never reads as healing.
	for side: String in ["player"] + Array(Run.COMPANION_SIDES):
		var actor: Dictionary = run.get(side)
		if actor.is_empty():
			continue
		hp += 0 if run.down(actor) else actor.hp
		top += actor.maxHp
	return hp / maxf(top, 1.0)


func _fight(run: RefCounted) -> Dictionary:
	var room: Dictionary = run.data.map[run.area]
	var record := {"floor": run.floor + 1, "foe": room.foe, "type": room.type, "hp_before": _party_hp(run),
		"fallen_before": run.fallen_names().size(),
		"margin_before": run.distance, "party": run.party_sides().size()}
	if not run.begin():
		record.error = "could not begin"
		run.phase = "lost"
		return record
	var acts := 0
	for tick in 20000:
		if run.phase != "combat":
			break
		var action: Dictionary = run.step()
		acts += int(action.get("actor", "") == "enemy")
	record.enemy_acts = acts
	record.kill = "head" if run.enemy.body.head.hp == 0 else "hp" if run.enemy.hp == 0 else "-"
	record.time = run.combat_time
	record.result = "win" if run.phase not in ["lost", "combat"] else run.loss_cause if run.phase == "lost" else "stalled"
	record.hp_after = _party_hp(run)
	record.margin_after = run.distance
	record.fallen = run.fallen_names().size()
	run.combat_time = 0
	return record


func _equip_learned(run: RefCounted) -> void:
	for id: String in run.levels:
		if id in STARTERS or not run.available_skills("player").has(id) or not run.equipped_by(id).is_empty():
			continue
		if run.cards[id].type != "attack":
			continue
		var before = run.loadout[1]
		if before != null:
			run.toggle_skill(before)
		if not run.toggle_skill(id) and before != null:
			run.toggle_skill(before)
		return


func _growth(run: RefCounted) -> int:
	var total := 0
	for id: String in run.levels:
		total += int(run.levels[id])
	return total


func _build_deck(run: RefCounted) -> void:
	for side: String in run.party_sides():
		var deck: Array = run.side_loadout(side)
		for id: String in run.available_skills(side):
			if not run.levels.has(id) or not run.equipped_by(id).is_empty():
				continue
			var weakest := -1
			var low := 99
			for slot in deck.size():
				var held = deck[slot]
				var level := 0 if held == null else int(run.levels.get(held, 1))  # starting cards are level 1
				if level < low:
					low = level
					weakest = slot
			if weakest < 0 or low > int(run.levels[id]) or (low == int(run.levels[id]) and deck[weakest] != null and not (deck[weakest] in STARTERS)):
				continue
			var before = deck[weakest]
			if before != null:
				run.toggle_skill(before, side)
			if not run.toggle_skill(id, side) and before != null:
				run.toggle_skill(before, side)


func _pick_reward(run: RefCounted, policy: String) -> String:
	if policy == "first":
		return run.rewards[0]
	for id: String in run.rewards:
		if run.levels.has(id) and not run.equipped_by(id).is_empty():
			return id
	return run.rewards[0]


func _route(run: RefCounted, policy: String) -> void:
	var room: Dictionary = run.data.map[run.area]
	if policy != "first":
		if room.type == "rest" and not run.rest_finished:
			var wound := _worst_wound(run)
			if not wound.is_empty() and run.can_treat(wound[0], wound[1]):
				run.treat_at_stairs(wound[0], wound[1])
			else:
				run.finish_rest()
		if room.type == "shop":
			for id in ["bandage", "tonic", "oil"]:
				var targets: Dictionary = run.shop_targets(id) if id != "oil" else {"": ""}
				if run.shop_issue(id).is_empty() and not targets.is_empty():
					run.buy_shop_offer(id, targets.keys()[0])
	if not run.pending_mystery.is_empty():
		var take: bool = policy != "first" and run.mystery_issue().is_empty() and run.distance + run.mystery_distance() >= 4
		run.resolve_mystery(take)
	var next: Array = room.next
	var choice: String = next[0]
	if policy != "first":
		var best := -INF
		var hp := _party_hp(run)
		for id: String in next:
			var type: String = run.data.map[id].type
			var score := 0.0
			match type:
				"rest": score = 3.0 if hp < 0.75 else 0.5
				"shop": score = 2.0 if run.coins >= 1 else -0.5
				"elite": score = 1.0 if hp > 0.8 and run.party_sides().size() >= 2 else -2.0
				"mystery": score = 0.8
				"battle": score = 1.2 if hp > 0.6 else 0.2
				_: score = 0.0
			if score > best:
				best = score
				choice = id
	run.move_to(choice)


func _worst_wound(run: RefCounted) -> Array:
	var worst := []
	var gap := 0
	for side: String in run.party_sides():
		for part: String in Run.PARTS:
			var wound: Dictionary = run.get(side).body[part]
			if wound.hp > 0 and wound.max - wound.hp > gap:
				gap = wound.max - wound.hp
				worst = [side, part]
	return worst


func _summarize(results: Array, policies: PackedStringArray) -> void:
	for policy in policies:
		var runs := results.filter(func(r): return r.policy == policy)
		var reach := [0, 0, 0]
		var won := 0
		var causes := {}
		var deaths := {}
		for r: Dictionary in runs:
			for f in r.floor:
				reach[f] += 1
			won += int(r.phase == "won")
			if r.phase == "lost":
				causes[r.cause] = causes.get(r.cause, 0) + 1
				var key := "F%d %s" % [r.floor, r.foe]
				deaths[key] = deaths.get(key, 0) + 1
		print("== %s: %d runs, escaped %d (%.0f%%), reached floor 2: %d, floor 3: %d" % [
			policy, runs.size(), won, 100.0 * won / runs.size(), reach[1], reach[2]])
		print("   clear rate  F1 %.0f%%  F2 %.0f%%  F3 %.0f%%" % [100.0 * reach[1] / maxi(reach[0], 1),
			100.0 * reach[2] / maxi(reach[1], 1), 100.0 * won / maxi(reach[2], 1)])
		print("   losses by cause: ", causes)
		print("   losses by floor/foe: ", deaths)
		var stats := {}
		for r: Dictionary in runs:
			for f: Dictionary in r.fights:
				if not f.has("time"):
					continue
				var key := "F%d %-10s %s" % [f.floor, f.foe, f.type]
				var s: Dictionary = stats.get(key, {"n": 0, "time": 0.0, "hp": 0.0, "margin": 0.0, "loss": 0, "acts": 0, "head": 0, "party": 0, "fallen": 0})
				s.acts += f.enemy_acts
				s.head += int(f.kill == "head")
				s.party += f.party
				s.fallen += f.fallen - f.get("fallen_before", 0)
				s.n += 1
				s.time += f.time / 1000.0
				s.hp += f.hp_before - f.hp_after
				s.margin += f.margin_after - f.margin_before
				s.loss += int(f.result != "win")
				stats[key] = s
		var keys := stats.keys()
		keys.sort()
		for key: String in keys:
			var s: Dictionary = stats[key]
			print("   %s n=%3d  time %5.1fs  hp lost %4.0f%%  margin %+5.1f  losses %d  foe acts %.1f  head kills %3.0f%%  party %.1f  allies lost %.2f" % [
				key, s.n, s.time / s.n, 100.0 * s.hp / s.n, s.margin / s.n, s.loss, float(s.acts) / s.n, 100.0 * s.head / s.n, float(s.party) / s.n, float(s.fallen) / s.n])
		var arrivals := [[], [], []]
		for r: Dictionary in runs:
			for i in r.arrivals.size():
				arrivals[i].append(r.arrivals[i])
		for i in 3:
			if not arrivals[i].is_empty():
				var total := 0
				for v in arrivals[i]:
					total += v
				print("   margin on reaching floor %d: avg %.1f (n=%d)" % [i + 1, float(total) / arrivals[i].size(), arrivals[i].size()])
