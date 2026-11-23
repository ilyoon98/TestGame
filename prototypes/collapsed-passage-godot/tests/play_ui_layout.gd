extends SceneTree

const Startup := preload("res://ui/startup.tscn")
const FieldUI := preload("res://ui/field_ui.gd")
var _failed := false


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var effect := FieldUI.card_effect_text("머리·가슴 회복 · 가드 무시")
	var text := effect.get_parsed_text()
	_expect(text.contains("머리, 가슴") and text.contains("가드") and not text.contains("·"),
		"Imported card descriptions keep their terms without middle dots")
	effect.free()
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/threshold.json"))
	var placements := {"bowBlock": [false, false, true], "incenseSmoke": [false, true, false],
		"executionArrow": [true, false, false], "openGap": [false, true, true],
		"battleKnot": [true, true, false], "strike": [true, true, true]}
	for card: Dictionary in data.cards:
		var face := load(FieldUI.CARD_UI + card.id + ".webp") as Texture2D
		_expect(face != null and face.get_size() == Vector2(FieldUI.CARD_ART_SIZE),
			"Missing baked card image for " + card.id)
		if placements.has(card.id):
			var tile := FieldUI.card_shell(card, data)
			var ranks := tile.find_child("CardRanks", true, false)
			_expect(ranks != null and ranks._filled == placements[card.id] and
				ranks.tooltip_text.contains("오른쪽이 전위"), "Incorrect card rank indicator for " + card.id)
			tile.free()
		if card.id == "irons":
			await _check_narrow_owner(card, data)
	# The raw 900-wide viewport is stricter than the scaled minimum desktop window.
	for dimensions in [Vector2i(900, 650), Vector2i(1100, 740), Vector2i(1316, 740)]:
		var viewport := SubViewport.new()
		viewport.size = dimensions
		root.add_child(viewport)
		var title := Startup.instantiate()
		viewport.add_child(title)
		await process_frame
		await process_frame
		for id in ["StartRun", "RandomSeed", "MapSettings", "StartTraining", "OpenCodex"]:
			_check_button(title.find_child(id, true, false), dimensions.x, id)

		title.view = "game"
		title.seed = "LAYOUT"
		title._render()
		await process_frame
		await process_frame
		var game: Control = title._display
		_check_button(game.find_child("BeginCombat", true, false), dimensions.x, "BeginCombat")
		for card in game.find_children("CardContent", "VBoxContainer", true, false):
			var tile := card.get_parent() as PanelContainer
			_expect(tile.size.x >= FieldUI.CARD_SIZE.x and tile.size.y >= FieldUI.CARD_SIZE.y,
				"Card under its minimum at %s" % dimensions)
			_expect(tile.get_global_rect().end.x <= dimensions.x, "Card cut off at %s" % dimensions)
			_expect(tile.size.y >= ceilf(tile.size.x * FieldUI.CARD_HEIGHT_PER_WIDTH), "Card lost its portrait proportions")
			var art := card.get_node("CardArt") as Control
			var icon := art.get_node("TechniqueCategory") as Control
			var timer := art.find_child("CooldownDial", true, false) as Control
			var owner := art.find_child("CardOwner", true, false) as Control
			var ranks := art.find_child("CardRanks", true, false) as Control
			var art_bounds := art.get_global_rect()
			var plaque := icon.get_global_rect()
			var rank_bounds := ranks.get_global_rect()
			_expect(plaque.position.y < art_bounds.end.y and plaque.end.y > art_bounds.end.y and
				absf(plaque.get_center().x - art_bounds.get_center().x) <= 1.0,
				"Role plaque must straddle the center of the lower artwork edge")
			_expect(art_bounds.encloses(rank_bounds) and rank_bounds.end.y <= plaque.position.y and
				rank_bounds.get_center().x > art_bounds.get_center().x,
				"Rank slots must sit inside the right of the artwork and clear the plaque")
			_expect(art_bounds.encloses(timer.get_global_rect()) and
				timer.get_global_rect().get_center().x < art_bounds.get_center().x,
				"Cooldown must fit in the upper-left artwork corner")
			_expect(art_bounds.encloses(owner.get_global_rect()) and
				owner.get_global_rect().position.x >= timer.get_global_rect().end.x and
				is_equal_approx(owner.get_global_rect().end.x, art_bounds.end.x - FieldUI.ART_INSET),
				"The owner emblem must fit in the upper-right artwork corner")

		game.find_child("OpenMinimap", true, false).pressed.emit()
		await process_frame
		await process_frame
		for room in game.find_children("Preview_*", "PanelContainer", true, false):
			_expect(room.size.x >= FieldUI.GLYPH_SIZE and room.get_global_rect().end.x <= dimensions.x,
				"Room symbol cut off at %s" % dimensions)
			_expect(not room.accessibility_name.is_empty(), "Room is missing its accessible label")
		viewport.free()
	_expect(FieldUI.card_columns(363, 4) == 2 and FieldUI.card_columns(361, 4) == 1,
		"Cards must wrap before falling below their minimum width")
	if not _failed:
		print("UI minimums, formation indicators, card wrapping and room labels passed")
	quit(1 if _failed else 0)


func _check_narrow_owner(card: Dictionary, data: Dictionary) -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(int(FieldUI.CARD_SIZE.x), 280)
	root.add_child(viewport)
	var tile := FieldUI.card_shell(card, data)
	tile.theme = FieldUI.make_theme()
	viewport.add_child(tile)
	FieldUI.set_card_values(tile, card.name, 1, int(card.cooldown), false)
	await process_frame
	await process_frame
	var art := tile.find_child("CardArt", true, false) as Control
	var owner := art.find_child("CardOwner", true, false) as Control
	var timer := art.find_child("CooldownDial", true, false) as Control
	var ranks := art.find_child("CardRanks", true, false) as Control
	_expect(tile.size.x == FieldUI.CARD_SIZE.x and owner.accessibility_name == "개화한 수감자 전용" and
		art.get_global_rect().encloses(owner.get_global_rect()) and
		owner.get_global_rect().position.x >= timer.get_global_rect().end.x and
		owner.get_global_rect().end.y <= ranks.get_global_rect().position.y,
		"The longest owner label must fit on a minimum-width card")
	viewport.free()


func _check_button(button: Button, width: float, id: String) -> void:
	_expect(button.size.y >= FieldUI.ACTION_HEIGHT and button.get_global_rect().end.x <= width,
		"%s does not fit inside the %d-wide layout" % [id, width])


func _expect(result: bool, message: String) -> void:
	if not result:
		_failed = true
		push_error(message)
