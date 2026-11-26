extends SceneTree
## 수렴선 검증. 화면이 보여 주는 예고를 실제 전투 진행(run.step())과 맞춰 본다.
## 1) 대기열 맨 앞(다음 아군 기술)은 매번 실제로 다음에 발동한 기술과 같아야 한다.
## 2) 막기 연결선이 붙은 방어 카드가 발동하고 적이 예고대로 치면, 그 타격은 실제로 가드에 막혀야 한다.
## 3) 화면 연출: 적 행동 연출 중에는 그 행동 카드가 대기열에 머물고, 연출이 끝나면 실제 상태로 돌아간다.

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
const Track := preload("res://ui/converge_track.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	_check_predictions()
	await _check_layout()
	await _check_screen()
	if failures == 0:
		print("Converge track: queue matches real firing order, guard links block, enemy cast pin and layout passed")
	quit(int(failures > 0))


## 여러 적과 무작위 장착(방어 카드 비중을 높임)으로 실제 전투를 돌리며 예고와 결과를 비교한다.
func _check_predictions() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var foes: Array = Run.new("FOES", null, true).data.foes.keys()
	var fired := 0
	var linked := 0
	for round in 24:
		var run := Run.new("TRACK-%d" % round, null, true)
		run.data.map[run.area].foe = foes[round % foes.size()]
		run._enter_room()
		_random_loadout(run, rng)
		if not run.begin():
			continue
		var track := Track.new()
		track.setup(run)
		track.size = Vector2(900, track.custom_minimum_size.y)
		var armed: Array[Dictionary] = []
		for tick in 900:
			if run.phase != "combat":
				break
			track.refresh(run.condition(run.player, "eyes"))
			var predicted := track.next_ally()
			var planned: Dictionary = run.intent()
			var links := {}
			for token: Dictionary in track._tokens:
				if token.guards:
					links[token.id] = {"side": planned.side, "part": planned.targets[0], "foe": planned.id}
			var action: Dictionary = run.step()
			if not action.has("id"):
				continue
			if action.actor != "enemy":
				fired += 1
				_expect(predicted == action.id, "Queue front %s is the skill that fires next (%s, round %d)" % [predicted, action.id, round])
				if links.has(action.id):
					armed.append(links[action.id])
				continue
			for claim: Dictionary in armed:
				var hit := {}
				for event: Dictionary in run.events:
					if event.type == "hit" and event.from == "enemy" and hit.is_empty():
						hit = event
				# 예고 뒤 아군 공격으로 적이 다른 행동을 하게 되면 예고는 무효다. 예고대로 쳤다면 반드시 막혀야 한다.
				if action.id == claim.foe and not hit.is_empty() and hit.side == claim.side and hit.targets[0] == claim.part:
					linked += 1
					_expect(int(hit.blocked) > 0, "A linked guard blocks the predicted hit (%s, round %d)" % [hit, round])
			armed.clear()
		track.free()
	_expect(fired > 500 and linked > 20, "The prediction rounds exercised enough fires (%d) and kept links (%d)" % [fired, linked])


func _random_loadout(run: RefCounted, rng: RandomNumberGenerator) -> void:
	var roster: Array = run.living_roster()
	for side: String in roster:
		var skills: Array = run.available_skills(side)
		var defense := skills.filter(func(id): return run.cards[id].type == "defense")
		var others := skills.filter(func(id): return run.cards[id].type != "defense")
		for slot in run.side_loadout(side).size():
			var pool: Array = defense if rng.randf() < 0.55 and not defense.is_empty() else others
			if not pool.is_empty():
				run.set_training_skill(side, slot, pool[rng.randi() % pool.size()])
	for change in 3:
		run.set_rank(rng.randi() % 3, roster[rng.randi() % roster.size()])


## 배치: 선 위 위치, 대기열 진입과 순서, 묶음, 막힌 기술, 눈 부상, 배속.
func _check_layout() -> void:
	var run := Run.new("READOUT", null, true)
	run.set_rank(1, "companion3")
	run.begin()
	var track := Track.new()
	track.setup(run)
	root.add_child(track)
	track.size = Vector2(900, track.custom_minimum_size.y)
	track.refresh("healthy")
	var center := track.size.x * 0.5
	var tokens := _by_id(track)
	_expect(track.token_x(tokens.strike.left, false) > track.token_x(tokens.heavy.left, false),
		"A shorter charge sits closer to the center")
	_expect(is_equal_approx(track.token_x(0, false), center) and track.token_x(3500, true) > center,
		"Allies come from the left, the enemy from the right, both firing on the center line")
	_expect(tokens.aimedShot.state == "blocked" and tokens.aimedShot.label == "위치 제한", "A rank-locked skill explains why")
	_expect(track._foe.label.contains("수녀 다리 5"), "The enemy token names its target and power")
	_expect(track.queue().is_empty() and not track.foe_queued(), "Nothing is queued while every charge is over a second away")
	await process_frame
	var before := track.placed("strike")
	track.set_lead(50.0)
	_expect(track.placed("strike").position.x > before.position.x, "Time between ticks moves tokens smoothly")
	# 실제로 1.1초까지 진행해 기본 공격이 1초 안으로 들어오게 한다.
	while run.elapsed < 1100:
		run.step()
	track.refresh("healthy")
	_expect(track.queue().size() == 1 and track.queue()[0].id == "strike", "A card under a second away lifts into the queue")
	_expect(track.moving() and track.placed("strike").size.x < track.CARD.x, "The card slides up instead of jumping")
	track.settle()
	_expect(not track.moving() and track.placed("strike").size == track.CARD, "The card lands in its queue slot")
	track.speed = 4
	_expect(track.lift_window() == 2000, "At high speed cards queue earlier so the queue stays readable")
	track.speed = 1
	run.set_training_injury("player", "eyes", "lost")
	track.refresh("lost")
	_expect(track._foe.label == "?", "Lost eyes hide the enemy card")
	_expect(not track._tokens.any(func(token): return token.guards), "Lost eyes show no guard links")
	run.set_training_injury("player", "eyes", "healthy")
	# 회복할 곳이 없는 회복 기술은 충전 중에도 대기로 보이고, 대기열에 오르면 맨 뒤에 선다.
	track.refresh("healthy")
	tokens = _by_id(track)
	_expect(tokens.mending.state == "waiting" and tokens.mending.label == "회복 대기",
		"A heal with nothing to heal is shown waiting even while it charges")
	track.free()
	# 적 행동을 끈 전투에서는 상처가 생기지 않으므로, 충전을 마친 회복 기술은 대기열 맨 뒤에서 기다린다.
	run = Run.new("READOUT", null, true)
	run.training_enemy_acts = false
	run.begin()
	track = Track.new()
	track.setup(run)
	root.add_child(track)
	track.size = Vector2(900, track.custom_minimum_size.y)
	while run.elapsed < 4300:
		run.step()
	track.refresh("healthy")
	var queued: Array = track.queue()
	_expect(not queued.is_empty() and queued.back().id == "mending" and queued.back().state == "waiting",
		"A charged heal with no wound waits at the back of the queue")
	_expect(track._foe.is_empty() and not track.foe_queued(), "With enemy actions off there is no enemy card")
	# 같은 자리의 토큰은 한 덩어리로 묶여 개수를 보여 준다.
	track.settle()
	var clusters := track._items.filter(func(item): return item.kind == "line" and item.tokens.size() > 1)
	for item: Dictionary in clusters:
		_expect(track.placed(item.tokens[0].id) == track.placed(item.tokens[1].id), "Clustered tokens share one place")
	track.free()


## 실제 화면: 적 행동 연출 중 고정, 연출 끝난 뒤 복귀, 발동 중인 아군 카드 고정.
func _check_screen() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(900, 650)
	root.add_child(viewport)
	var game := Screen.instantiate()
	game.run = Run.new("TRACK", null, true)
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	var track: Control = game._converge
	_expect(track.custom_minimum_size.y >= track.CARD.y + track.TOKEN, "The track has room for the queue and the line")
	var ally_pinned := false
	var enemy_pinned := false
	for tick in 400:
		game._process(0.05)
		if not ally_pinned and not game._active_skill.is_empty():
			ally_pinned = true
			_expect(track.queue()[0].id == game._active_skill, "The casting card stands at the front of the queue")
		if not enemy_pinned and track._active == track.ENEMY:
			var acting: String = game._active_event.card
			# 접촉 뒤 화면이 다시 갱신돼도 연출 중인 카드는 실제로 행동한 카드다.
			for step in 6:
				game._process(0.05)
				if track._active != track.ENEMY:
					break
				_expect(track._foe_cast.id == acting and track.foe_queued(), "The enemy card stays the acting one during its cast")
			enemy_pinned = true
		if enemy_pinned and track._active.is_empty() and game._hold == 0.0:
			_expect(track._foe_cast.is_empty() and track._foe.left > 0, "After the cast the enemy card shows its next action again")
			break
	_expect(ally_pinned and enemy_pinned, "Both an ally cast and an enemy cast were observed")
	game._mark_casting("strike")
	game._mark_casting("")
	_expect(_by_id(track).strike.left == maxi(0, game.run.slots.filter(func(slot): return slot.id == "strike")[0].readyAt - game.run.elapsed),
		"Clearing a cast restores the real charge at once")
	viewport.free()


func _by_id(track: Control) -> Dictionary:
	var result := {}
	for token: Dictionary in track._tokens:
		result[token.id] = token
	return result


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
