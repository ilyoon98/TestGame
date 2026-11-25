extends RefCounted
## Places rooms in ordered columns with identical output to the web seed generator.

const Random := preload("res://world/seed_random.gd")
const MAX_STAGES := 4
const MAX_STAGE_ROOMS := 3
## `floors` is Godot-only: options without it (web parity fixtures) keep the single-floor run.
const DEFAULT_OPTIONS := {"widths": [3, 3, 3, 2], "shops": 1, "rests": 1, "elites": 1, "mysteries": 1, "floors": 3}
const SPECIAL := {
	"shop": {"name": "암시장"},
	"rest": {"name": "휴게소"},
	"elite": {"name": "독방", "arena": "art/arena/solitary.webp", "foe": "sentinel", "recruits": ["archer"]},
	"mystery": {"name": "?"},
}
## The first floor as the web build lays it out. Other floors come from data/floors.json.
const FIRST_FLOOR := {"start": "threshold", "boss": "lift", "end": "exit", "battles": ["duct", "infirmary", "landing"]}


static func parse_widths(text: String) -> Array[int]:
	var fields := text.split(",")
	var widths: Array[int] = []
	if fields.size() > MAX_STAGES:
		return []
	for field in fields:
		var value := field.strip_edges()
		var width := value.to_int()
		if not value.is_valid_int() or width < 1 or width > MAX_STAGE_ROOMS:
			return []
		widths.append(width)
	return widths


## `floor` names the start, boss and end rooms, the battle room pool and the elite room.
static func generate(seed: String, options: Dictionary, rooms: Dictionary, event_ids: Array,
		floor: Dictionary = FIRST_FLOOR) -> Dictionary:
	var random := Random.new(seed)
	var widths: Array = options.widths
	var total := 0
	for width in widths:
		total += int(width)
	var counts := {"shop": int(options.shops), "rest": int(options.rests), "elite": int(options.elites),
		"mystery": int(options.get("mysteries", 0))}
	counts.battle = total - counts.shop - counts.rest - counts.elite - counts.mystery
	var start: String = floor.start
	var boss: String = floor.boss
	var end: String = floor.end
	var special := SPECIAL.duplicate(true)
	if floor.has("elite"):
		special.elite = floor.elite
	var result := {start: rooms[start].duplicate()}
	result[start].merge({"col": 1, "row": 2, "next": []}, true)
	var stages := [[start]]
	var candidates := []
	for stage in widths.size():
		var width := int(widths[stage])
		var rows := [2] if width == 1 else random.shuffled([1, 2, 3]).slice(0, width)
		rows.sort()
		var layer := []
		for row in rows:
			var id := "room-%d-%d" % [stage + 1, row]
			result[id] = {"col": stage + 2, "row": row, "next": []}
			layer.append(id)
			candidates.append(id)
		stages.append(layer)
	stages.append([boss])
	stages.append([end])
	for id in [boss, end]:
		result[id] = rooms[id].duplicate()
		result[id].merge({"col": stages.size() - (1 if id == boss else 0), "row": 2, "next": []}, true)
	_connect(result, stages, random)
	var placement_random := Random.new(JSON.stringify(["placement", seed]))
	var placement := _place_rooms(result, candidates, counts, int(widths[0]), placement_random)
	for index in candidates.size():
		var id: String = candidates[index]
		var room: Dictionary = result[id]
		var type: String = placement[index]
		var room_random := Random.new(JSON.stringify(["room", seed, id]))
		room.merge({"arena": rooms[start].arena, "foe": "", "recruits": [], "type": type})
		if type == "battle":
			var pool: Array = floor.battles
			var source: Dictionary = rooms[pool[floori(room_random.real() * pool.size())]]
			for field in ["name", "arena", "foe", "recruits"]:
				room[field] = source[field]
		else:
			room.merge(special[type], true)
			if type == "mystery":
				room.event = event_ids[floori(room_random.real() * event_ids.size())]
	return result


static func _connect(rooms: Dictionary, stages: Array, random: RefCounted) -> void:
	# Walk adjacent columns together so all rooms are reachable without crossing links.
	for stage in stages.size() - 1:
		var source: Array = stages[stage]
		var destination: Array = stages[stage + 1]
		var left := 0
		var right := 0
		while true:
			rooms[source[left]].next.append(destination[right])
			var last_left := left == source.size() - 1
			var last_right := right == destination.size() - 1
			if last_left and last_right:
				break
			var choice: float = random.real()
			if not last_left and (last_right or choice < 0.67):
				left += 1
			if not last_right and (last_left or choice > 0.33):
				right += 1


static func _place_rooms(rooms: Dictionary, ids: Array, counts: Dictionary, first_width: int, random: RefCounted) -> Array:
	var pool := []
	for type in counts:
		for i in counts[type]:
			pool.append(type)
	var choices := []
	var previous := []
	for id in ids:
		var ordered := []
		for type in random.shuffled(pool):
			if type not in ordered:
				ordered.append(type)
		choices.append(ordered)
		var neighbors := []
		for index in ids.size():
			if rooms[ids[index]].next.has(id):
				neighbors.append(index)
		previous.append(neighbors)
	var placement := []
	placement.resize(ids.size())
	var first_elites := maxi(0, counts.elite - (ids.size() - first_width))
	var repeat_budget := 0
	while not _assign(choices, previous, counts, placement, first_width, 0, repeat_budget, first_elites):
		repeat_budget += 1
	return placement


static func _assign(choices: Array, previous: Array, counts: Dictionary, placement: Array,
		first_width: int, index: int, repeat_budget: int, early_elites: int) -> bool:
	if index == choices.size():
		return true
	var early := index < first_width
	for type in choices[index]:
		if not counts[type] or (early and type == "elite" and early_elites == 0):
			continue
		if early and type != "elite" and first_width - index == early_elites:
			continue
		var repeats := 0
		if type != "battle":
			for neighbor in previous[index]:
				repeats += int(placement[neighbor] == type)
		if repeats > repeat_budget:
			continue
		placement[index] = type
		counts[type] -= 1
		var placed := _assign(choices, previous, counts, placement, first_width, index + 1,
			repeat_budget - repeats, early_elites - int(early and type == "elite"))
		counts[type] += 1
		if placed:
			return true
	return false
