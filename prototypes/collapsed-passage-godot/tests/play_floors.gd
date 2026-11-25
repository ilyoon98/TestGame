extends SceneTree
## Climbs all three floors with QA wins and checks the floor flow, layouts and determinism.

const Run := preload("res://combat/threshold_run.gd")
const SeedMap := preload("res://world/seed_map.gd")
var _errors: Array[String] = []


func _initialize() -> void:
	for seed in ["FLOORS-1", "FLOORS-2", "0", "탈출"]:
		_climb(seed)
	_check_single_floor()
	if _errors.is_empty():
		print("Three floors: start, boss, lift, arrival, exit and same-seed layouts passed")
	for error in _errors:
		push_error(error)
	quit(1 if not _errors.is_empty() else 0)


func _climb(seed: String) -> void:
	var run := Run.new(seed, SeedMap.DEFAULT_OPTIONS)
	var replay := Run.new(seed, SeedMap.DEFAULT_OPTIONS)
	_expect(run.floor_count == 3 and run.floor == 0 and run.area == "threshold", "Run starts on floor 1 at the threshold")
	_expect(run.floor_name() == "1층 격리 구역", "Floor 1 is named")
	_expect(_columns(run.data.map) == SeedMap.DEFAULT_OPTIONS.widths.size() + 3, "Floor 1 has four middle columns")
	_expect(run.data.map.has("ascend") and not run.data.map.has("exit"), "Floor 1 ends at the lift up, not the exit")
	var layouts := [run.data.map.duplicate(true)]
	var bosses: Array[String] = []
	for guard in 200:
		match run.phase:
			"prep":
				if run.data.map[run.area].type == "boss":
					bosses.append(run.enemy.kind)
				_expect(run.use_qa("win"), "QA win in %s" % run.area)
			"recruit": run.decide_recruit(false)
			"reward": run.choose_reward()
			"route":
				if not run.pending_mystery.is_empty():
					run.resolve_mystery(false)
				var before := run.floor
				var next: Array = run.data.map[run.area].next
				if next.is_empty():
					_expect(false, "Dead end at %s on floor %d" % [run.area, run.floor + 1])
					return
				_expect(run.move_to(next[0]), "Move from %s" % run.area)
				if run.floor != before:
					_expect(run.trail.size() == 1 and run.area == run.floor_plan().start, "Arrival resets the trail to the floor start")
					_expect(run.phase == "prep" and run.enemy.kind in ["keeper", "informant"], "Each floor opens with a fight")
					layouts.append(run.data.map.duplicate(true))
			"won", "lost": break
	_expect(run.phase == "won" and run.floor == 2, "%s should end escaped on floor 3, got %s floor %d" % [seed, run.phase, run.floor + 1])
	_expect(bosses == ["bellboy", "chief", "warden"], "Each floor ends with its boss: %s" % [bosses])
	_expect(layouts.size() == 3 and layouts[2].has("exit") and not layouts[1].has("exit"), "Only floor 3 has the exit")
	_expect(_columns(layouts[1]) == 8 and _columns(layouts[2]) == 8, "Floors 2-3 have five middle columns")
	for layout: Dictionary in layouts.slice(1):
		for room: Dictionary in layout.values():
			if room.type == "battle" or room.type == "elite":
				_expect(room.foe in run.floor_data.foes, "Upper floors use their own foes: %s" % room.foe)
			_expect(run.data.visuals.has(room.foe) or room.foe.is_empty(), "Foe %s has art" % room.foe)
	_expect(replay.data.map == layouts[0], "Same seed gives the same floor 1")


func _check_single_floor() -> void:
	var options := SeedMap.DEFAULT_OPTIONS.duplicate(true)
	options.erase("floors")
	var run := Run.new("SINGLE", options)
	_expect(run.floor_count == 1 and run.data.map.has("exit") and not run.data.map.has("ascend"),
		"Options without floors keep the web single-floor layout")
	_expect(run.floor_name().is_empty(), "Single-floor runs show no floor name")
	var training := Run.new("SINGLE", options, true)
	_expect(training.floor_count == 1 and not training.data.map.has("exit"), "Training stays on one floor")


func _columns(layout: Dictionary) -> int:
	var columns := 0
	for room: Dictionary in layout.values():
		columns = maxi(columns, int(room.col))
	return columns


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_errors.append(message)
