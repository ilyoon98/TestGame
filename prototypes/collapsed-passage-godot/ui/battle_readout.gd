extends VBoxContainer

const LABELS := {"healthy": "정상", "injured": "부상", "lost": "결손"}
const FieldUI := preload("res://ui/field_ui.gd")
const COLORS := {"healthy": FieldUI.MUTED, "injured": FieldUI.BRASS, "lost": FieldUI.DANGER}
const PARTS := preload("res://combat/threshold_run.gd").PARTS

var _run: RefCounted
var _buttons: Dictionary = {}
var _parts: Dictionary = {}
var _selected := ""
var _body: GridContainer
var _intent: Dictionary = {}
var _actors: Dictionary = {}


func setup(run: RefCounted, sides: Array) -> void:
	_run = run
	add_theme_constant_override("separation", 7)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 7)
	add_child(actions)
	actions.add_child(_label("부위 상태", 15))
	for side: String in sides + ["enemy"]:
		var button := Button.new()
		button.name = "Inspect_" + side
		button.custom_minimum_size.y = 34
		button.theme_type_variation = "CompactButton"
		button.toggle_mode = true
		button.pressed.connect(_select.bind(side))
		actions.add_child(button)
		_buttons[side] = button
	_body = GridContainer.new()
	_body.columns = PARTS.size()
	_body.add_theme_constant_override("h_separation", 7)
	add_child(_body)
	for part: String in PARTS:
		var tile := PanelContainer.new()
		tile.name = "Part_" + part
		tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_body.add_child(tile)
		var box := VBoxContainer.new()
		tile.add_child(box)
		var summary := _label("", 14)
		var amount := _label("", 13)
		summary.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		amount.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		amount.custom_minimum_size.y = 36
		box.add_child(summary)
		box.add_child(amount)
		var style := FieldUI.plate(FieldUI.IRON, FieldUI.RIM, 6)
		tile.add_theme_stylebox_override("panel", style)
		_parts[part] = {"panel": tile, "style": style, "summary": summary, "amount": amount}
	_body.hide()


func refresh(intent: Dictionary, actors: Dictionary = {}) -> void:
	_intent = intent
	_actors = actors
	for side: String in _buttons:
		var actor: Dictionary = _actors.get(side, _run.get(side))
		var injured := 0
		var lost := 0
		for part: String in PARTS:
			injured += int(_run.condition(actor, part) == "injured")
			lost += int(_run.condition(actor, part) == "lost")
		var detail: PackedStringArray = []
		if _run.down(actor):
			detail.append("쓰러짐")
		else:
			if injured:
				detail.append("부상 %d" % injured)
			if lost:
				detail.append("결손 %d" % lost)
		var button: Button = _buttons[side]
		button.text = actor.name if detail.is_empty() else "%s  %s" % [actor.name, ", ".join(detail)]
		button.add_theme_color_override("font_color", COLORS.lost if lost else COLORS.injured if injured else COLORS.healthy)
	_draw_parts()


func _select(side: String) -> void:
	_selected = "" if _selected == side else side
	for key: String in _buttons:
		_buttons[key].set_pressed_no_signal(key == _selected)
	_body.visible = not _selected.is_empty()
	_draw_parts()
	var scroll := get_parent().get_parent() as ScrollContainer
	if _body.visible and scroll:
		scroll.ensure_control_visible.call_deferred(_body)


func _draw_parts() -> void:
	if _selected.is_empty():
		return
	var actor: Dictionary = _actors.get(_selected, _run.get(_selected))
	var eyes: String = _run.condition(_actors.get("player", _run.player), "eyes")
	var card: Dictionary = _run.cards[_intent.id] if not _intent.is_empty() and eyes == "healthy" else {}
	for part: String in PARTS:
		var state: Dictionary = actor.body[part]
		var condition: String = _run.condition(actor, part)
		var title: String = _run.data.parts[part]
		var guard := "?" if _selected != "enemy" and eyes == "lost" else str(state.guard)
		var detail: PackedStringArray = []
		if not card.is_empty() and part in _intent.targets:
			if card.type == "attack" and _intent.get("side") == _selected:
				detail.append("공격 예고")
			elif card.type == "defense" and _selected == "enemy":
				var incoming := maxi(0, _run.intent_power(_intent) - state.guard)
				if incoming > 0:
					detail.append("가드 +%d 예정" % incoming)
		if actor.get("mark", {}).get("target") == part:
			detail.append("표식 +%d" % actor.mark.bonus)
		var cell: Dictionary = _parts[part]
		cell.summary.text = "%s  %s" % [title, LABELS[condition]]
		cell.summary.add_theme_color_override("font_color", COLORS[condition])
		cell.amount.text = "%d/%d  가드 %s" % [state.hp, state.max, guard]
		if not detail.is_empty():
			cell.amount.text += "\n" + "\n".join(detail)
		cell.panel.tooltip_text = FieldUI.display_copy(_run.data.effects.get(part, "")) if _selected == "player" else "팔 결손 시 팔 기술 사용 불가" if part == "arms" else ""
		cell.panel.accessibility_name = "%s %s %s %s" % [actor.name, title, LABELS[condition], cell.amount.text]
		cell.style.border_color = Color("#a87360") if not detail.is_empty() else FieldUI.RIM


func _label(text_value: String, size_px: int) -> Label:
	var label := Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", size_px)
	return label
