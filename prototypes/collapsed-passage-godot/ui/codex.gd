extends Control
## A read-only catalog shared by the title screen and all phases of a run.

signal dismissed

const FieldUI := preload("res://ui/field_ui.gd")
const BG := FieldUI.BLACK
const TEXT := FieldUI.TEXT
const MUTED := FieldUI.MUTED
const GOLD := FieldUI.BRASS
const BORDER := FieldUI.RIM

var _data: Dictionary
var _cards: Dictionary = {}
var _tabs: Dictionary = {}
var _member := "nun"
var _rarity := "all"
var _member_buttons: Dictionary = {}
var _rarity_buttons: Dictionary = {}
var _profile: VBoxContainer
var _section: Label
var _scroll: ScrollContainer
var _grid: GridContainer
var _empty: Label
var _close: Button


func setup(data: Dictionary) -> void:
	_data = data
	for card: Dictionary in data.cards:
		_cards[card.id] = card
	for tab: Dictionary in data.codex.tabs:
		_tabs[tab.id] = tab


func _ready() -> void:
	theme = FieldUI.make_theme()
	var backdrop := ColorRect.new()
	backdrop.color = BG
	add_child(backdrop)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var margin := MarginContainer.new()
	add_child(margin)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for edge in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + edge, 22)
	var layout := _column(12)
	margin.add_child(layout)
	var header := _row(10)
	layout.add_child(header)
	var title := _label("도감", 31, TEXT)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	_close = _button("닫기", "CloseCodex", func(): dismissed.emit())
	header.add_child(_close)
	var body := _row(12)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(body)
	var rail := _panel(FieldUI.IRON, BORDER, 9)
	rail.custom_minimum_size.x = 135
	body.add_child(rail)
	var menu := _column(7)
	rail.add_child(menu)
	for key: String in _tabs:
		var button := _button(_tabs[key].label, "Member_" + key, _select_member.bind(key))
		button.toggle_mode = true
		_member_buttons[key] = button
		menu.add_child(button)

	var content := _column(10)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(content)
	_profile = _column(6)
	content.add_child(_profile)
	var filters := _row(7)
	content.add_child(filters)
	_section = _label("", 20, TEXT)
	_section.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	filters.add_child(_section)
	var rarities := {"all": "전체"}
	for key: String in _data.rarities:
		rarities[key] = _data.rarities[key].name
	for key: String in rarities:
		var button := _button(rarities[key], "Rarity_" + key, _select_rarity.bind(key))
		button.toggle_mode = true
		_rarity_buttons[key] = button
		filters.add_child(button)
	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.focus_mode = Control.FOCUS_ALL
	_scroll.accessibility_name = "카드 목록"
	content.add_child(_scroll)
	var results := _column(0)
	results.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll.add_child(results)
	_grid = GridContainer.new()
	_grid.add_theme_constant_override("h_separation", FieldUI.CARD_GAP)
	_grid.add_theme_constant_override("v_separation", FieldUI.CARD_GAP)
	results.add_child(_grid)
	_empty = _label("해당 카드 없음", 16, MUTED)
	results.add_child(_empty)
	_scroll.resized.connect(_update_columns)
	_draw_profile()
	_draw_cards()


func focus_close() -> void:
	_scroll.scroll_vertical = 0
	_close.grab_focus()


func _select_member(id: String) -> void:
	if _member != id:
		_member = id
		_draw_profile()
	_draw_cards()


func _select_rarity(id: String) -> void:
	_rarity = id
	_draw_cards()


func _draw_profile() -> void:
	_clear(_profile)
	_section.text = "공용 카드" if _member == "common" else "전용 기술"
	if _member == "common":
		return
	var member: Dictionary = _data.nun if _member == "nun" else _data.recruits[_member]
	var panel := _panel(FieldUI.IRON, BORDER, 10)
	_profile.add_child(panel)
	var row := _row(15)
	panel.add_child(row)
	var portrait := _image(_data.visuals[_member].idle, 116)
	portrait.custom_minimum_size.x = 86
	row.add_child(portrait)
	var copy := _column(4)
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(copy)
	var name_label := _label(member.name, 21, TEXT)
	name_label.name = "ProfileName"
	copy.add_child(name_label)
	copy.add_child(_label(_tabs[_member].role, 14, MUTED))
	var tags := _row(6)
	copy.add_child(tags)
	for id: String in member.factions + member.jobs:
		var trait_data: Dictionary = _data.traits[id]
		var accent := GOLD if trait_data.group == "faction" else Color("#9ec5d3")
		var badge := FieldUI.badge("seal" if trait_data.group == "faction" else "link", trait_data.name, accent)
		tags.add_child(badge)
		badge.tooltip_text = FieldUI.display_copy(trait_data.get("effect", ""))
		badge.mouse_filter = Control.MOUSE_FILTER_STOP
	copy.add_child(_label("%d HP   %s   기술 %d칸" % [
		int(member.vitality), _data.codex.weapons[member.weapon], int(_tabs[_member].slots)], 14, TEXT))
	var parts: Array[String] = []
	var index := 0
	for part: String in _data.parts:
		parts.append("%s %d" % [_data.parts[part], int(member.health[index])])
		index += 1
	var durability := _label("   ".join(parts), 14, MUTED)
	durability.name = "PartDurability"
	durability.hide()
	var toggle := _button("부위 내구도", "ShowParts", func(): durability.visible = not durability.visible)
	toggle.toggle_mode = true
	toggle.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	copy.add_child(toggle)
	copy.add_child(durability)


func _draw_cards() -> void:
	for id: String in _member_buttons:
		_member_buttons[id].set_pressed_no_signal(id == _member)
	for id: String in _rarity_buttons:
		_rarity_buttons[id].set_pressed_no_signal(id == _rarity)
	_clear(_grid)
	for entry: Dictionary in _tabs[_member].cards:
		var card: Dictionary = _cards[entry.id]
		if _rarity != "all" and card.get("rarity", "common") != _rarity:
			continue
		_grid.add_child(_card(card, entry.lines))
	_empty.visible = _grid.get_child_count() == 0
	_update_columns()
	_scroll.set_deferred("scroll_vertical", 0)


func _card(card: Dictionary, details: Array) -> PanelContainer:
	var tile := FieldUI.card_shell(card, _data)
	FieldUI.set_card_values(tile, card.name, 1, int(card.cooldown), false)
	tile.name = "Card_" + card.id
	var content := tile.get_node("CardContent/Details/CardBody") as VBoxContainer
	if not card.get("reward", false):
		content.add_child(FieldUI.label("기본", 13, FieldUI.PAPER_MUTED))
	content.add_child(FieldUI.card_effect_text("\n".join(details)))
	return tile


func _update_columns() -> void:
	_grid.columns = FieldUI.card_columns(_scroll.size.x - _scroll.get_v_scroll_bar().size.x, 3)


func _clear(container: Container) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()


func _button(title: String, id: String, action: Callable) -> Button:
	var control := Button.new()
	control.name = id
	control.text = title
	FieldUI.style_action(control, false)
	control.pressed.connect(action)
	return control


func _panel(fill: Color, edge: Color, pad: int) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", FieldUI.plate(fill, edge, pad))
	return panel


func _image(path: String, height: int) -> TextureRect:
	var image := TextureRect.new()
	image.texture = load("res://" + path)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size.y = height
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return image


func _row(spacing: int) -> HBoxContainer:
	var layout := HBoxContainer.new()
	layout.add_theme_constant_override("separation", spacing)
	return layout


func _column(spacing: int) -> VBoxContainer:
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", spacing)
	return layout


func _label(value: String, font_size: int, color: Color) -> Label:
	return FieldUI.label(value, font_size, color, font_size >= 19)
