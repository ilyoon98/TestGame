extends Control

const ActorPortrait := preload("res://ui/actor_portrait.gd")
const PARTS := preload("res://combat/threshold_run.gd").PARTS
var _background: TextureRect
var _guests: Array[Dictionary] = []


func setup(run: RefCounted, at_exit := false) -> void:
	var resting: bool = not at_exit and not run.rest_finished
	var file := "surface-exit" if at_exit else "camp" if resting else "camp-departure"
	var modes := {"surface-exit": "감옥 문 밖으로 새벽빛이 비치는 지상 출구",
		"camp": "어두운 감옥 통로 옆에 급히 피운 모닥불", "camp-departure": "화덕을 지나 다음 통로로 떠날 채비"}
	accessibility_name = modes[file]
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_background = TextureRect.new()
	_background.texture = load("res://art/locations/" + file + ".webp")
	_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_background)
	var roster := {}
	for side: String in run.living_roster():
		var actor: Dictionary = run.get(side)
		roster[actor.kind] = actor
	if at_exit:
		var spacing := minf(14, 56.0 / maxf(1, roster.size() - 1))
		var kinds := roster.keys()
		for index in kinds.size():
			var x := 55.0 + (index - (kinds.size() - 1) / 2.0) * spacing
			_add_guest(run, roster[kinds[index]], [x, 13 + index * 2, 22 if kinds.size() < 3 else 18], false)
	elif resting:
		for group: Dictionary in run.data.camp.groups:
			var nearby: Array = group.order.filter(func(kind): return roster.has(kind))
			for index in nearby.size():
				_add_guest(run, roster[nearby[index]], group.seats[nearby.size()][index], true)
	else:
		var seats: Array = run.data.camp.departure[roster.size()]
		var kinds := roster.keys()
		for index in kinds.size():
			_add_guest(run, roster[kinds[index]], seats[index], false)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


func _add_guest(run: RefCounted, actor: Dictionary, seat: Array, seated: bool) -> void:
	var conditions := {}
	for part: String in PARTS:
		var level: String = run.condition(actor, part)
		if level != "healthy":
			conditions[part] = level
	var visual: Dictionary = run.data.visuals[actor.kind]
	var wounds: Dictionary = run.data.wounds.duplicate()
	wounds.appearance = run.data.camp.appearance
	if seated:
		var arms: bool = conditions.get("arms") == "lost"
		var legs: bool = conditions.get("legs") == "lost"
		var variant := ("both" if arms else "legs") if legs else ("arms" if arms else "normal")
		var frame: Dictionary = run.data.camp.poses[actor.kind][variant]
		visual = {"idle": frame.src, "anchors": {"idle": frame.anchors}, "poses": {}, "armLoss": {}, "kneeling": {}}
	var portrait := ActorPortrait.new()
	portrait.name = "Guest_" + actor.kind
	portrait.setup(visual, wounds)
	portrait.set_conditions(conditions)
	add_child(portrait)
	_guests.append({"portrait": portrait, "seat": seat, "ratio": 1.125 if seated else 1.5})


func _layout() -> void:
	var art := _background.texture.get_size()
	var frame_size := art * minf(size.x / art.x, size.y / art.y)
	var origin := (size - frame_size) / 2.0
	_background.position = origin
	_background.size = frame_size
	for guest: Dictionary in _guests:
		var seat: Array = guest.seat
		var width := frame_size.x * float(seat[2]) / 100.0
		var height: float = width * guest.ratio
		var foot := origin + frame_size * Vector2(seat[0] / 100.0, 1.0 - seat[1] / 100.0)
		guest.portrait.position = foot - Vector2(width / 2.0, height)
		guest.portrait.size = Vector2(width, height)
