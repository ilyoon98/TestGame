extends SceneTree

const Startup := preload("res://ui/startup.tscn")
var _errors: Array[String] = []


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	for size in [Vector2i(1100, 740), Vector2i(900, 650)]:
		var viewport := SubViewport.new()
		viewport.size = size
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(viewport)
		var startup := Startup.instantiate()
		var path := "user://codex-test-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		startup.tutorial_path = path
		viewport.add_child(startup)
		await process_frame
		var start_seed := startup.find_child("Seed", true, false) as LineEdit
		start_seed.text = "CODEX-2"
		var opener := startup.find_child("OpenCodex", true, false) as Button
		_press(startup, "OpenCodex")
		await process_frame
		var codex: Control = startup._codex
		_expect(codex.visible and not startup._display.visible, "Title book should open without starting the run")
		_check_focus(viewport, codex, "CloseCodex")
		var seen := {}
		for member: Dictionary in startup._data.codex.tabs:
			_press(codex, "Member_" + member.id)
			_press(codex, "Rarity_all")
			var member_cards: Array = startup._data.cards.filter(func(card):
				if not card.has("cooldown"):
					return false
				var personal: bool = card.has("character") or card.has("weapon")
				if member.id == "common":
					return not personal
				var profile: Dictionary = startup._data.nun if member.id == "nun" else startup._data.recruits[member.id]
				return personal and card.get("character", member.id) == member.id and card.get("weapon", profile.weapon) == profile.weapon)
			for card in member_cards:
				_expect(not seen.has(card.id), "Duplicate card in catalog: " + card.id)
				seen[card.id] = true
			_match_cards(codex, member_cards, member.id)
			if member.id == "common":
				_expect(codex.find_child("ProfileName", true, false) == null, "Common cards must not have a profile")
			else:
				_expect(codex.find_child("ProfileName", true, false) != null, "Character profile is missing")
				_press(codex, "ShowParts")
				var parts := codex.find_child("PartDurability", true, false) as Label
				_expect(parts != null and parts.visible and parts.text.contains("다리"), "Durability panel must open")
			for rarity: String in startup._data.rarities:
				_press(codex, "Rarity_" + rarity)
				var filtered: Array = member_cards.filter(func(card): return card.get("rarity", "common") == rarity)
				_match_cards(codex, filtered, member.id + "/" + rarity)
		_expect(seen.size() == 78, "Expected all 78 web catalog cards")

		_press(codex, "Member_archer")
		_press(codex, "Rarity_rare")
		await process_frame
		_expect(codex._grid.get_child_count() == 2, "Archer rare cards should contain two entries")
		var bounds: Rect2 = codex._grid.get_global_rect()
		_expect(bounds.end.x <= size.x, "Card grid extends past the right edge")
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			var output := args[0].path_join("godot-codex-archer.png")
			_expect(viewport.get_texture().get_image().save_png(output) == OK, "Capture failed")
		_press(codex, "CloseCodex")
		_expect(startup.view == "home" and start_seed.text == "CODEX-2", "Godot must return to the same title state")
		_expect(viewport.gui_get_focus_owner() == opener, "Closing should restore title button focus")

		_press(startup, "StartRun")
		_press(startup, "OpeningSkip")
		_press(startup, "OpeningSkip")
		var game: Control = startup._display
		await process_frame
		_press(game, "OpenCodex")
		_expect(codex._member == "archer" and codex._rarity == "rare", "The last codex filters should persist across screens")
		_press(codex, "CloseCodex")
		_expect(game.run.phase == "prep" and game.run.area == "threshold", "Closing book must keep preparation")
		game.set_process(false)
		_press(game, "BeginCombat")
		_check_clock(startup, game, codex)
		viewport.free()
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	if not _errors.is_empty():
		for error in _errors:
			push_error(error)
		quit(1)
		return
	print("78 unique cards, 24 member/rarity combinations, profiles, focus and battle freeze passed at both viewport sizes")
	quit()


func _match_cards(codex: Control, cards: Array, tag: String) -> void:
	var expected: Array = cards.map(func(card): return "Card_" + card.id)
	var actual: Array = codex._grid.get_children().map(func(node): return String(node.name))
	_expect(actual == expected, "Wrong visible card list for " + tag)
	_expect(codex._empty.visible == cards.is_empty(), "Wrong empty state for " + tag)


func _check_clock(startup: Control, game: Control, codex: Control) -> void:
	for tick in 24:
		if game._hold > 0:
			break
		game._process(0.1)
	var time := int(game.run.combat_time)
	var distance := int(game.run.distance)
	var hold := float(game._hold)
	_expect(hold > 0, "Test should open the codex in the middle of an action")
	_press(game, "OpenCodex")
	for tick in 20:
		game._process(0.1)
	_expect(game.run.combat_time == time and game.run.distance == distance and game._hold == hold,
		"Opening the codex must freeze the clock, pursuit and pending pose")
	_press(codex, "CloseCodex")
	_expect(not game.paused, "Resuming a previously active battle should preserve its play state")
	for tick in 10:
		game._process(0.1)
	_expect(game.run.combat_time > time, "Closing the codex should allow an active battle to resume")
	game._pause.pressed.emit()
	_press(game, "OpenCodex")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	startup._input(escape)
	_expect(not codex.visible and game.visible, "Escape should close the book")
	time = int(game.run.combat_time)
	for tick in 10:
		game._process(0.1)
	_expect(game.paused and game.run.combat_time == time, "Closing the book must preserve a manual pause")


func _check_focus(viewport: SubViewport, codex: Control, target: String) -> void:
	_expect(viewport.gui_get_focus_owner() == codex.find_child(target, true, false), "No focus on " + target)


func _press(panel: Control, id: String) -> void:
	var button := panel.find_child(id, true, false) as Button
	_expect(button != null and not button.disabled, "Missing button " + id)
	if button and not button.disabled:
		button.pressed.emit()


func _expect(value: bool, message: String) -> void:
	if not value:
		_errors.append(message)
