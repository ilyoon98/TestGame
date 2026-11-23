extends SceneTree

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	for dimensions in [Vector2i(1100, 740), Vector2i(900, 650)]:
		var viewport := SubViewport.new()
		viewport.size = dimensions
		root.add_child(viewport)
		var game := Screen.instantiate()
		game.run = Run.new("MAP-TEST", {"widths":[2, 1, 3, 2], "shops":1, "rests":1, "elites":1, "mysteries":1})
		viewport.add_child(game)
		game.set_process(false)
		await process_frame
		var start := game.find_child("BeginCombat", true, false) as Button
		await _check_map(viewport, game)
		_expect(viewport.gui_get_focus_owner() == start, "Closing the map restores keyboard focus")
		start.pressed.emit()
		for tick in 30:
			if not game._active_event.is_empty():
				break
			game._process(0.1)
		var elapsed: int = game.run.elapsed
		var distance: int = game.run.distance
		var remaining: float = game._hold
		_expect(remaining > 0, "Test pauses during an action")
		_key(viewport, KEY_SPACE)
		_expect(game.paused, "Space pauses combat")
		await _check_map(viewport, game)
		_expect(game.paused, "Closing the map keeps a manual pause")
		_key(viewport, KEY_SPACE)
		_key(viewport, KEY_M)
		game._process(0.5)
		_expect(game.run.elapsed == elapsed and game.run.distance == distance and game._hold == remaining and game._audio.suspended,
			"Map freezes combat, pursuit, presentation and audio")
		_key(viewport, KEY_M)
		game._process(0.1)
		_expect(not game.paused and game._hold < remaining and not game._audio.suspended, "M closes and combat resumes")
		for tick in 400:
			if game.run.phase != "combat" and game._hold == 0.0:
				break
			game._process(0.1)
		_expect(game.run.phase == "recruit", "Battle reaches recruitment normally")
		await _check_map(viewport, game)
		game.find_child("DeclineRecruit", true, false).pressed.emit()
		var first_reward: String = game.run.rewards[0]
		_key(viewport, KEY_1)
		_expect(game.run.phase == "route" and game.run.levels.has(first_reward), "Reward keys select the matching card")
		var move := game.find_child("Move_" + String(game.run.data.map.threshold.next.front()), true, false)
		move.pressed.emit()
		_expect(game._traveling and game.run.area == "threshold", "Travel plays before the destination is committed")
		await game.arrived
		_expect(not game._traveling and game.run.area != "threshold", "Travel commits once on arrival")
		await _check_map(viewport, game)
		var before: Dictionary = game.run.data.map
		game.find_child("RestartRun", true, false).pressed.emit()
		_expect(game.run.area == "threshold" and game.run.phase == "prep" and game.run.data.map == before,
			"Restart is available before the ending and preserves the seed layout")
		viewport.free()
	if failures == 0:
		print("Read-only minimap, focus, Space, reward keys and combat pause passed at both viewport sizes")
	quit(int(failures > 0))


func _check_map(viewport: SubViewport, game: Control) -> void:
	_key(viewport, KEY_M)
	await process_frame
	var overlay: Control = game._minimap
	_expect(is_instance_valid(overlay) and not game._scroll.visible, "M opens a modal map")
	if not is_instance_valid(overlay):
		return
	_expect(overlay.find_child("Preview_" + game.run.area, true, false) != null, "Map includes the current room")
	_expect(overlay.find_children("Move_*", "Button", true, false).is_empty(), "Preview must never allow travel")
	_expect(viewport.gui_get_focus_owner() == overlay.find_child("CloseMinimap", true, false), "Close button receives focus")
	_key(viewport, KEY_ESCAPE)
	_expect(not is_instance_valid(game._minimap) and game._scroll.visible, "Escape closes the modal")


func _key(viewport: SubViewport, key: Key) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = true
	viewport.push_input(event)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
