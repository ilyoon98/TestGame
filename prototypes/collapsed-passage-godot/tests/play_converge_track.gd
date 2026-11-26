extends SceneTree
## 수렴선: 아군 기술은 왼쪽, 적 행동은 오른쪽에서 남은 시간만큼 떨어져 있다가 중앙에서 발동한다.

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(900, 650)
	root.add_child(viewport)
	var game := Screen.instantiate()
	game.run = Run.new("READOUT", null, true)
	game.run.set_rank(1, "companion3")
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	var track: Control = game._converge
	_expect(track != null and track.name == "ConvergeTrack", "Combat builds the converge track")
	_expect(track.custom_minimum_size.y >= track.LANE * game.run.party_sides().size() + track.FOE_LANE,
		"Each ally gets a lane and the enemy gets one")
	var center: float = track.size.x * 0.5
	var tokens := _by_id(track)
	_expect(tokens.strike.left == 2000 and tokens.heavy.left == 6000, "Tokens start at each skill's full cooldown")
	_expect(track.token_x(tokens.strike.left, false) > track.token_x(tokens.heavy.left, false),
		"A shorter charge sits closer to the center")
	_expect(track.token_x(tokens.heavy.left, false) < center and track.token_x(3500, true) > center,
		"Allies approach from the left and the enemy from the right")
	_expect(is_equal_approx(track.token_x(0, false), center) and is_equal_approx(track.token_x(0, true), center),
		"Both sides fire at the same center line")
	_expect(tokens.aimedShot.state == "blocked" and tokens.aimedShot.label == "위치 제한",
		"A rank-locked skill is parked and explains why")
	_expect(track._foe.left == 3500 and track._foe.label.contains("5"), "The enemy token shows its intent and power")
	var before: float = track.token_x(track._left(tokens.strike), false)
	track.set_lead(50.0)
	_expect(track.token_x(track._left(tokens.strike), false) > before, "Time between ticks moves tokens smoothly")
	game.run.set_training_injury("player", "eyes", "lost")
	game._refresh_combat()
	_expect(track._foe.label == "?" and track._foe.symbol == "mystery", "Lost eyes hide the enemy token")
	game.run.set_training_injury("player", "eyes", "healthy")
	game.run.elapsed = 4300
	game._refresh_combat()
	tokens = _by_id(track)
	_expect(tokens.mending.state == "waiting" and tokens.mending.label == "회복 대기",
		"A charged heal waits at the center for a wound")
	game._mark_casting("strike")
	_expect(track._active == "strike", "The casting skill is highlighted on the track")
	game._mark_casting("")
	_expect(track._active == "", "Highlight clears after the cast")
	_expect(not track.accessibility_name.is_empty(), "The track describes the next action for screen readers")

	# 실제 진행: 발동하는 순간 그 기술의 토큰은 중앙에 있고, 발동 뒤에는 충전 시간만큼 물러난다.
	game.free()
	game = Screen.instantiate()
	game.run = Run.new("TRACK", null, true)
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	track = game._converge
	var fired := false
	for tick in 40:
		game._process(0.1)
		if game._active_skill == "strike":
			fired = true
			_expect(_by_id(track).strike.left == 0, "The firing token is at the center while its cast plays")
			break
	_expect(fired, "The basic attack fires within its two-second charge")
	_expect(track.token_x(track._left(_by_id(track).strike), false) == track.size.x * 0.5, "The firing token is drawn on the center line")
	for tick in 20:
		game._process(0.1)
		if game._hold == 0.0 and game._active_skill.is_empty():
			break
	game._refresh_combat()
	_expect(_by_id(track).strike.left > 1000, "After firing the token returns to the far side")
	game.free()

	# 실제 탈출 경로 전투에서는 수렴선과 기술 칸이 최소 창 안에 함께 보인다.
	game = Screen.instantiate()
	game.run = Run.new("CHASE", null)
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	await process_frame
	var bounds := Rect2(Vector2.ZERO, Vector2(viewport.size))
	_expect(bounds.encloses(game._converge.get_global_rect()), "The track fits the minimum viewport")
	viewport.free()
	if failures == 0:
		print("Converge track lanes, intent, waiting heal and cast highlight passed")
	quit(int(failures > 0))


func _by_id(track: Control) -> Dictionary:
	var result := {}
	for token: Dictionary in track._tokens:
		result[token.id] = token
	return result


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
