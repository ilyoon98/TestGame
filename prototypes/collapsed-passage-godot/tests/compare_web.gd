extends SceneTree

const Run := preload("res://combat/threshold_run.gd")


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() != 1:
		push_error("Expected a path to the comparison cases")
		quit(1)
		return
	var cases: Array = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var results: Array = []
	for scenario: Dictionary in cases:
		results.append(_play(scenario))
	print("COMPARISON ", JSON.stringify(results))
	quit()


func _actor(actor: Dictionary) -> Dictionary:
	return {"hp": actor.hp, "body": actor.body.duplicate(true)}


func _play(scenario: Dictionary) -> Dictionary:
	var run := Run.new(scenario.seed, null)
	run.set_rank(int(scenario.rank))
	for id: String in run.data.loadout:
		run.toggle_skill(id)
	for id: String in scenario.skills:
		run.toggle_skill(id)
	if scenario.has("hp"):
		run.player.hp = int(scenario.hp)
	if scenario.has("distance"):
		run.distance = int(scenario.distance)
	if scenario.has("enemyHp"):
		run.enemy.hp = int(scenario.enemyHp)
	assert(run.begin())
	var trace: Array = []
	for i in 500:
		if run.phase != "combat":
			break
		var distance := run.distance
		var action := run.step()
		if action.has("id") or distance != run.distance:
			trace.append({"time": run.elapsed, "distance": run.distance, "action": action,
				"events": run.events.duplicate(true), "player": _actor(run.player), "enemy": _actor(run.enemy)})
	assert(run.phase in ["recruit", "lost"])
	var result := {"trace": trace, "phase": run.phase, "loss": run.loss_cause, "time": run.elapsed,
		"distance": run.distance, "player": _actor(run.player), "enemy": _actor(run.enemy)}
	if run.phase != "recruit":
		return result
	assert(not run.choose_reward("strike"))
	assert(run.decide_recruit(scenario.recruit))
	result.formation = run.formation
	result.guard = null
	if scenario.recruit:
		result.guard = _actor(run.companion)
		result.guard.loadout = run.companion.loadout
	result.rewards = run.rewards.duplicate()
	var slot := int(scenario.reward)
	var id := run.rewards[slot] if slot >= 0 else ""
	assert(not run.choose_reward("not-offered"))
	assert(run.choose_reward(id))
	assert(not run.choose_reward(id))
	result.chosen = id
	result.levels = run.levels
	result.chosenCooldown = run.cooldown(id) if not id.is_empty() else null
	if scenario.has("travelLegs"):
		run.player.hp -= run.player.body.legs.hp - int(scenario.travelLegs)
		run.player.body.legs.hp = int(scenario.travelLegs)
	if scenario.has("travelDistance"):
		run.distance = int(scenario.travelDistance)
	assert(not run.move_to("lift"))
	var journey: Array = [_travel_snapshot(run)]
	assert(run.move_to(scenario.destination))
	journey.append(_travel_snapshot(run))
	if scenario.has("treat"):
		var side: String = scenario.treat[0]
		var part: String = scenario.treat[1]
		journey.append({"treated": run.treat_at_stairs(side, part)})
		journey.append(_travel_snapshot(run))
		assert(not run.treat_at_stairs(side, part))
	if scenario.get("continueToLanding", false):
		assert(run.move_to("landing"))
		journey.append(_travel_snapshot(run))
	assert(not run.move_to("lift"))
	result.journey = journey
	return result


func _travel_snapshot(run: RefCounted) -> Dictionary:
	var guard: Variant = null
	if not run.companion.is_empty():
		guard = _actor(run.companion)
		guard.loadout = run.companion.loadout
	return {"area": run.area, "phase": run.phase, "loss": run.loss_cause,
		"trail": run.trail.duplicate(), "steps": run.steps, "distance": run.distance,
		"nextGain": run.travel_gain(), "time": run.combat_time,
		"player": _actor(run.player), "guard": guard, "enemy": _actor(run.enemy),
		"formation": run.formation, "loadout": run.loadout,
		"levels": run.levels, "restFinished": run.rest_finished, "treatment": run.stair_treatment}
