extends SceneTree

const Run := preload("res://combat/threshold_run.gd")


func _initialize() -> void:
	var cases: Array = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	var actual := []
	for fixture: Dictionary in cases:
		actual.append(_first_action(fixture))
	print("SKILLS ", JSON.stringify(actual))
	quit()


func _first_action(fixture: Dictionary) -> Dictionary:
	var run := Run.new("skill-parity", {"widths": [1]}, true)
	run.formation = fixture.formation.duplicate()
	assert(run.set_training_enemy_acts(false))
	assert(run.set_training_skill(fixture.side, 0, fixture.id))
	assert(run.begin())
	for slot: Dictionary in run.slots:
		if slot.id != fixture.id:
			slot.readyAt = 999999
	for side: String in run.formation:
		run.get(side).body.arms.hp = 2
		run.get(side).body.legs.hp = 2
	if fixture.id == "woundCover":
		run._battle._heal("aid", "player", "player", "arms", 4)
	for tick in 500:
		var action := run.step()
		if action.get("id") != fixture.id:
			continue
		var fighters := {}
		for side: String in run.formation + ["enemy"]:
			var actor: Dictionary = run.get(side)
			fighters[side] = {"hp": actor.hp, "body": actor.body}
		return {"time": run.elapsed, "events": run.events, "fighters": fighters}
	push_error("Native skill did not activate: " + fixture.id)
	return {}
