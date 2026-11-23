extends SceneTree

const Run := preload("res://combat/threshold_run.gd")

func _initialize() -> void:
	var cases: Array = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	var result: Array = []
	for test_case: Dictionary in cases:
		var run := Run.new(test_case.seed, test_case.get("options"))
		var frames: Array = []
		for command: Array in test_case.commands:
			_apply(run, command, frames)
			frames.append(_frame(run))
		var layout: Dictionary = run.data.map.duplicate(true)
		for room: Dictionary in layout.values():
			if not room.has("event"):
				room.event = ""
		result.append({"frames": frames, "layout": layout})
	print("STAGE ", JSON.stringify(result))
	quit()


func _apply(run: RefCounted, command: Array, frames: Array) -> void:
	match command[0]:
		"toggle": assert(run.toggle_skill(command[1], command[2]))
		"rank": run.set_rank(int(command[1]), command[2])
		"fight":
			assert(run.begin())
			for tick in 600:
				if run.phase != "combat":
					break
				var gate: String = run.gate_phase()
				var distance: int = run.distance
				var action: Dictionary = run.step()
				if action.has("id") or gate != run.gate_phase() or distance != run.distance:
					frames.append(_frame(run, action))
			assert(run.phase != "combat")
		"recruit": assert(run.decide_recruit(command[1], command[2]))
		"reward": assert(run.choose_reward(command[1]))
		"move": assert(run.move_to(command[1]))
		"treat": assert(run.treat_at_stairs(command[1], command[2]))
		"buy": assert(run.buy_shop_offer(command[1], command[2]))
		"mystery": assert(run.resolve_mystery(command[1]))


func _frame(run: RefCounted, action := {}) -> Dictionary:
	var party := {}
	for side: String in ["player", "companion", "companion2"]:
		var actor: Dictionary = run.get(side)
		if not actor.is_empty():
			party[side] = _actor(actor)
			party[side].loadout = run.side_loadout(side)
	return {
		"area": run.area, "phase": run.phase, "localTime": run.elapsed,
		"combatTime": run.combat_time, "distance": run.distance, "formation": run.formation,
		"loss": run.loss_cause, "party": party, "enemy": _actor(run.enemy),
		"pending": run.pending_recruit, "rewards": run.rewards, "levels": run.levels,
		"coins": run.coins, "oil": run.lantern_oil, "lockpicks": run.lockpicks, "mystery": run.pending_mystery,
		"gate": run.gate_phase(), "action": action, "events": run.events if action.has("id") else [],
	}.duplicate(true)


func _actor(actor: Dictionary) -> Dictionary:
	return {"hp": actor.hp, "body": actor.body}
