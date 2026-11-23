extends SceneTree

const Startup := preload("res://ui/startup.tscn")
const Run := preload("res://combat/threshold_run.gd")
var _errors: Array[String] = []


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	_check_enabled_enemy()
	for size in [Vector2i(1100, 740), Vector2i(900, 650)]:
		var viewport := SubViewport.new()
		viewport.size = size
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(viewport)
		var startup := Startup.instantiate()
		startup.tutorial_path = "user://qa-test-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		viewport.add_child(startup)
		await process_frame
		_check_bounds(startup, "StartTraining", size)
		var seed := startup.find_child("Seed", true, false) as LineEdit
		seed.text = "V5-01"
		_press(startup, "StartTraining")
		var game: Control = startup._display
		game.set_process(false)
		var run: RefCounted = game.run
		_expect(run.training and run.phase == "prep" and run.seed == "V5-01", "Title opens seeded QA prep directly")
		_expect(not FileAccess.file_exists(startup.tutorial_path), "QA must preserve the first-run tutorial")
		_expect(run.living_roster().size() == 5 and run.ready_to_fight(), "All five members are available")
		_expect(run.companion.body.arms.hp == run.companion.body.arms.max, "Training guard starts healed")
		_expect(not run.data.map.has("exit") and run.data.map.values().all(func(room): return room.type in ["battle", "boss"]),
			"Training map contains only encounters")
		_expect(run.data.map == Run.new(run.seed, run.map_options, true).data.map, "Same seed generates the same training map")

		_press(game, "Member_companion3")
		_choose(game, "TrainingSkill0", "snapShot")
		_expect(run.companion3.loadout == ["snapShot", "aimedShot"], "Switching slots swaps the two skills")
		_expect(not run.set_training_skill("companion3", 0, "prayer"), "Archer cannot equip the nun's exclusive skill")
		_expect(not run.set_training_skill("companion3", 0, "strike"), "A card used by another ally is unavailable")
		_press(game, "Member_companion4")
		_press(game, "TrainingReserve")
		_expect(run.formation[1] == null, "Active ally can move to reserve")
		_press(game, "Member_companion")
		_expect(_find(game, "Rank0").disabled, "A reserve member cannot displace the nun")
		_press(game, "Rank1")
		_expect(run.formation[1] == "companion", "Reserve member can fill a position")
		_choose(game, "TrainingSkill0", null)
		_expect(_find(game, "BeginCombat").disabled, "Empty active skill slots block combat")
		_choose(game, "TrainingSkill0", "baton")
		_press(game, "TrainingEnemy")
		_choose(game, "TrainingDamage", null, 4)
		await process_frame
		_check_bounds(game, "TrainingSkill0", size)
		var ranks: Control = _find(game, "PrepRanks")
		var reserves: Control = _find(game, "TrainingReserves")
		_expect(ranks.get_global_rect().end.y <= reserves.get_global_rect().position.y,
			"Formation cards should not overlap the reserves")
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-training-prep.png")
		_press(game, "BeginCombat")
		_expect(run.phase == "combat" and not run.training_enemy_acts and run.training_enemy_damage == 5, "Battle honors QA settings")
		_expect(_find(game, "TrainingEnemy").disabled and _find(game, "TrainingDamage").disabled, "Enemy settings lock during battle")
		var enemy_acted := false
		for tick in 75:
			if run.step().get("actor") == "enemy":
				enemy_acted = true
		_expect(run.elapsed > 4000 and not enemy_acted and run.distance == 5, "Disabled enemy does not act and pursuit does not advance")
		_expect(run.enemy.hp == run.enemy.maxHp and run.phase == "combat", "Training enemy has infinite vitality")

		_choose(game, "InjurySide", "player")
		run.player.body.arms.guard = 99
		_choose(game, "InjuryCondition", "injured")
		_press(game, "ApplyInjury")
		_expect(run.player.body.arms.hp == 3 and run.events[0].blocked == 0, "QA arm injury bypasses guard and enemy multiplier")
		_choose(game, "InjuryCondition", "lost")
		_press(game, "ApplyInjury")
		_expect(run.player.body.arms.hp == 0 and not run.skill_available("heavy", "player"), "Lost arms disable heavy attack")
		await process_frame
		_check_bounds(game, "ApplyInjury", size)
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-training-combat.png")
		_choose(game, "InjuryCondition", "healthy")
		_press(game, "ApplyInjury")
		_expect(run.player.body.arms.hp == 7 and run.skill_available("heavy", "player"), "QA can restore a lost arm and its skill")

		_choose(game, "InjurySide", "companion")
		_choose(game, "InjuryPart", null, Run.PARTS.find("head"))
		_choose(game, "InjuryCondition", "lost")
		_press(game, "ApplyInjury")
		_expect(run.companion.body.head.hp == 0 and not run.party_sides().has("companion"), "A defeated ally leaves the formation")
		_expect(_find(game, "InjurySide").item_count == 2, "Injury editor updates active targets")
		_press(game, "TrainingMap")
		_expect(run.phase == "route" and run.party_sides().has("companion"), "Exiting combat restores the selected formation")
		_press(game, "Move_lift")
		_expect(run.phase == "prep" and run.area == "lift" and run.enemy.kind == "bellboy", "Training map can jump directly to a boss")
		_expect(run.companion.hp == run.companion.maxHp and run.companion3.loadout == ["snapShot", "aimedShot"],
			"Room switch restores health and keeps assigned skills")
		_press(game, "BeginCombat")
		_choose(game, "InjurySide", "player")
		_choose(game, "InjuryPart", null, Run.PARTS.find("head"))
		_press(game, "ApplyInjury")
		_expect(run.phase == "lost", "Nun head loss ends the attempt")
		game._process(1.0)
		_expect(game._pending_screen, "Loss screen waits for the final white HP trail")
		game._process(0.56)
		_press(game, "Restart")
		_expect(run.phase == "prep" and run.area == "lift" and run.player.body.head.hp == 9 and run.training_enemy_damage == 5,
			"Retry keeps the room and enemy settings while clearing wounds")
		_press(game, "ReturnTitle")
		_press(startup, "StartRun")
		_expect(startup.view == "comic", "Normal start still enters the opening")
		viewport.free()
	for error: String in _errors:
		push_error(error)
	if _errors.is_empty():
		print("Training roster, loadouts, map, injury controls and enemy settings passed at 1100×740 and 900×650")
	quit(0 if _errors.is_empty() else 1)


func _check_enabled_enemy() -> void:
	var run := Run.new("V5-01", null, true)
	_expect(run.set_training_enemy_damage(5) and run.begin(), "5× damage training starts")
	_expect(run.intent_power(run.intent()) == 25, "Heavy forecast is 25 at 5× damage")
	run.player.body.legs.guard = 3
	var hit: Dictionary
	for tick in 40:
		if run.step().get("actor") == "enemy":
			hit = run.events[0]
			break
	_expect(hit.get("blocked") == 3 and hit.get("dealt") == 7 and run.player.body.legs.hp == 0,
		"Enemy damage scales while guard blocks its normal flat amount")
	run.enemy.body.head.hp = 0
	run.enemy.body.arms.hp = 0
	run.step()
	_expect(run.enemy.body.head.hp == run.enemy.body.head.max and run.enemy.body.arms.hp == run.enemy.body.arms.max,
		"An infinite enemy restores its parts after losing its head")


func _check_bounds(game: Node, id: String, size: Vector2i) -> void:
	var control: Control = _find(game, id)
	var bounds := control.get_global_rect()
	_expect(Rect2(Vector2.ZERO, size).encloses(bounds), "%s at %s extends outside %s" % [id, bounds, size])


func _find(root_node: Node, id: String) -> Node:
	var node := root_node.find_child(id, true, false)
	_expect(node != null, "Missing control: " + id)
	return node


func _press(root_node: Node, id: String) -> void:
	var button := _find(root_node, id) as Button
	if button != null:
		_expect(not button.disabled, "Disabled control: " + id)
		button.pressed.emit()


func _choose(root_node: Node, id: String, metadata: Variant, index := -1) -> void:
	var picker := _find(root_node, id) as OptionButton
	if picker == null:
		return
	if index < 0:
		for candidate in picker.item_count:
			if picker.get_item_metadata(candidate) == metadata:
				index = candidate
				break
	_expect(index >= 0, "Missing option in " + id + ": " + str(metadata))
	if index >= 0:
		picker.select(index)
		picker.item_selected.emit(index)


func _capture(viewport: SubViewport, directory: String, filename: String) -> void:
	_expect(viewport.get_texture().get_image().save_png(directory.path_join(filename)) == OK, "Capture failed")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_errors.append(message)
