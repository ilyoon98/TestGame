extends SceneTree

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
	game.run = Run.new("QA-KEYS")
	viewport.add_child(game)
	game.set_process(false)
	_key(viewport, KEY_J)
	_expect(game.run.distance == 5, "QA keys are inactive while tools are hidden")
	_key(viewport, KEY_F8)
	_key(viewport, KEY_J)
	_expect(game.run.distance == 10 and game.run.qa_uses == 1, "J adds 5 with QA open")
	game.run.player.body.arms.hp = 0
	game.run.player.body.legs.guard = 2
	game.run.player.hp = 21
	_key(viewport, KEY_H)
	_expect(game.run.player.body.arms.hp == 7 and game.run.player.hp == 28 and game.run.player.body.legs.guard == 2,
		"QA recovery restores all parts and leaves guard")
	_key(viewport, KEY_K)
	_expect(game.run.phase == "recruit" and game.run.coins == 1, "QA win follows standard victory and recruitment")
	game.find_child("Recruit_guard", true, false).pressed.emit()
	_expect(game.run.party_sides().size() == 2 and game.run.phase == "reward", "QA victory opens ordinary rewards")
	_key(viewport, KEY_0)
	_expect(game.run.phase == "route", "0 skips a reward")
	game.find_child("ToggleJournal", true, false).pressed.emit()
	var journal := game.find_child("JournalEntries", true, false) as RichTextLabel
	_expect(journal.visible and journal.text.contains("간수 합류") and journal.text.contains("보상을 건너뛰"), "Journal records recruitment and reward decisions")
	game.run.pending_recruit = "shaman"
	game.run.phase = "recruit"
	game._show()
	var change := game.find_child("RecruitSynergy_join_mage", true, false) as Label
	_expect(change != null and change.text.contains("1→2") and not change.tooltip_text.is_empty(),
		"Recruitment previews an activated synergy and its effect")
	game.find_child("Recruit_shaman", true, false).pressed.emit()
	_expect(game.run.trait_counts().mage == 2, "Recruitment activates the previewed trait")
	game.run.pending_recruit = "archer"
	game.run.phase = "recruit"
	game._show()
	var shaman_slot: String = game.run.party_sides().filter(func(side): return game.run.get(side).kind == "shaman")[0]
	var lost := game.find_child("RecruitSynergy_" + shaman_slot + "_mage", true, false) as Label
	_expect(lost != null and lost.text.contains("2→1"), "Replacing a member previews a deactivated synergy")
	game.run._lose("pursuit")
	game._show()
	_expect(game.run.qa_uses == 3 and _visible_text(game, "치트 3회 사용"), "Ending includes QA use count")
	var scene := game.find_child("CaptureScene", true, false) as Control
	_expect(scene != null and game.run.journal.front().contains("사형수"), "Pursuit ending has a capture scene and a journal entry")
	await create_timer(0.03).timeout
	_expect(scene.elapsed > 0.0, "Capture scene advances as a native animation")
	game.free()

	game = Screen.instantiate()
	game.run = Run.new("QA-TRAITS", null, true)
	viewport.add_child(game)
	game.set_process(false)
	_expect(game.find_child("Synergy_mage", true, false) != null, "Prep shows the active mage synergy")
	await process_frame
	var source := game.find_child("Member_companion3", true, false) as Button
	var middle := game.find_child("Rank1", true, false) as Button
	_drag(viewport, source.get_global_rect().get_center(), middle.get_global_rect().get_center())
	await process_frame
	_expect(game.run.formation[1] == "companion3" and game.run.formation[2] == "companion4",
		"Dragging an active member onto a rank swaps the two members")
	game.find_child("Member_companion4", true, false).pressed.emit()
	game.find_child("TrainingReserve", true, false).pressed.emit()
	_expect(game.find_child("Synergy_mage", true, false) == null, "Moving a member to reserve removes its synergy")
	_key(viewport, KEY_F8)
	_key(viewport, KEY_K)
	_key(viewport, KEY_J)
	_expect(game.run.qa_uses == 0 and game.find_child("Qa_win", true, false).disabled and game.find_child("Qa_margin", true, false).disabled,
		"Training only allows the QA recovery action")
	viewport.free()
	if failures == 0:
		print("QA keyboard actions, standard rewards, active traits and recruitment changes passed")
	quit(int(failures > 0))


func _visible_text(parent: Node, value: String) -> bool:
	for label: Label in parent.find_children("*", "Label", true, false):
		if label.text.contains(value):
			return true
	return false


func _key(viewport: SubViewport, key: Key) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = true
	viewport.push_input(event)


func _drag(viewport: SubViewport, from: Vector2, to: Vector2) -> void:
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.position = from
	press.pressed = true
	viewport.push_input(press, true)
	var motion := InputEventMouseMotion.new()
	motion.position = to
	motion.relative = to - from
	motion.button_mask = MOUSE_BUTTON_MASK_LEFT
	viewport.push_input(motion, true)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.position = to
	viewport.push_input(release, true)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
