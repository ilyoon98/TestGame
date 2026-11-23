extends RefCounted

const Glyph := preload("res://ui/field_glyph.gd")
const RankStrip := preload("res://ui/card_rank_strip.gd")
const DISPLAY_FONT := preload("res://art/fonts/GowunBatang-Bold.ttf")
const BODY_FONT := preload("res://art/fonts/GowunDodum-Regular.ttf")

const BLACK := Color("#141214")
const IRON := Color("#201c20")
const RIM := Color("#604c47")
const TEXT := Color("#f6e6ce")
const MUTED := Color("#bfb3a9")
const BRASS := Color("#edc78e")
const ALLY := Color("#a4dcc5")
const DANGER := Color("#f2a083")
const PAPER := Color("#e1c89d")
const PAPER_INK := Color("#2d2020")
const PAPER_MUTED := Color("#574039")
const UPGRADE_INK := Color("#b4ee98")
const UPGRADE_TITLE_INK := Color("#255c29")

const WINDOW_MIN := Vector2i(900, 650)
const ACTION_HEIGHT := 46
const COMPACT_HEIGHT := 32
const BADGE_HEIGHT := 26
const GLYPH_SIZE := 24
const CARD_SIZE := Vector2(176, 204)
const CARD_HEIGHT_PER_WIDTH := 1.38
const CARD_GAP := 10
const CARD_UI := "res://art/ui/cards/"
const CARD_ART_SIZE := Vector2i(392, 306)
const ART_HEIGHT_PER_WIDTH := float(CARD_ART_SIZE.y) / CARD_ART_SIZE.x
const ART_INSET := 7
const DIAL_SIZE := 46
const ART_HEADER_GAP := 4
const ROLE_HANG := 14
const CARD_TERMS := {
	"공격": ["attack", "적의 부위에 피해를 줍니다."],
	"피해": ["attack", "적의 부위 내구도를 줄입니다."],
	"방어": ["defense", "가드로 아군 부위를 보호합니다."],
	"관통": ["pierce", "적의 가드를 표시된 수치만큼 무시합니다."],
	"회복": ["heal", "부위 내구도를 회복합니다. 대상의 배가 부상이면 절반만 회복합니다."],
	"가드": ["defense", "해당 부위에 가해지는 피해를 막습니다."],
	"부상": ["injury", "부위 내구도가 절반 이하가 되면 관련 기술이 약해질 수 있습니다."],
	"결손": ["loss", "내구도가 0인 부위는 해당 부위를 쓰는 기술을 사용할 수 없습니다."],
	"표식": ["mark", "다른 아군이 같은 부위에 피해를 주면 추가 피해를 주고 사라집니다."],
	"강화": ["upgrade", "조건을 만족하는 다음 아군 행동을 강화합니다."],
	"약화": ["weaken", "적의 가드나 다음 행동을 약화합니다."],
	"반격": ["counter", "보호한 부위가 공격받으면 반격합니다."],
}
const CARD_TYPES := {
	"attack": ["공격", Color("#f1a586")],
	"defense": ["방어", Color("#aed6e4")],
	"skill": ["기술", Color("#e4c6e6")],
	"heal": ["회복", ALLY],
}
const RARITIES := {
	"common": ["일반", Color("#bf9770"), "◆"],
	"uncommon": ["고급", Color("#5dd4ca"), "◆◆"],
	"rare": ["희귀", Color("#d496f0"), "◆◆◆"],
}
const OWNER_MARKS := {"nun": "skill", "guard": "guard_crest", "awakened": "broken_shackle",
	"archer": "bow", "shaman": "talisman"}
static var _term_matcher := RegEx.create_from_string("|".join(CARD_TERMS.keys()))


static func make_theme() -> Theme:
	var result := Theme.new()
	result.default_font = BODY_FONT
	result.default_font_size = 16
	result.set_color("font_color", "Label", TEXT)
	result.set_stylebox("panel", "PanelContainer", plate(IRON, RIM))
	for type in ["Button", "OptionButton", "CheckButton"]:
		result.set_color("font_color", type, TEXT)
		result.set_color("font_hover_color", type, Color.WHITE)
		result.set_color("font_pressed_color", type, BRASS)
		result.set_color("font_disabled_color", type, Color("#afa196"))
		result.set_stylebox("normal", type, plate(Color("#2a2327"), RIM, 9))
		result.set_stylebox("hover", type, plate(Color("#43312e"), BRASS, 9))
		result.set_stylebox("pressed", type, plate(Color("#51372c"), BRASS, 9))
		result.set_stylebox("disabled", type, plate(Color("#241e20"), Color("#483939"), 9))
		result.set_stylebox("focus", type, focus_outline())
	result.set_type_variation("CompactButton", "Button")
	for state in ["normal", "hover", "pressed", "disabled"]:
		var compact := result.get_stylebox(state, "Button").duplicate() as StyleBoxFlat
		compact.content_margin_top = 3
		compact.content_margin_bottom = 3
		result.set_stylebox(state, "CompactButton", compact)
	result.set_color("font_color", "LineEdit", TEXT)
	result.set_color("font_placeholder_color", "LineEdit", MUTED)
	result.set_stylebox("normal", "LineEdit", plate(BLACK, RIM, 9))
	result.set_stylebox("focus", "LineEdit", focus_outline())
	return result


static func plate(fill: Color, edge: Color, padding := 10) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = edge
	box.set_border_width_all(1)
	box.border_width_bottom = 2
	box.corner_radius_top_right = 5
	box.corner_radius_bottom_left = 5
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		box.set_content_margin(side, padding)
	return box


static func focus_outline() -> StyleBoxFlat:
	var box := plate(Color.TRANSPARENT, Color("#ffe6a4"), 0)
	box.draw_center = false
	box.set_border_width_all(2)
	return box


static func mark(symbol: String, ink: Color, extent := GLYPH_SIZE) -> Control:
	var glyph := Glyph.new()
	glyph.setup(symbol, ink, extent)
	return glyph


static func label(value: String, point_size: int, ink := TEXT, display := false) -> Label:
	var item := Label.new()
	item.text = display_copy(value)
	item.add_theme_font_size_override("font_size", point_size)
	item.add_theme_color_override("font_color", ink)
	if display:
		item.add_theme_font_override("font", DISPLAY_FONT)
	return item


static func display_copy(value: String) -> String:
	# Imported text uses spaced dots between values and unspaced dots within lists.
	return value.replace(" · ", "  ").replace("·", ", ")


static func badge(symbol: String, value: String, ink := BRASS, point_size := 13) -> PanelContainer:
	var badge_panel := PanelContainer.new()
	badge_panel.custom_minimum_size.y = BADGE_HEIGHT
	badge_panel.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	badge_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var box := plate(IRON, ink.darkened(0.54), 6)
	box.content_margin_top = 2
	box.content_margin_bottom = 2
	box.border_width_left = 2
	badge_panel.add_theme_stylebox_override("panel", box)
	var line := HBoxContainer.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_constant_override("separation", 5)
	badge_panel.add_child(line)
	line.add_child(mark(symbol, ink, 16))
	line.add_child(label(value, point_size, ink))
	return badge_panel


static func card_symbol(card: Dictionary) -> String:
	return "heal" if card.get("effect") == "aid" or card.id == "aid" else card.type


static func card_columns(width: float, limit: int) -> int:
	return clampi(int((width + CARD_GAP) / (CARD_SIZE.x + CARD_GAP)), 1, limit)


static func card_shell(card: Dictionary, data: Dictionary) -> PanelContainer:
	var grade: String = card.get("rarity", "common")
	var rarity: Array = RARITIES[grade]
	var tile := PanelContainer.new()
	tile.custom_minimum_size = CARD_SIZE
	tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tile.resized.connect(func():
		tile.custom_minimum_size.y = maxf(CARD_SIZE.y, ceilf(tile.size.x * CARD_HEIGHT_PER_WIDTH)))
	var border := _textured_box("frame-%s.png" % grade, 18, 10)
	border.content_margin_top = 11
	border.content_margin_bottom = 16
	tile.add_theme_stylebox_override("panel", border)
	var content := VBoxContainer.new()
	content.name = "CardContent"
	content.add_theme_constant_override("separation", 5)
	tile.add_child(content)

	var art := TextureRect.new()
	art.name = "CardArt"
	var face_path: String = CARD_UI + card.id + ".webp"
	art.texture = load(face_path if ResourceLoader.exists(face_path) else "res://" + card.art)
	art.custom_minimum_size.y = 110
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(art)
	art.resized.connect(func():
		art.custom_minimum_size.y = clampf(roundf(art.size.x * ART_HEIGHT_PER_WIDTH), 110, 222))
	_card_art_badges(art, card, data)
	_card_art_foot(art, card)

	var inset := MarginContainer.new()
	inset.name = "Details"
	inset.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inset.add_theme_constant_override("margin_left", 8)
	inset.add_theme_constant_override("margin_right", 8)
	inset.add_theme_constant_override("margin_top", ROLE_HANG)
	content.add_child(inset)
	var body := VBoxContainer.new()
	body.name = "CardBody"
	body.add_theme_constant_override("separation", 5)
	inset.add_child(body)
	var title := RichTextLabel.new()
	title.name = "CardTitle"
	title.add_theme_font_override("normal_font", DISPLAY_FONT)
	title.add_theme_font_size_override("normal_font_size", 19)
	title.add_theme_color_override("default_color", PAPER_INK)
	title.fit_content = true
	title.scroll_active = false
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	body.add_child(title)
	tile.tooltip_text = rarity[0]
	tile.accessibility_description = rarity[0]
	return tile


static func _card_art_badges(art: Control, card: Dictionary, data: Dictionary) -> void:
	var hud := MarginContainer.new()
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.add_child(hud)
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "top", "right", "bottom"]:
		hud.add_theme_constant_override("margin_" + side, ART_INSET)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", ART_HEADER_GAP)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	hud.add_child(top)
	var dial := _enamel_chip(BRASS, 0, true)
	dial.name = "CooldownDial"
	dial.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	dial.custom_minimum_size = Vector2(DIAL_SIZE, DIAL_SIZE)
	var number := label("", 14, TEXT, true)
	number.name = "Time"
	number.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	number.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	dial.add_child(number)
	top.add_child(dial)
	var space := Control.new()
	space.mouse_filter = Control.MOUSE_FILTER_IGNORE
	space.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(space)
	top.add_child(_card_owner(card, data, art))


static func _card_art_foot(art: TextureRect, card: Dictionary) -> void:
	var plaque := _card_role_plate(card_symbol(card))
	art.add_child(plaque)
	plaque.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	var width := plaque.custom_minimum_size.x
	plaque.offset_left = -width / 2.0
	plaque.offset_right = width / 2.0
	plaque.offset_top = ROLE_HANG - plaque.custom_minimum_size.y
	plaque.offset_bottom = ROLE_HANG

	var tag := PanelContainer.new()
	tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tag.add_theme_stylebox_override("panel", plate(PAPER, Color("#78553c"), 3))
	var ranks := RankStrip.new()
	ranks.name = "CardRanks"
	ranks.setup(card.get("ranks", [0, 1, 2]))
	tag.add_child(ranks)
	art.add_child(tag)
	tag.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	var extent := tag.get_combined_minimum_size()
	tag.offset_right = -7
	tag.offset_left = tag.offset_right - extent.x
	tag.offset_bottom = -21
	tag.offset_top = tag.offset_bottom - extent.y


static func _card_role_plate(symbol: String) -> PanelContainer:
	var role: Array = CARD_TYPES[symbol]
	var plaque := PanelContainer.new()
	plaque.name = "TechniqueCategory"
	plaque.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	plaque.custom_minimum_size = Vector2(104, 28)
	plaque.accessibility_name = role[0]
	plaque.add_theme_stylebox_override("panel", _textured_box("role-%s.png" % symbol, 12, 2))
	var line := HBoxContainer.new()
	line.alignment = BoxContainer.ALIGNMENT_CENTER
	plaque.add_child(line)
	line.add_child(mark(symbol, role[1], 17))
	line.add_child(label(role[0], 14, role[1], true))
	return plaque


static func _card_owner(card: Dictionary, data: Dictionary, art: Control) -> PanelContainer:
	var kind: String = card.get("character", "")
	var weapon: String = card.get("weapon", "")
	var owner := "공용"
	var symbol := "seal"
	if not kind.is_empty():
		var member: Dictionary = data.nun if kind == "nun" else data.recruits[kind]
		owner = member.name + " 전용"
		symbol = OWNER_MARKS[kind]
	elif not weapon.is_empty():
		owner = str(data.codex.weapons.get(weapon, weapon)) + " 전용"
		symbol = "bow" if weapon == "bow" else "seal"
	var ink := Color("#f5deb0")
	var band := _enamel_chip(Color("#ad916c"), 5)
	band.name = "CardOwner"
	band.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	band.tooltip_text = owner
	band.accessibility_name = owner
	var line := HBoxContainer.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_constant_override("separation", 4)
	band.add_child(line)
	var owner_icon := mark(symbol, ink, 16)
	owner_icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(owner_icon)
	var caption := label(owner, 12, ink)
	caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(caption)
	var preferred := ceilf(BODY_FONT.get_string_size(owner, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x) + 30
	var fit_owner := func():
		var available := maxf(art.size.x, CARD_SIZE.x - 20) - 2 * ART_INSET - DIAL_SIZE - 2 * ART_HEADER_GAP
		band.custom_minimum_size.x = minf(preferred, available)
	art.resized.connect(fit_owner)
	fit_owner.call()
	return band


static func set_card_values(tile: PanelContainer, title_text: String, level: int, cooldown: int,
		time_improved: bool) -> void:
	var title := tile.find_child("CardTitle", true, false) as RichTextLabel
	title.clear()
	title.push_paragraph(HORIZONTAL_ALIGNMENT_CENTER)
	title.add_text(title_text)
	if level > 1:
		title.push_color(UPGRADE_TITLE_INK)
		title.add_text("\u00a0+" if level == 2 else "\u00a0+%d" % (level - 1))
		title.pop()
	title.pop()
	title.accessibility_name = title_text if level <= 1 else "%s Lv.%d" % [title_text, level]
	var dial := tile.find_child("CooldownDial", true, false) as PanelContainer
	var time := _time_text(cooldown)
	dial.tooltip_text = "발동 시간 " + time
	dial.accessibility_name = dial.tooltip_text
	var number := dial.get_node("Time") as Label
	number.text = time
	number.add_theme_color_override("font_color", UPGRADE_INK if time_improved else TEXT)


static func card_shortcut(key: int) -> PanelContainer:
	var keycap := _enamel_chip(Color("#876b53"), 3)
	keycap.name = "CardShortcut"
	keycap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	keycap.custom_minimum_size = Vector2(24, 22)
	keycap.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var caption := label(str(key), 13, BRASS, true)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	keycap.add_child(caption)
	return keycap


static func _time_text(milliseconds: int) -> String:
	return "%.1f초" % (float(milliseconds) / 1000.0)


static func _enamel_chip(ink: Color, padding: int, round_chip := false) -> PanelContainer:
	var chip := PanelContainer.new()
	chip.mouse_filter = Control.MOUSE_FILTER_PASS
	var shape := plate(Color("#241a21"), ink, padding)
	shape.set_border_width_all(2)
	shape.set_corner_radius_all(23 if round_chip else 5)
	shape.shadow_size = 3
	shape.shadow_offset = Vector2(0, 1)
	shape.shadow_color = Color("#0c070db2")
	chip.add_theme_stylebox_override("panel", shape)
	return chip


static func card_effect_text(value: String) -> RichTextLabel:
	value = display_copy(value)
	var rich := RichTextLabel.new()
	rich.name = "CardEffect"
	rich.fit_content = true
	rich.scroll_active = false
	rich.mouse_filter = Control.MOUSE_FILTER_PASS
	rich.add_theme_font_override("bold_font", DISPLAY_FONT)
	rich.add_theme_font_size_override("normal_font_size", 15)
	rich.add_theme_font_size_override("bold_font_size", 15)
	rich.add_theme_color_override("default_color", PAPER_INK)
	var hints := PackedStringArray()
	var cursor := 0
	for term in _term_matcher.search_all(value):
		var keyword := term.get_string()
		var definition: Array = CARD_TERMS[keyword]
		rich.add_text(value.substr(cursor, term.get_start() - cursor))
		rich.add_image(load(CARD_UI + "term-" + definition[0] + ".png"), 14, 14)
		rich.add_text(" ")
		rich.push_bold()
		rich.push_underline()
		rich.add_text(keyword)
		rich.pop()
		rich.pop()
		cursor = term.get_end()
		var hint := "%s  %s" % [keyword, definition[1]]
		if not hints.has(hint):
			hints.append(hint)
	rich.add_text(value.substr(cursor))
	rich.tooltip_text = "\n".join(hints)
	return rich


static func _textured_box(asset: String, inset: int, padding: int) -> StyleBoxTexture:
	var box := StyleBoxTexture.new()
	box.texture = load(CARD_UI + asset)
	for side in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
		box.set_texture_margin(side, inset)
		box.set_content_margin(side, padding)
	return box


static func style_card_action(button: Button, selected: bool) -> void:
	var tints := {"normal": Color("#ffe7bc") if selected else Color.WHITE,
		"hover": Color("#ffd092"), "pressed": Color("#b28362"),
		"disabled": Color("#b5a8a5")}
	for state: String in tints:
		var box := _textured_box("card-action.png", 13, 8)
		box.modulate_color = tints[state]
		button.add_theme_stylebox_override(state, box)


static func add_key_hint(button: Button, key: String, corner := false) -> void:
	var hint := PanelContainer.new()
	hint.name = "KeyHint"
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var background := plate(Color("#17131a"), Color("#a98961"), 0)
	background.corner_radius_top_right = 2
	background.corner_radius_bottom_left = 2
	hint.add_theme_stylebox_override("panel", background)
	button.add_child(hint)
	var caption := label(key, 12, BRASS)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hint.add_child(caption)
	var width := maxf(18, ceilf(BODY_FONT.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x) + 8)
	hint.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT if corner else Control.PRESET_CENTER_RIGHT)
	hint.offset_left = -width - 6
	hint.offset_right = -6
	hint.offset_top = 4 if corner else -9
	hint.offset_bottom = hint.offset_top + 18
	if not corner:
		for state in ["normal", "hover", "pressed", "disabled"]:
			var box := button.get_theme_stylebox(state).duplicate() as StyleBox
			box.content_margin_right = box.get_margin(SIDE_RIGHT) + width + 6
			button.add_theme_stylebox_override(state, box)


static func style_action(button: Button, primary: bool, compact := false) -> void:
	button.custom_minimum_size.y = COMPACT_HEIGHT if compact else ACTION_HEIGHT
	if compact:
		button.theme_type_variation = "CompactButton"
	if primary:
		var box := plate(Color("#4c3328"), BRASS, 8)
		if compact:
			box.content_margin_top = 3
			box.content_margin_bottom = 3
		button.add_theme_stylebox_override("normal", box)
