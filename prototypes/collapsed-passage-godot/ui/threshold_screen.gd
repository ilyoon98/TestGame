extends Control

signal return_to_title
signal codex_requested
signal sound_changed(enabled: bool)
signal arrived(room: String)

const Run := preload("res://combat/threshold_run.gd")
const RouteMap := preload("res://ui/route_map.gd")
const CombatAudio := preload("res://ui/combat_audio.gd")
const CombatEffect := preload("res://ui/combat_effect.gd")
const BattleReadout := preload("res://ui/battle_readout.gd")
const PursuitTrack := preload("res://ui/pursuit_track.gd")
const CaptureScene := preload("res://ui/capture_scene.gd")
const ActorPortrait := preload("res://ui/actor_portrait.gd")
const LocationScene := preload("res://ui/location_scene.gd")
const FieldUI := preload("res://ui/field_ui.gd")
const VitalityMeter := preload("res://ui/vitality_meter.gd")
const AMBER := FieldUI.BRASS
const INK := FieldUI.BLACK
const PALE := FieldUI.TEXT
const MUTED := FieldUI.MUTED
const ALLY := FieldUI.ALLY
const FOE := FieldUI.DANGER
const INJURY_LEVELS := {"healthy": "정상", "injured": "부상", "lost": "결손"}
const COMBAT_BOARD_MIN := 262.0
const PREP_CARD_WIDTH := 184.0
const PREP_CARD_COLUMNS := 6
const REWARD_CARD_WIDTH := 220
const QA_ACTIONS := {"win": "전투 승리 (K)", "heal": "아군 회복 (H)", "margin": "도망 여유 +5 (J)"}

var run: RefCounted
var speed := 1
var paused := false
var sound_enabled := true
var _clock := 0.0
var _hold := 0.0
var _contact_left := 0.0
var _flight_time := 0.0
var _projectile := ""
var _active_event: Dictionary = {}
var _pending_screen := false
var _feedback: Array[Dictionary] = []
var _feedback_states: Array[Dictionary] = []
var _contact_state: Dictionary = {}
var _shown_actors: Dictionary = {}
var _shown_intent: Dictionary = {}
var _emoted_casts: Dictionary = {}
var _active_skill := ""
var _prep_side := "player"
var _last_gate := ""
var _page: VBoxContainer
var _scroll: ScrollContainer
var _status: Label
var _intent: Label
var _combat_note: Label
var _pause: Button
var _pause_veil: Control
var _fit_board_node: Control
var _fit_row: Control
var _fit_until: Control
var _fit_default := 0.0
var _speed: Button
var _sound_toggle: Button
var _audio: Node
var _effect: Control
var _fighters: Dictionary = {}
var _skill_bars: Dictionary = {}
var _injury_side: OptionButton
var _injury_members: Array = []
var _minimap: Control
var _map_return_focus: Control
var _traveling := false
var _body_readout: VBoxContainer
var _pursuit_track: Control
var _pursuit_urgent := false
var _pursuer_shadow: TextureRect
var _qa_open := false
var _qa_buttons: Dictionary = {}
var _hotkeys: Dictionary[int, Button] = {}
var _upgrade_cards: Dictionary[String, PanelContainer] = {}
var _upgrade_compare: Button
var _show_before_upgrade := false
var _journal_open := false
var _journal_body: RichTextLabel


func _ready() -> void:
	if run == null:
		run = Run.new()
	theme = FieldUI.make_theme()
	_audio = CombatAudio.new()
	_audio.name = "CombatAudio"
	_audio.enabled = sound_enabled
	add_child(_audio)
	visibility_changed.connect(_sync_audio_pause)
	var margin := MarginContainer.new()
	add_child(margin)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 22)
	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.follow_focus = true
	margin.add_child(_scroll)
	_page = _column(12)
	_page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll.add_child(_page)
	_scroll.resized.connect(_fit_board)
	_show()


func _show(focus_key := "") -> void:
	for child in _page.get_children():
		_page.remove_child(child)
		child.queue_free()
	_fighters.clear()
	_shown_actors = {}
	_shown_intent = {}
	_effect = null
	_pause_veil = null
	_fit_board_node = null
	_pursuer_shadow = null
	_journal_body = null
	_skill_bars.clear()
	_injury_side = null
	_injury_members.clear()
	_qa_buttons.clear()
	_hotkeys.clear()
	_upgrade_cards.clear()
	_upgrade_compare = null
	_show_before_upgrade = false
	_scroll.scroll_vertical = 0
	_build_header()
	if run.training:
		_build_training_toolbar()
	if _qa_open:
		_build_qa_toolbar()
	match run.phase:
		"prep": _build_prep(focus_key)
		"combat": _build_combat()
		"recruit": _build_recruit()
		"reward": _build_rewards()
		"route": _build_route()
		"lost": _build_loss()
		"won": _build_escape()
	_build_journal()
	_refresh_status()


func _build_header() -> void:
	var line := _row(12)
	_page.add_child(line)
	var seal := FieldUI.mark("seal", AMBER, 30)
	seal.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(seal)
	var room_name: String = run.data.map[run.area].name
	var title := _label("QA 훈련장" if run.training else room_name, 32, PALE)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(title)
	if run.training:
		line.add_child(_label(room_name, 17, AMBER))
	elif not run.floor_name().is_empty():
		var floor_label := _label(run.floor_name(), 17, AMBER)
		floor_label.name = "FloorName"
		line.add_child(floor_label)
	if run.map_options != null:
		var seed_label := _label(run.seed, 15, MUTED)
		seed_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		seed_label.tooltip_text = run.seed
		line.add_child(seed_label)
		var width := seed_label.get_theme_default_font().get_string_size(run.seed, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		seed_label.custom_minimum_size.x = minf(142.0, ceilf(width) + 2.0)
	_sound_toggle = _button("", _toggle_sound)
	_sound_toggle.name = "ToggleCombatAudio"
	_sound_toggle.toggle_mode = true
	_refresh_sound_toggle()
	line.add_child(_sound_toggle)
	_bind_hotkey(_sound_toggle, KEY_V)
	var map_button := _button("미니맵", _toggle_minimap)
	map_button.name = "OpenMinimap"
	map_button.tooltip_text = "전체 경로 보기 (M)"
	line.add_child(map_button)
	FieldUI.add_key_hint(map_button, "M")
	if codex_requested.has_connections():
		var book := _button("도감", func(): codex_requested.emit())
		book.name = "OpenCodex"
		line.add_child(book)
		_bind_hotkey(book, KEY_D)
	if not run.training and run.phase not in ["won", "lost"]:
		var restart := _button("다시 시작", _restart)
		restart.name = "RestartRun"
		restart.tooltip_text = "같은 시드와 지도 설정으로 격리문부터"
		line.add_child(restart)
	if return_to_title.has_connections() and (run.training or run.area == "threshold" and run.phase == "prep" or run.phase in ["won", "lost"]):
		var home := _button("처음으로", func(): return_to_title.emit())
		home.name = "ReturnTitle"
		line.add_child(home)
	var box := _panel(FieldUI.IRON, FieldUI.RIM, 6)
	_page.add_child(box)
	var body := _row(14)
	box.add_child(body)
	var emblem := FieldUI.mark("heal" if run.training else "exit", AMBER, 24)
	emblem.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	body.add_child(emblem)
	_status = _label("", 16, ALLY)
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(_status)
	if not run.training:
		_pursuit_track = PursuitTrack.new()
		_pursuit_track.name = "PursuitTrack"
		body.add_child(_pursuit_track)
	if run.phase == "combat":
		_pause = _button("전투 계속" if paused else "일시정지", _toggle_pause)
		_speed = _button("배속 %d×" % speed, _cycle_speed)
		body.add_child(_pause)
		body.add_child(_speed)
		_bind_hotkey(_pause, KEY_SPACE)
		_bind_hotkey(_speed, KEY_X)
		_pause.grab_focus()


func _build_training_toolbar() -> void:
	var tools := _row(8)
	_page.add_child(tools)
	var prep := _button("편성", _open_training_view.bind("prep"))
	prep.name = "TrainingPrep"
	prep.disabled = run.phase == "prep"
	tools.add_child(prep)
	var map := _button("지도", _open_training_view.bind("route"))
	map.name = "TrainingMap"
	map.disabled = run.phase == "route"
	tools.add_child(map)
	var enemy := _button("적 행동 켬" if run.training_enemy_acts else "적 행동 끔", _toggle_training_enemy)
	enemy.name = "TrainingEnemy"
	enemy.disabled = run.phase == "combat"
	tools.add_child(enemy)
	tools.add_child(_label("적 피해", 15, MUTED))
	var damage := OptionButton.new()
	damage.name = "TrainingDamage"
	for multiplier in range(1, 6):
		damage.add_item("%d×" % multiplier)
	damage.select(run.training_enemy_damage - 1)
	damage.disabled = run.phase == "combat"
	damage.item_selected.connect(func(index: int): run.set_training_enemy_damage(index + 1))
	tools.add_child(damage)


func _toggle_training_enemy() -> void:
	if run.set_training_enemy_acts(not run.training_enemy_acts):
		var button: Button = _page.find_child("TrainingEnemy", true, false)
		button.text = "적 행동 켬" if run.training_enemy_acts else "적 행동 끔"


func _open_training_view(destination: String) -> void:
	if run.open_training_view(destination):
		_reset_playback()
		_show()


func _build_prep(focus_key: String) -> void:
	if _prep_side not in run.living_roster():
		_prep_side = "player"
	var loadout: Array = run.side_loadout(_prep_side)
	var equipped: int = loadout.size() - loadout.count(null)
	var heading := _row(10)
	_page.add_child(heading)
	var heading_copy := _column(2)
	heading_copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(heading_copy)
	heading_copy.add_child(_label("전투 준비", 24, PALE))
	var enemy_hp := "∞" if run.training else str(run.enemy.hp)
	heading_copy.add_child(_label("%s  %s HP" % [run.enemy.name, enemy_hp], 14, MUTED))
	var start := _button("전투 시작", _begin, true)
	start.name = "BeginCombat"
	start.disabled = not run.ready_to_fight()
	heading.add_child(start)
	_bind_hotkey(start, KEY_B)
	if focus_key.is_empty() and not start.disabled:
		start.grab_focus()
	var board := _arena(174 if run.training else 164, "res://" + run.data.map[run.area].arena)
	_page.add_child(board)
	var ranks := _row(10)
	ranks.name = "PrepRanks"
	_overlay(board, ranks, 12)
	for rank_index in range(Run.RANKS.size() - 1, -1, -1):
		var side = run.formation[rank_index]
		var selected: bool = _prep_side == side
		var card := _panel(Color("#201c20d9"), AMBER if selected else FieldUI.RIM, 7)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_allow_formation_drop(card, rank_index)
		ranks.add_child(card)
		var content := _column(5)
		card.add_child(content)
		var title: String = Run.RANKS[rank_index]
		var position_button := _button(title, _move_ally.bind(rank_index), selected, true)
		position_button.name = "Rank%d" % rank_index
		position_button.tooltip_text = "%s 배치" % run.get(_prep_side).name
		position_button.disabled = side == "player" and _prep_side not in run.formation
		content.add_child(position_button)
		_bind_hotkey(position_button, [KEY_E, KEY_W, KEY_Q][rank_index])
		_allow_formation_drop(position_button, rank_index)
		if focus_key == "rank%d" % rank_index:
			position_button.grab_focus()
		if side != null:
			var actor: Dictionary = run.get(side)
			var member_row := _row(6)
			member_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
			content.add_child(member_row)
			var portrait := _texture(_idle_art(actor.kind), 82)
			portrait.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			member_row.add_child(portrait)
			var identity := _column(5)
			identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			identity.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			member_row.add_child(identity)
			var member := _button(actor.name, _pick_ally.bind(side), selected, true)
			member.name = "Member_" + side
			member.tooltip_text = _member_traits(actor)
			identity.add_child(member)
			_allow_formation_drop(member, rank_index, side)
			if focus_key == side:
				member.grab_focus()
			var health := _label(_member_health(actor), 13, ALLY)
			health.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			identity.add_child(health)
		else:
			var empty := _label("빈자리", 16, MUTED)
			empty.size_flags_vertical = Control.SIZE_EXPAND_FILL
			empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			content.add_child(empty)

	if run.training:
		_build_training_reserves(focus_key)
	var skills_head := _row(10)
	var title := _label("%s 기술" % run.get(_prep_side).name, 21, PALE)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	skills_head.add_child(title)
	var active: Dictionary = run.trait_counts()
	for id: String in active:
		var threshold := int(run.data.traitThreshold)
		if active[id] >= threshold and run.data.traits[id].has("effect"):
			var synergy := FieldUI.badge("link", "%s %d/%d" % [run.data.traits[id].name, active[id], threshold], ALLY)
			synergy.name = "Synergy_" + id
			synergy.tooltip_text = FieldUI.display_copy(run.data.traits[id].effect)
			synergy.mouse_filter = Control.MOUSE_FILTER_PASS
			skills_head.add_child(synergy)
	skills_head.add_child(FieldUI.badge("equipped", "장착 %d/%d" % [equipped, loadout.size()]))
	_page.add_child(skills_head)
	if run.training:
		_build_training_skills(loadout, focus_key)
	else:
		_build_run_skills(loadout, equipped, focus_key)
	if not run.ready_to_fight():
		_page.add_child(_label("출전 대원의 빈 기술 칸을 채우세요.", 15, MUTED))


func _build_run_skills(loadout: Array, equipped: int, focus_key: String) -> void:
	var choices := GridContainer.new()
	choices.add_theme_constant_override("h_separation", FieldUI.CARD_GAP)
	choices.add_theme_constant_override("v_separation", FieldUI.CARD_GAP)
	_page.add_child(choices)
	# 카드가 화면 폭을 꽉 채우며 커지지 않게, 폭을 상한 안에 두고 한 줄에 더 많이 놓는다.
	var fit_cards := func():
		var width := _scroll.size.x - _scroll.get_v_scroll_bar().size.x
		choices.columns = FieldUI.card_columns(width, PREP_CARD_COLUMNS)
		var card_width := clampf(floorf((width - (choices.columns - 1) * FieldUI.CARD_GAP) / choices.columns),
			FieldUI.CARD_SIZE.x, PREP_CARD_WIDTH)
		for stack: Control in choices.get_children():
			stack.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			stack.get_child(0).custom_minimum_size.x = card_width
	_scroll.resized.connect(fit_cards)
	choices.tree_exiting.connect(func(): _scroll.resized.disconnect(fit_cards), CONNECT_ONE_SHOT)
	fit_cards.call()
	var available: Array = run.available_skills(_prep_side)
	for slot in available.size():
		var id: String = available[slot]
		var card: Dictionary = run.cards[id]
		var active: bool = loadout.has(id)
		var full: bool = not active and equipped == loadout.size()
		var button := _card_button(choices, card, _toggle_skill.bind(id), slot + 1, active, -1, full)
		button.name = "Equip_" + id
		if not run.skill_available(id, _prep_side):
			button.tooltip_text = "현재 대열 또는 부위 상태에서 발동 불가"
		if focus_key == id and not button.disabled:
			button.grab_focus()
	fit_cards.call()


func _build_training_reserves(focus_key: String) -> void:
	var row := _row(8)
	row.name = "TrainingReserves"
	_page.add_child(row)
	row.add_child(_label("대기 동료", 15, MUTED))
	for side: String in run.living_roster():
		if side in run.formation:
			continue
		var member := _button(run.get(side).name, _pick_ally.bind(side), side == _prep_side)
		member.name = "Member_" + side
		member.tooltip_text = _member_traits(run.get(side))
		member.set_drag_forwarding(_grab_formation_member.bind(side, member), Callable(), Callable())
		row.add_child(member)
		if focus_key == side:
			member.grab_focus()
	var reserve := _button("선택한 동료를 대기로", _reserve_ally)
	reserve.name = "TrainingReserve"
	reserve.disabled = _prep_side == "player" or _prep_side not in run.formation
	row.add_child(reserve)


func _build_training_skills(loadout: Array, focus_key: String) -> void:
	var options: Array = run.available_skills(_prep_side).filter(func(id):
		var owner: String = run.equipped_by(id)
		return owner.is_empty() or owner == _prep_side)
	var row := _row(10)
	_page.add_child(row)
	for slot in loadout.size():
		var column := _column(4)
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(column)
		column.add_child(_label("장착 칸 %d" % (slot + 1), 14, MUTED))
		var picker := OptionButton.new()
		picker.name = "TrainingSkill%d" % slot
		picker.fit_to_longest_item = false
		picker.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		picker.add_item("비우기")
		picker.select(0)
		for id: String in options:
			var definition: Dictionary = run.cards[id]
			var index := picker.item_count
			picker.add_item("%s  %s" % [definition.name, _seconds(run.cooldown(id))])
			picker.set_item_metadata(index, id)
			picker.get_popup().set_item_tooltip(index, FieldUI.display_copy(definition.description))
			if loadout[slot] == id:
				picker.select(index)
		picker.item_selected.connect(_set_training_skill.bind(slot, picker))
		column.add_child(picker)
		if focus_key == picker.name:
			picker.grab_focus()


func _set_training_skill(index: int, slot: int, picker: OptionButton) -> void:
	var id := "" if index == 0 else str(picker.get_item_metadata(index))
	if run.set_training_skill(_prep_side, slot, id):
		_show(picker.name)


func _reserve_ally() -> void:
	if run.set_training_reserve(_prep_side):
		_show(_prep_side)


func _move_ally(value: int) -> void:
	run.set_rank(value, _prep_side)
	_show("rank%d" % value)


func _allow_formation_drop(control: Control, rank_index: int, side := "") -> void:
	var grab := Callable() if side.is_empty() else _grab_formation_member.bind(side, control)
	control.set_drag_forwarding(grab, _can_drop_formation_member.bind(rank_index), _drop_formation_member.bind(rank_index))


func _grab_formation_member(_at: Vector2, side: String, source: Control) -> Variant:
	if run.phase != "prep" or side not in run.living_roster():
		return null
	var preview := _panel(Color("#2c2425f4"), AMBER, 6)
	var label := _label(run.get(side).name, 16, PALE)
	preview.add_child(label)
	source.set_drag_preview(preview)
	return {"formation_side": side}


func _can_drop_formation_member(_at: Vector2, data: Variant, rank_index: int) -> bool:
	if not data is Dictionary or not data.has("formation_side"):
		return false
	var side: String = data.formation_side
	return run.can_set_rank(rank_index, side) and run.formation[rank_index] != side


func _drop_formation_member(_at: Vector2, data: Variant, rank_index: int) -> void:
	if _can_drop_formation_member(Vector2.ZERO, data, rank_index) and run.set_rank(rank_index, data.formation_side):
		_prep_side = data.formation_side
		_show.call_deferred(_prep_side)


func _pick_ally(side: String) -> void:
	_prep_side = side
	_show(side)


func _toggle_skill(id: String) -> void:
	if run.toggle_skill(id, _prep_side):
		_show(id)


func _begin() -> void:
	if run.begin():
		_reset_playback()
		_show()


func _build_combat() -> void:
	if run.training:
		_build_injury_tools()
	var board := _arena(310 if run.training else 340, "res://" + run.data.map[run.area].arena)
	_page.add_child(board)
	if not run.training:
		_pursuer_shadow = _texture("res://art/arena/prison-pursuer.webp", 0)
		_pursuer_shadow.name = "PursuerShadow"
		board.add_child(_pursuer_shadow)
		_pursuer_shadow.anchor_right = 0.63
		_pursuer_shadow.anchor_bottom = 0.92
	# 어둡게 하는 막은 인물 줄 아래에 둔다. 멈춘 동안 읽어야 할 이름, 의도, 체력은 밝게 남는다.
	_pause_veil = _build_pause_veil()
	_overlay(board, _pause_veil, 0)
	var row := _row(20)
	_overlay(board, row, 16)
	var sides: Array = run.party_sides()
	sides.reverse()
	for side: String in sides:
		_add_fighter(row, side, ALLY)
	_add_fighter(row, "enemy", FOE)
	_effect = CombatEffect.new()
	_effect.name = "CombatEffect"
	_effect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay(board, _effect, 0)
	_body_readout = BattleReadout.new()
	_body_readout.setup(run, sides)
	_page.add_child(_body_readout)
	# 방금 쓴 기술 알림은 부위 상태 줄 오른쪽 빈 곳에 띄워 전장 아래에 빈 줄을 따로 두지 않는다.
	_combat_note = _label(" ", 16, AMBER)
	_combat_note.name = "CombatNote"
	_combat_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_combat_note.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_combat_note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_combat_note.custom_minimum_size.x = 120
	_body_readout.add_note(_combat_note)
	var skills := _row(10)
	_page.add_child(skills)
	var groups := {}
	for side: String in sides:
		var group := _column(5)
		group.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		skills.add_child(group)
		var owner := _label(run.get(side).name, 17, ALLY)
		owner.add_theme_font_override("font", FieldUI.DISPLAY_FONT)
		group.add_child(owner)
		var slots := GridContainer.new()
		slots.columns = 3 if sides.size() == 1 else 1
		slots.add_theme_constant_override("h_separation", 6)
		slots.add_theme_constant_override("v_separation", 5)
		group.add_child(slots)
		groups[side] = slots
	for slot: Dictionary in run.slots:
		var id: String = slot.id
		var box := PanelContainer.new()
		box.add_theme_stylebox_override("panel", FieldUI.framed("slot.png", 7))
		box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		groups[slot.side].add_child(box)
		var content := _column(3)
		box.add_child(content)
		var title: String = run.cards[id].name
		var level := int(run.levels.get(id, 1))
		var label := _label("%s Lv.%d" % [title, level] if level > 1 else title, 15, PALE)
		label.tooltip_text = FieldUI.display_copy(run.cards[id].description)
		var name_row := _row(7)
		content.add_child(name_row)
		var symbol := FieldUI.card_symbol(run.cards[id])
		var icon := FieldUI.mark(symbol, FieldUI.CARD_TYPES[symbol][1], 21)
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		name_row.add_child(icon)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_row.add_child(label)
		var activation := _label("", 12, AMBER)
		name_row.add_child(activation)
		# 남은 시간은 이름 줄 오른쪽, 충전 막대는 그 아래 얇은 줄. 대원이 여럿이어도 기술 칸이 창 안에 들어온다.
		var time := _label("", 13, MUTED)
		time.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		name_row.add_child(time)
		var bar := _bar(slot.cooldown, ALLY)
		bar.custom_minimum_size.y = 5
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		content.add_child(bar)
		_skill_bars[id] = {"bar": bar, "time": time, "activation": activation}
	_add_fallen_notice()
	_refresh_combat()
	_fit_board_node = board
	_fit_row = row
	_fit_until = skills
	_fit_default = board.custom_minimum_size.y
	_fit_board.call_deferred()


func _build_injury_tools() -> void:
	var row := _row(8)
	_page.add_child(row)
	row.add_child(_label("부위 상태", 15, MUTED))
	_injury_side = OptionButton.new()
	_injury_side.name = "InjurySide"
	_injury_side.item_selected.connect(func(_index: int): _refresh_durability())
	row.add_child(_injury_side)
	var parts := OptionButton.new()
	parts.name = "InjuryPart"
	for part: String in Run.PARTS:
		parts.add_item(run.data.parts[part])
	parts.select(Run.PARTS.find("arms"))
	row.add_child(parts)
	var condition := OptionButton.new()
	condition.name = "InjuryCondition"
	for level: String in INJURY_LEVELS:
		condition.add_item(INJURY_LEVELS[level])
		condition.set_item_metadata(condition.item_count - 1, level)
	condition.select(2)
	row.add_child(condition)
	var apply := _button("적용", _apply_injury.bind(parts, condition))
	apply.name = "ApplyInjury"
	row.add_child(apply)
	_build_durability()


func _build_durability() -> void:
	var detail := _label("", 14, MUTED)
	detail.name = "Durability"
	_page.add_child(detail)


func _apply_injury(parts: OptionButton, condition: OptionButton) -> void:
	var side: String = _injury_side.get_selected_metadata()
	var part: String = Run.PARTS[parts.selected]
	var level: String = condition.get_selected_metadata()
	if not run.set_training_injury(side, part, level):
		return
	_clear_feedback()
	_restore_poses()
	_refresh_combat()
	if not _present_events():
		_combat_note.text = "QA  %s %s %s" % [run.get(side).name, run.data.parts[part], INJURY_LEVELS[level]]


func _add_fighter(parent: HBoxContainer, side: String, color: Color) -> void:
	var actor: Dictionary = run.get(side)
	var column := _column(8)
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(column)
	var nameplate := FieldUI.badge("attack" if side == "enemy" else "defense", actor.name, color, 17)
	nameplate.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(nameplate)
	var cue := _label(" ", 13, color)
	cue.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(cue)
	if side == "enemy":
		_intent = cue
		cue.name = "EnemyIntent"
		cue.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	else:
		cue.text = Run.RANKS[run.formation.find(side)]
	var figure := Control.new()
	figure.custom_minimum_size.y = 132
	figure.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(figure)
	var sprite := ActorPortrait.new()
	sprite.setup(run.data.visuals[actor.kind], run.data.wounds if side != "enemy" else {})
	sprite.set_conditions(_actor_conditions(actor))
	_overlay(figure, sprite, 0)
	var gate: Control
	if actor.kind == "bellboy":
		gate = Control.new()
		gate.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_overlay(figure, gate, 4)
		var bars := gate
		bars.draw.connect(func():
			var width := minf(bars.size.x * 0.82, bars.size.y * 0.87)
			var rect := Rect2(Vector2((bars.size.x - width) * 0.5, 0), Vector2(width, bars.size.y))
			bars.draw_rect(rect, Color("#503823"), false, 5.0)
			for i in range(1, 7):
				var x := rect.position.x + width * i / 7.0
				bars.draw_line(Vector2(x, 0), Vector2(x, bars.size.y), Color("#796249"), 5.0)
			bars.draw_line(Vector2(rect.position.x, bars.size.y * 0.5), Vector2(rect.end.x, bars.size.y * 0.5), Color("#59442e"), 8.0))
		bars.resized.connect(bars.queue_redraw)
	var vitality := _panel(Color("#151217e6"), color.darkened(0.55), 5)
	vitality.custom_minimum_size.x = 158
	vitality.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(vitality)
	var meter := _column(2)
	vitality.add_child(meter)
	var caption := _label("", 15, color)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	meter.add_child(caption)
	var hp := VitalityMeter.new()
	hp.setup(actor.maxHp, actor.hp, color)
	meter.add_child(hp)
	_fighters[side] = {"sprite": sprite, "hp": hp, "caption": caption,
		"gate": gate, "column": column, "pose": "idle", "defeated": false}


func _actor_conditions(actor: Dictionary) -> Dictionary:
	var conditions := {}
	for part: String in Run.PARTS:
		var level: String = run.condition(actor, part)
		if level != "healthy":
			conditions[part] = level
	return conditions


func _refresh_status() -> void:
	_refresh_journal()
	if run.training:
		_status.text = "훈련 경과 %s   수녀 %d / %d HP" % [
			_seconds(run.combat_time), run.player.hp, run.player.maxHp]
		return
	var in_combat: bool = run.phase == "combat"
	var urgent: bool = run.distance <= int(run.data.pursuitWarningDistance)
	_pursuit_track.update_distance(run.distance, urgent)
	_status.add_theme_color_override("font_color", FOE if urgent else ALLY)
	if in_combat:
		_update_pursuer_shadow()
		var interval := int(run.data.timing.pursuit)
		var countdown := interval - int(run.elapsed) % interval
		_status.text = "도망 여유 %d   %s 뒤 −1   다음 이동 +%d   전투 %s" % [
			run.distance, _seconds(countdown), run.travel_gain(), _seconds(run.elapsed)]
		if urgent and not _pursuit_urgent:
			_audio.cue("pursuit")
		_pursuit_urgent = urgent
	else:
		_status.text = "도망 여유 %d   다음 이동 +%d   이동 %d칸   전투 %s   수녀 %d/%d HP" % [
			run.distance, run.travel_gain(), run.steps, _seconds(run.combat_time), run.player.hp, run.player.maxHp]


func _update_pursuer_shadow() -> void:
	if not is_instance_valid(_pursuer_shadow):
		return
	_pursuer_shadow.visible = run.distance <= 4
	var approach := clampf((5.0 - run.distance) / 4.0, 0.0, 1.0)
	_pursuer_shadow.anchor_left = lerpf(0.50, 0.37, approach)
	_pursuer_shadow.anchor_top = lerpf(0.26, 0.08, approach)
	_pursuer_shadow.modulate = Color(0.78, 0.59, 0.55, lerpf(0.14, 0.57, approach))


func _refresh_combat(actors: Dictionary = {}) -> void:
	_shown_actors = actors
	if actors.is_empty():
		_refresh_status()
	var eyes: String = run.condition(actors.get("player", run.player), "eyes")
	for side: String in _fighters:
		var actor: Dictionary = actors.get(side, run.get(side))
		var view: Dictionary = _fighters[side]
		view.sprite.set_conditions(_actor_conditions(actor))
		view.hp.set_health(actor.hp)
		var guards := 0
		for part: Dictionary in actor.body.values():
			guards += part.guard
		var health := "∞ HP" if actor.get("infinite", false) else "%d / %d HP" % [actor.hp, actor.maxHp]
		var guard := "   가드 %d" % guards if guards and (eyes != "lost" or side == "enemy") else ""
		view.caption.text = health + guard
	if not actors.is_empty():
		_body_readout.refresh(_shown_intent, actors)
		if run.training:
			_refresh_durability()
		return
	var planned: Dictionary = run.intent()
	_shown_intent = planned
	var gate: String = run.gate_phase()
	if gate != _last_gate:
		_last_gate = gate
		if _fighters.enemy.gate:
			_fighters.enemy.gate.visible = gate != "staggered"
			if _active_event.is_empty():
				_restore_poses()
		if gate == "bell":
			_audio.cue("bell")
	var gate_label: String = {"closed": "철문 닫힘", "bell": "호출벨 (철문 닫힘)",
		"staggered": "기절 (철문 열림)"}.get(gate, "")
	_show_intent(planned, eyes, gate_label)
	_body_readout.refresh(planned)
	for slot: Dictionary in run.slots:
		var left := maxi(0, slot.readyAt - run.elapsed)
		var view: Dictionary = _skill_bars[slot.id]
		var issue: String = run.skill_issue(slot.id, slot.side)
		view.bar.value = slot.cooldown - left if issue.is_empty() else 0
		if not issue.is_empty():
			view.time.text = issue
		elif left > 0:
			view.time.text = _seconds(left)
		elif run.skill_conditions_met(slot.id, slot.side):
			view.time.text = "준비 완료"
		else:
			view.time.text = "회복 대기" if run.cards[slot.id].target == "heal" else "조건 대기"
	if run.training:
		_refresh_injury_members()
		_refresh_durability()


func _show_intent(planned: Dictionary, eyes: String, gate_label: String) -> void:
	var text: String
	if planned.is_empty():
		text = "적 행동 꺼짐"
	elif eyes != "healthy":
		text = "?  눈 부상으로 예고 가려짐"
	else:
		var card: Dictionary = run.cards[planned.id]
		var targets: PackedStringArray = []
		for part: String in planned.targets:
			targets.append(run.data.parts[part])
		var recipient := ""
		if card.type == "attack" and run.party_sides().size() > 1:
			recipient = run.get(planned.side).name + " "
		var amount: int = run.intent_power(planned)
		var value := str(amount) if card.type == "attack" else "+%d" % amount
		text = "%s  %s%s %s  %s" % [card.name, recipient, ", ".join(targets), value,
			_seconds(maxi(0, run.enemy_ready_at - run.elapsed))]
	_intent.text = text if gate_label.is_empty() else gate_label + "  " + text
	_intent.tooltip_text = _intent.text


func _refresh_injury_members() -> void:
	var members: Array = run.party_sides()
	if members == _injury_members:
		return
	var selected: Variant = _injury_side.get_selected_metadata() if _injury_side.selected >= 0 else null
	_injury_members = members
	_injury_side.clear()
	var selection := 0
	for side: String in members:
		var index := _injury_side.item_count
		_injury_side.add_item(run.get(side).name)
		_injury_side.set_item_metadata(index, side)
		if selected == side:
			selection = index
	if not members.is_empty():
		_injury_side.select(selection)
	var apply: Button = _page.find_child("ApplyInjury", true, false)
	apply.disabled = members.is_empty() or run.phase != "combat"


func _refresh_durability() -> void:
	var body: Label = _page.get_node("Durability")
	var side := "player"
	if run.training and _injury_side.selected >= 0:
		side = str(_injury_side.get_selected_metadata())
	var actor: Dictionary = _shown_actors.get(side, run.get(side))
	var wounds: Array[String] = []
	for part: String in Run.PARTS:
		var state: Dictionary = actor.body[part]
		wounds.append("%s %d/%d" % [run.data.parts[part], state.hp, state.max])
	body.text = actor.name + " 부위   " + "   ".join(wounds)


func _process(delta: float) -> void:
	if paused or is_instance_valid(_minimap) or not is_visible_in_tree() or not is_instance_valid(_status):
		return
	for view: Dictionary in _fighters.values():
		view.hp.advance(delta)
	if _hold > 0:
		_advance_feedback(delta)
		return
	if run.phase != "combat":
		return
	_clock += delta * speed * 1000
	var tick: int = int(run.data.timing.tick)
	while _clock >= tick:
		var before: int = run.elapsed
		run.step()
		if before != run.elapsed:
			_clock -= tick
		if _present_events():
			return
		_refresh_combat()
		if run.phase != "combat":
			_show()
			return


func _advance_feedback(delta: float) -> void:
	_effect.advance(delta)
	_hold = maxf(0.0, _hold - delta)
	if not _active_event.is_empty():
		var previous := _contact_left
		_contact_left = maxf(0.0, _contact_left - delta)
		if _contact_left == 0.0:
			_resolve_contact()
		elif not _projectile.is_empty() and previous > _flight_time and _contact_left <= _flight_time:
			_launch_projectile()
	if _hold > 0.0:
		return
	if not _feedback.is_empty():
		_play_next_event()
	elif _pending_screen:
		_pending_screen = false
		_show()
	else:
		_effect.clear()
		_mark_casting("")
		_restore_poses()
	_refresh_qa_toolbar()


func _present_events() -> bool:
	if run.events.is_empty():
		return false
	_feedback.assign(run.events)
	_feedback_states.assign(run.event_states)
	_emoted_casts.clear()
	_clock = 0.0
	_pending_screen = run.phase != "combat"
	_play_next_event()
	_refresh_qa_toolbar()
	return true


func _play_next_event() -> void:
	_restore_poses()
	_effect.clear()
	_active_event = _feedback.pop_front()
	_contact_state = _feedback_states.pop_front()
	var event := _active_event
	var attack: bool = event.type == "hit" and not event.get("training_override", false)
	var heal: bool = event.type == "heal" and event.recovered > 0 and run.data.healingOrigins.has(run.get(event.from).kind)
	_projectile = "healing" if heal else _projectile_for(event) if attack else ""
	_flight_time = 0.24 if heal else float({"arrow": 0.19, "seal": 0.24}.get(_projectile, 0.0)) / speed
	_contact_left = _flight_time + (0.105 / speed if attack else 0.0)
	var read_time := maxf(0.30, 0.47 / speed)
	if event.get("defeated", false):
		read_time = 1.0
	_hold = _contact_left + read_time
	_mark_casting(event.card if event.from != "enemy" else "")
	if heal:
		_pose(event.from, "heal")
		_launch_projectile()
		_show_cast_art(event)
		return
	if not attack:
		_show_cast_art(event)
		_resolve_contact()
		return
	_pose(event.from, "attack")
	_audio.cue("attack")
	var facing := -1.0 if event.from == "enemy" else 1.0
	_effect.windup(_combat_anchor(event.from, "arms"), facing, 0.105 / speed)
	_show_cast_art(event)
	_combat_note.text = "%s  공격" % run.cards[event.card].name


func _projectile_for(event: Dictionary) -> String:
	var kind: String = run.get(event.from).kind
	if kind == "archer" and run.cards[event.card].get("weapon", "") == "bow":
		return "arrow"
	if kind == "shaman" and event.card in ["unseal", "exposeHex"]:
		return "seal"
	return ""


func _launch_projectile() -> void:
	var event := _active_event
	if _projectile == "arrow":
		_pose(event.from, "release")
	var origin := _combat_anchor(event.from, "arms")
	if _projectile == "healing":
		var actor: Dictionary = run.get(event.from)
		var source: Array = run.data.healingOrigins[actor.kind].heal
		origin = _fighters[event.from].sprite.point_at(Vector2(source[0], source[1])) - _effect.get_global_rect().position
	var target := _combat_anchor(event.side, event.targets[0])
	_effect.flight(_projectile, origin, target, _contact_left)


func _mark_casting(id: String) -> void:
	if _skill_bars.has(_active_skill):
		_skill_bars[_active_skill].activation.text = ""
	_active_skill = id
	if _skill_bars.has(id):
		_skill_bars[id].activation.text = "발동"


func _show_cast_art(event: Dictionary) -> void:
	var key: String = event.from + ":" + event.card
	var card: Dictionary = run.cards[event.card]
	if event.from == "enemy" or not card.get("emote") or _emoted_casts.has(key):
		return
	_emoted_casts[key] = true
	_effect.show_emote(load("res://" + card.emote), _combat_anchor(event.from, "chest"))


func _resolve_contact() -> void:
	var event := _active_event
	_refresh_combat({} if _feedback.is_empty() else _contact_state)
	_show_event(event)
	var points: Array[Vector2] = []
	for part: String in event.targets:
		points.append(_combat_anchor(event.side, "chest" if event.get("gateBlock", false) else part))
	_effect.impact(event, points, -1.0 if event.side == "enemy" else 1.0, maxf(0.02, _hold))
	_audio.play_result(event)
	if _pending_screen and _feedback.is_empty():
		for view: Dictionary in _fighters.values():
			_hold = maxf(_hold, view.hp.remaining_loss())
	_active_event = {}
	_contact_state = {}


func _combat_anchor(side: String, part: String) -> Vector2:
	var view: Dictionary = _fighters[side]
	return view.sprite.anchor_at(part) - _effect.get_global_rect().position


func _show_event(event: Dictionary) -> void:
	var skill: String = run.cards[event.card].name
	var part: String = run.data.parts[event.targets[0]] if not event.targets.is_empty() else ""
	match String(event.type):
		"hit":
			if event.dealt > 0:
				_fighters[event.side].defeated = event.defeated
				_pose(event.side, "defeat" if event.defeated else "hit")
			elif event.blocked > 0 and not event.get("gateBlock", false):
				_pose(event.side, "guard")
			if event.from == "enemy" and _last_gate == "staggered":
				_pose("enemy", "staggered")
			if event.get("training_override", false):
				var actor: Dictionary = run.get(event.side)
				_combat_note.text = "QA  %s %s %s" % [actor.name, part, INJURY_LEVELS[run.condition(actor, event.targets[0])]]
			elif event.get("gateBlock", false):
				_combat_note.text = "%s  철문에 막힘" % skill
			else:
				var result := PackedStringArray()
				if event.dealt:
					result.append("피해 %d" % event.dealt)
				if event.blocked:
					result.append("막음 %d" % event.blocked)
				if event.get("removed", 0):
					result.append("가드 −%d" % event.removed)
				_combat_note.text = "%s  %s %s" % [skill, part, ", ".join(result)]
		"guard":
			_pose(event.from, "guard")
			_combat_note.text = "%s  %s 가드 %d" % [skill, part, event.added]
		"heal":
			_pose(event.from, "heal")
			_combat_note.text = "%s  %s 회복 %d" % [skill, part, event.recovered]
		"setup":
			_combat_note.text = skill


func _pose(side: String, pose_name: String) -> void:
	if not _fighters.has(side):
		return
	var view: Dictionary = _fighters[side]
	view.sprite.show_pose(pose_name)
	view.pose = view.sprite.pose


func _restore_poses() -> void:
	for side: String in _fighters:
		if _fighters[side].defeated:
			_pose(side, "defeat")
		elif run.get(side).kind == "bellboy" and _last_gate in ["bell", "staggered"]:
			_pose(side, _last_gate)
		else:
			_pose(side, "idle")


func _toggle_pause() -> void:
	paused = not paused
	_pause.text = "전투 계속" if paused else "일시정지"
	if is_instance_valid(_pause_veil):
		_pause_veil.visible = paused
	_sync_audio_pause()


func _sync_audio_pause() -> void:
	_audio.suspended = paused or is_instance_valid(_minimap) or not is_visible_in_tree()


func _input(event: InputEvent) -> void:
	if _traveling or not is_visible_in_tree() or not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.ctrl_pressed or event.alt_pressed or event.meta_pressed:
		return
	var focused := get_viewport().gui_get_focus_owner()
	if focused is LineEdit or (focused is OptionButton and focused.get_popup().visible):
		return
	var key: int = event.keycode
	if key == KEY_M or (key == KEY_ESCAPE and is_instance_valid(_minimap)):
		_toggle_minimap()
	elif is_instance_valid(_minimap) or event.shift_pressed:
		return
	elif key == KEY_F8:
		if _hold > 0.0:
			return
		_qa_open = not _qa_open
		if run.phase == "combat":
			if _qa_open:
				_build_qa_toolbar()
			else:
				var tools := _page.get_node("QaTools")
				_page.remove_child(tools)
				tools.queue_free()
				_qa_buttons.clear()
		else:
			_show()
	elif _qa_open and key in [KEY_K, KEY_H, KEY_J]:
		_run_qa({KEY_K: "win", KEY_H: "heal", KEY_J: "margin"}[key])
	elif _hotkeys.has(key):
		var button := _hotkeys[key]
		if not button.disabled and button.is_visible_in_tree():
			button.pressed.emit()
	else:
		return
	get_viewport().set_input_as_handled()


func _bind_hotkey(button: Button, key: int, corner := false) -> void:
	_hotkeys[key] = button
	FieldUI.add_key_hint(button, OS.get_keycode_string(key), corner)


func _bind_number(button: Button, number: int, corner := false) -> void:
	if number <= 9:
		_bind_hotkey(button, KEY_0 + number, corner)


func _toggle_minimap() -> void:
	if _traveling:
		return
	if is_instance_valid(_minimap):
		remove_child(_minimap)
		_minimap.queue_free()
		_minimap = null
		_scroll.show()
		_sync_audio_pause()
		if is_instance_valid(_map_return_focus):
			_map_return_focus.grab_focus()
		return
	_map_return_focus = get_viewport().gui_get_focus_owner()
	if _map_return_focus == null:
		_map_return_focus = _page.find_child("OpenMinimap", true, false)
	_minimap = ColorRect.new()
	_minimap.name = "Minimap"
	_minimap.color = FieldUI.BLACK
	_overlay(self, _minimap, 0)
	var content := _column(12)
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	_overlay(_minimap, content, 32)
	_build_map_panel(content, true)
	var close := _button("닫기 (Esc)", _toggle_minimap, true)
	close.name = "CloseMinimap"
	close.size_flags_horizontal = Control.SIZE_SHRINK_END
	content.add_child(close)
	_scroll.hide()
	_sync_audio_pause()
	close.grab_focus()


func _toggle_sound() -> void:
	sound_enabled = not sound_enabled
	_audio.enabled = sound_enabled
	_refresh_sound_toggle()
	sound_changed.emit(sound_enabled)


func _refresh_sound_toggle() -> void:
	_sound_toggle.text = "효과음 켬" if sound_enabled else "효과음 끔"
	_sound_toggle.set_pressed_no_signal(sound_enabled)


func _build_journal() -> void:
	var toggle := _button("행동 기록", func():
		_journal_open = not _journal_open
		_journal_body.visible = _journal_open
		_refresh_journal(), false, true)
	toggle.name = "ToggleJournal"
	toggle.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	toggle.toggle_mode = true
	toggle.set_pressed_no_signal(_journal_open)
	_page.add_child(toggle)
	_bind_hotkey(toggle, KEY_L)
	_journal_body = RichTextLabel.new()
	_journal_body.name = "JournalEntries"
	_journal_body.custom_minimum_size.y = 144
	_journal_body.add_theme_font_size_override("normal_font_size", 15)
	_journal_body.visible = _journal_open
	_page.add_child(_journal_body)


func _refresh_journal() -> void:
	if _journal_open and is_instance_valid(_journal_body):
		var entries := FieldUI.display_copy("\n".join(run.journal))
		if entries != _journal_body.text:
			_journal_body.text = entries


func _build_qa_toolbar() -> void:
	var row := _row(8)
	row.name = "QaTools"
	_page.add_child(row)
	_page.move_child(row, 3 if run.training else 2)
	row.add_child(_label("QA", 15, AMBER))
	for id: String in QA_ACTIONS:
		var button := _button(QA_ACTIONS[id], _run_qa.bind(id), false, true)
		button.name = "Qa_" + id
		row.add_child(button)
		_qa_buttons[id] = button
	_refresh_qa_toolbar()


func _refresh_qa_toolbar() -> void:
	for id: String in _qa_buttons:
		_qa_buttons[id].disabled = _hold > 0.0 or not run.can_use_qa(id)


func _run_qa(id: String) -> void:
	if not _qa_open or _traveling or _hold > 0.0 or not run.use_qa(id):
		return
	if run.phase == "combat":
		_refresh_combat()
	else:
		_show()


func _cycle_speed() -> void:
	speed = speed * 2 if speed < 4 else 1
	_speed.text = "배속 %d×" % speed


func _build_recruit() -> void:
	var kind: String = run.pending_recruit
	var recruit: Dictionary = run.data.recruits[kind]
	_page.add_child(_label("동료와의 만남", 24, PALE))
	var panel := _panel(FieldUI.IRON, AMBER.darkened(0.5))
	_page.add_child(panel)
	var row := _row(20)
	panel.add_child(row)
	var art := _texture("res://art/encounters/%s.webp" % kind, 300)
	art.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(art)
	var text := _column(12)
	text.custom_minimum_size.x = 280
	row.add_child(text)
	text.add_child(_label(recruit.name, 25, PALE))
	var tags: Array[String] = []
	for trait_id: String in recruit.factions + recruit.jobs:
		tags.append(run.data.traits[trait_id].name)
	var traits := _label(", ".join(tags), 15, AMBER)
	traits.mouse_filter = Control.MOUSE_FILTER_PASS
	traits.tooltip_text = _member_traits(recruit)
	text.add_child(traits)
	var max_arm := int(recruit.health[2])
	var max_hp := int(recruit.vitality)
	var arm := int(recruit.get("hurtArm", max_arm))
	var life := "%d / %d HP" % [max_hp - max_arm + arm, max_hp]
	if arm < max_arm:
		life += "  팔 부상 %d / %d" % [arm, max_arm]
	text.add_child(_label(life, 16, MUTED))
	for id: String in recruit.loadout:
		text.add_child(_label(run.cards[id].name + "   " + _seconds(run.cooldown(id)), 16, PALE))
	var full: bool = run.party_sides().size() == Run.RANKS.size()
	if full:
		var slot := 1
		for side: String in run.party_sides():
			if side == "player":
				continue
			var swap := _button("%s 대신 영입" % run.get(side).name, _recruit.bind(true, side))
			swap.name = "Replace_" + side
			text.add_child(swap)
			_bind_number(swap, slot)
			slot += 1
			_add_recruit_synergy(text, recruit, side)
	else:
		var accept := _button("함께 가기", _recruit.bind(true), true)
		accept.name = "Recruit_" + kind
		text.add_child(accept)
		_bind_number(accept, 1)
		_add_recruit_synergy(text, recruit)
		accept.grab_focus()
	var decline := _button("지나가기", _recruit.bind(false))
	decline.name = "DeclineRecruit"
	text.add_child(decline)
	_bind_number(decline, 0)
	if full:
		decline.grab_focus()


func _member_traits(actor: Dictionary) -> String:
	var labels: PackedStringArray = []
	for id: String in actor.factions + actor.jobs:
		var trait_data: Dictionary = run.data.traits[id]
		var text: String = trait_data.name
		if trait_data.has("effect"):
			text += "  " + FieldUI.display_copy(trait_data.effect)
		labels.append(text)
	return "\n".join(labels)


func _add_recruit_synergy(container: VBoxContainer, candidate: Dictionary, outgoing := "") -> void:
	var before: Dictionary = run.trait_counts()
	var after: Dictionary = run.trait_counts(outgoing, candidate)
	var threshold := int(run.data.traitThreshold)
	for id: String in run.data.traits:
		var from_count := int(before.get(id, 0))
		var to_count := int(after.get(id, 0))
		var trait_data: Dictionary = run.data.traits[id]
		if not trait_data.has("effect") or (from_count >= threshold) == (to_count >= threshold):
			continue
		var text := "활성" if to_count >= threshold else "해제"
		var color := ALLY if to_count >= threshold else FOE
		var preview := _label("%s %d→%d  %s" % [trait_data.name, from_count, to_count, text], 15, color)
		preview.name = "RecruitSynergy_" + (outgoing if not outgoing.is_empty() else "join") + "_" + id
		preview.tooltip_text = FieldUI.display_copy(trait_data.effect)
		preview.mouse_filter = Control.MOUSE_FILTER_PASS
		container.add_child(preview)


func _add_fallen_notice() -> void:
	var fallen: PackedStringArray = run.fallen_names()
	if not fallen.is_empty():
		_page.add_child(_label("사망  " + ", ".join(fallen), 15, FOE))


func _recruit(accept: bool, outgoing := "") -> void:
	if run.decide_recruit(accept, outgoing):
		_show()


func _build_rewards() -> void:
	var heading := _row(10)
	_page.add_child(heading)
	var title := _label("전투 보상", 25, PALE)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title)
	var row := _row(12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	_page.add_child(row)
	for slot in run.rewards.size():
		var id: String = run.rewards[slot]
		var card: Dictionary = run.cards[id]
		var level := int(run.levels.get(id, 0))
		var button := _card_button(row, card, _take_reward.bind(id), slot + 1, false, level)
		button.name = "Reward_" + id
		if id == run.rewards[0]:
			button.grab_focus()
	if not _upgrade_cards.is_empty():
		_upgrade_compare = _button("강화 전 보기", _toggle_upgrade_preview, false, true)
		_upgrade_compare.name = "CompareUpgrade"
		_upgrade_compare.tooltip_text = "강화 보상의 현재 수치를 확인합니다."
		heading.add_child(_upgrade_compare)
		_bind_hotkey(_upgrade_compare, KEY_U)
	var skip := _button("건너뛰기", _take_reward.bind(""))
	skip.name = "SkipReward"
	skip.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_page.add_child(skip)
	_bind_number(skip, 0)


func _toggle_upgrade_preview() -> void:
	_show_before_upgrade = not _show_before_upgrade
	_upgrade_compare.text = "강화 후 보기" if _show_before_upgrade else "강화 전 보기"
	_upgrade_compare.tooltip_text = "강화 후 수치를 미리 봅니다." if _show_before_upgrade else "강화 보상의 현재 수치를 확인합니다."
	for id: String in _upgrade_cards:
		var level := int(run.levels[id])
		var displayed_level := level if _show_before_upgrade else level + 1
		var time: int = run.cooldown(id, displayed_level)
		FieldUI.set_card_values(_upgrade_cards[id], run.cards[id].name, displayed_level, time,
			time != run.cooldown(id, level))


func _take_reward(id: String) -> void:
	if run.choose_reward(id):
		_show()


func _build_route() -> void:
	if not run.pending_mystery.is_empty():
		_build_mystery()
		return
	if not run.mystery_result.is_empty():
		_page.add_child(_label(run.mystery_result, 15, AMBER))
	_add_fallen_notice()
	var treatment_focus: Button
	var room: Dictionary = run.data.map[run.area]
	if room.type == "rest":
		treatment_focus = _build_rest()
	var map := _build_map_panel(_page)
	var moves: Array[Button] = map.move_buttons()
	for slot in moves.size():
		_bind_number(moves[slot], slot + 1, true)
	if room.type == "shop":
		_build_market()
	if treatment_focus != null:
		treatment_focus.grab_focus()
	elif map.first_move() != null:
		map.first_move().grab_focus()


func _build_map_panel(parent: Container, preview := false) -> Control:
	var room: Dictionary = run.data.map[run.area]
	var panel := _panel(FieldUI.IRON)
	parent.add_child(panel)
	var content := _column(9)
	panel.add_child(content)
	var heading := _row(12)
	content.add_child(heading)
	var title := _label("전체 경로", 23, PALE)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title)
	if not run.training:
		var gain: int = run.travel_gain()
		var travel_text := "다음 이동 시 도망 여유 +%d" % gain
		if run.distance + gain <= 0:
			travel_text = "이동 시 추격에 붙잡힘"
		if run.map_options != null:
			travel_text = "동전 %d   %s" % [run.coins, travel_text]
		heading.add_child(_label(travel_text, 15, FOE if run.distance + gain <= 0 else AMBER))
	var legend := HFlowContainer.new()
	legend.add_theme_constant_override("h_separation", 6)
	content.add_child(legend)
	var types: Array = run.data.map.values().map(func(item): return item.type)
	for type: String in RouteMap.TYPES:
		if type not in types:
			continue
		legend.add_child(FieldUI.badge(type, RouteMap.TYPES[type][0], RouteMap.TYPES[type][1]))
	var map := RouteMap.new()
	map.name = "RouteMap"
	var reachable: Array = room.next
	if run.training:
		reachable = run.data.map.keys().filter(func(id): return id != run.area and not run.data.map[id].foe.is_empty())
	map.setup(run.data.map, run.trail, reachable, preview, "연습 가능" if run.training else "다음 방")
	if not preview:
		map.room_chosen.connect(_travel.bind(map))
		map.travel_finished.connect(_arrive)
	content.add_child(map)
	return map


func _travel(room: String, map: Control) -> void:
	if _traveling or not run.can_move(room):
		return
	if run.training:
		_arrive(room)
		return
	_traveling = true
	map.animate_travel(run.area, room)


func _arrive(room: String) -> void:
	_traveling = false
	if run.move_to(room):
		_prep_side = "player"
		_show()
	arrived.emit(room)


func _build_rest() -> Button:
	var panel := _panel(FieldUI.IRON, AMBER.darkened(0.5))
	_page.add_child(panel)
	var row := _row(16)
	panel.add_child(row)
	var art := LocationScene.new()
	art.name = "CampScene"
	art.setup(run)
	art.custom_minimum_size = Vector2(250, 190)
	art.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(art)
	var content := _column(5)
	content.custom_minimum_size.x = 280
	row.add_child(content)
	content.add_child(_label(run.data.map[run.area].name, 22, PALE))
	var treatment: Dictionary = run.stair_treatment
	if not treatment.is_empty():
		if treatment.area == run.area:
			content.add_child(_label("%s  %s +%d" % [
				treatment.name, run.data.parts[treatment.target], treatment.recovered], 15, ALLY))
		else:
			content.add_child(_label("치료 기회 사용", 15, MUTED))
			if not run.rest_finished:
				return _rest_finish_button(content)
		return null
	if run.rest_finished:
		return null
	var buttons: Array[Button] = []
	for side: String in run.party_sides():
		for part: String in Run.PARTS:
			if not run.can_treat(side, part):
				continue
			var actor: Dictionary = run.get(side)
			var wound: Dictionary = actor.body[part]
			var text := "%s  %s %d → %d" % [
				actor.name, run.data.parts[part], wound.hp, mini(wound.max, wound.hp + 2)]
			var button := _button(text, _treat.bind(side, part))
			button.name = "Treat_%s_%s" % [side, part]
			content.add_child(button)
			buttons.append(button)
	if buttons.is_empty():
		var message := "도망 여유 부족" if run.distance <= 1 else "치료할 부상 없음"
		content.add_child(_label(message, 15, MUTED))
		return _rest_finish_button(content)
	content.add_child(_label("도망 여유 −1   내구도 최대 +2", 14, AMBER))
	return buttons[0]


func _treat(side: String, part: String) -> void:
	if not _traveling and run.treat_at_stairs(side, part):
		_audio.cue("heal")
		_show()


func _rest_finish_button(content: VBoxContainer) -> Button:
	var finish := _button("휴식 마치기", func():
		if not _traveling and run.finish_rest():
			_show())
	finish.name = "FinishRest"
	content.add_child(finish)
	return finish


func _build_market() -> void:
	_page.add_child(_label("암시장", 23, PALE))
	var panel := _panel(FieldUI.IRON)
	_page.add_child(panel)
	var body := _row(14)
	panel.add_child(body)
	var stock := _column(6)
	stock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(stock)
	var scene := _texture("res://art/locations/shop.webp", 140, true)
	scene.custom_minimum_size.x = 170
	body.add_child(scene)
	for id: String in run.data.shopOffers:
		var offer: Dictionary = run.data.shopOffers[id]
		var row := _row(8)
		stock.add_child(row)
		var icon := _texture("res://" + offer.art, 38)
		icon.custom_minimum_size.x = 38
		row.add_child(icon)
		var item := _label(offer.name, 15, PALE)
		item.tooltip_text = FieldUI.display_copy(offer.effect)
		item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(item)
		var issue: String = run.shop_issue(id)
		var picker: OptionButton
		var targets: Dictionary = run.shop_targets(id)
		if issue.is_empty() and not targets.is_empty():
			picker = OptionButton.new()
			picker.custom_minimum_size.x = 160
			for key: String in targets:
				picker.add_item(targets[key])
				picker.set_item_metadata(picker.item_count - 1, key)
			picker.select(0)
			row.add_child(picker)
		var caption := "구입 (동전 %d)" % int(offer.price) if issue.is_empty() else issue
		var buy := _button(caption, _buy.bind(id, picker))
		buy.name = "Buy_" + id
		buy.disabled = not issue.is_empty()
		buy.tooltip_text = item.tooltip_text
		row.add_child(buy)


func _buy(id: String, picker: OptionButton) -> void:
	var target: String = picker.get_selected_metadata() if picker != null else ""
	if not _traveling and run.buy_shop_offer(id, target):
		_show()


func _build_mystery() -> void:
	var event: Dictionary = run.data.mysteryEvents[run.pending_mystery]
	var board := _arena(290, "res://" + event.art)
	_page.add_child(board)
	_page.add_child(_label(event.name, 23, PALE))
	_page.add_child(_label(event.description, 16, MUTED))
	var issue: String = run.mystery_issue()
	var effect := "도망 여유 %d → %d   동전 %d → %d" % [
		run.distance, run.distance + run.mystery_distance(), run.coins, run.coins + int(event.coins)]
	_page.add_child(_label(effect if issue.is_empty() else issue, 15, AMBER))
	var buttons := _row(10)
	_page.add_child(buttons)
	var take := _button(event.action, _resolve_mystery.bind(true), true)
	take.name = "TakeMystery"
	take.disabled = not issue.is_empty()
	buttons.add_child(take)
	var skip := _button("지나치기", _resolve_mystery.bind(false))
	skip.name = "SkipMystery"
	buttons.add_child(skip)
	if take.disabled:
		skip.grab_focus()
	else:
		take.grab_focus()


func _resolve_mystery(take: bool) -> void:
	if run.resolve_mystery(take):
		_show()


func _member_health(actor: Dictionary) -> String:
	var details: Array[String] = ["%d/%d HP" % [actor.hp, actor.maxHp]]
	for part: String in Run.PARTS:
		var wound: Dictionary = actor.body[part]
		if wound.hp < wound.max:
			details.append("%s %d/%d" % [run.data.parts[part], wound.hp, wound.max])
	return "   ".join(details)


func _idle_art(kind: String) -> String:
	return "res://" + run.data.visuals[kind].idle


func _build_escape() -> void:
	var board := LocationScene.new()
	board.name = "EscapeScene"
	board.custom_minimum_size.y = 350
	board.setup(run, true)
	_page.add_child(board)
	_page.add_child(_label("탈출 성공", 31, AMBER))
	_add_restart(_page)


func _build_loss() -> void:
	if run.loss_cause == "pursuit":
		_audio.cue("pursuit")
		var scene := CaptureScene.new()
		scene.name = "CaptureScene"
		_page.add_child(scene)
	var panel := _panel(FieldUI.IRON, AMBER.darkened(0.5))
	_page.add_child(panel)
	var body := _column(17)
	panel.add_child(body)
	var title := "추격에 붙잡힘" if run.loss_cause == "pursuit" else "수녀가 쓰러짐"
	body.add_child(_label(title, 31, AMBER))
	if run.loss_cause != "pursuit":
		body.add_child(_label(run.loss_message, 15, MUTED))
	_add_restart(body)


func _add_restart(parent: Container) -> void:
	if run.qa_uses:
		parent.add_child(_label("QA  치트 %d회 사용" % run.qa_uses, 15, AMBER))
	var restart := _button("다시 준비", _restart)
	restart.name = "Restart"
	parent.add_child(restart)
	restart.grab_focus()


func _restart() -> void:
	if run.training:
		_open_training_view("prep")
		return
	run = Run.new(run.seed, run.map_options)
	_prep_side = "player"
	_reset_playback()
	_show()


func _reset_playback() -> void:
	_clock = 0
	_clear_feedback()
	_traveling = false
	_last_gate = ""
	_pursuit_urgent = false
	paused = false
	_sync_audio_pause()


func _clear_feedback() -> void:
	_hold = 0
	_contact_left = 0
	_flight_time = 0
	_projectile = ""
	_active_event = {}
	_pending_screen = false
	_feedback.clear()
	_feedback_states.clear()
	_contact_state = {}
	_emoted_casts.clear()
	_mark_casting("")
	_audio.stop_cues()
	if is_instance_valid(_effect):
		_effect.clear()


func _seconds(ms: int) -> String:
	return "%.1f초" % (ms / 1000.0)


func _style(fill: Color, edge: Color, pad := 11) -> StyleBoxFlat:
	return FieldUI.plate(fill, edge, pad)


func _panel(color: Color, edge := FieldUI.RIM, padding := 11) -> PanelContainer:
	var panel := PanelContainer.new()
	if color == FieldUI.IRON:
		# 철판 패널은 생성한 틀을 쓴다. 강조 테두리는 틀을 조금 밝혀서 표시한다.
		var tint := Color.WHITE if edge == FieldUI.RIM else Color(1.25, 1.12, 0.95)
		panel.add_theme_stylebox_override("panel", FieldUI.framed("panel.png", padding, tint))
	else:
		panel.add_theme_stylebox_override("panel", _style(color, edge, padding))
	return panel


func _row(separation: int) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", separation)
	return row


func _column(separation: int) -> VBoxContainer:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", separation)
	return column


func _label(value: String, font_size: int, color: Color) -> Label:
	return FieldUI.label(value, font_size, color, font_size >= 21)


func _button(value: String, action: Callable, accent := false, compact := false) -> Button:
	var button := Button.new()
	button.text = value
	FieldUI.style_action(button, accent, compact)
	button.pressed.connect(action)
	return button


func _texture(path: String, min_height: float, crop := false) -> TextureRect:
	var image := TextureRect.new()
	image.texture = load(path)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED if crop else TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size.y = min_height
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return image


# 전장 일시정지 표시. 배경만 어둡게 하고 가운데에 상태를 흐리게 새긴다. 인물 줄 아래에 놓인다.
func _build_pause_veil() -> Control:
	var veil := ColorRect.new()
	veil.name = "PauseVeil"
	veil.color = Color("#0c0a0ea6")
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var badge := _column(0)
	badge.name = "PauseBadge"
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.modulate.a = 0.72
	var title := _label("일시정지", 38, AMBER)
	title.add_theme_font_override("font", FieldUI.DISPLAY_FONT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.add_child(title)
	var hint := _label("Space로 계속", 14, PALE)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.add_child(hint)
	veil.add_child(badge)
	badge.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	badge.grow_horizontal = Control.GROW_DIRECTION_BOTH
	badge.grow_vertical = Control.GROW_DIRECTION_BOTH
	veil.visible = paused
	return veil


# 창 높이에 맞춰 전투 전장 높이를 정한다. 기술 칸 줄의 아래 끝이 스크롤 영역 안에 들어오도록
# 기본 높이에서 넘친 만큼만 줄이고, 인물 줄이 들어갈 높이 밑으로는 줄이지 않는다.
# 매번 기본 높이에서 다시 계산하므로 창이 커지면 다시 늘어난다. 행동 기록처럼 기술 칸 아래 내용은 세지 않는다.
func _fit_board() -> void:
	if not is_instance_valid(_fit_board_node) or not _fit_board_node.is_inside_tree():
		return
	var separation := _page.get_theme_constant("separation")
	var bottom := 0.0
	for child in _page.get_children():
		var control := child as Control
		if control == null or not control.visible:
			continue
		bottom += (_fit_default if control == _fit_board_node else control.get_combined_minimum_size().y) + separation
		if control == _fit_until:
			break
	var overflow := ceilf(bottom - separation - _scroll.size.y)
	var floor_height := minf(_fit_default, maxf(COMBAT_BOARD_MIN, _fit_row.get_combined_minimum_size().y + 32.0))
	_fit_board_node.custom_minimum_size.y = clampf(_fit_default - maxf(0.0, overflow), floor_height, _fit_default)


func _arena(height: int, image_path: String) -> Control:
	var board := Control.new()
	board.custom_minimum_size.y = height
	_overlay(board, _texture(image_path, 0, true), 0)
	var shade := ColorRect.new()
	shade.color = Color("#100e1245")
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay(board, shade, 0)
	var surround := Panel.new()
	surround.name = "ArenaFrame"
	var rim := FieldUI.framed("frame.png", 0)
	rim.draw_center = false
	surround.add_theme_stylebox_override("panel", rim)
	surround.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay(board, surround, 0)
	return board


func _overlay(parent: Control, child: Control, inset: int) -> void:
	parent.add_child(child)
	child.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	child.offset_left = inset
	child.offset_top = inset
	child.offset_right = -inset
	child.offset_bottom = -inset


func _bar(maximum: int, color: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.max_value = maximum
	bar.custom_minimum_size.y = 7
	bar.show_percentage = false
	bar.add_theme_stylebox_override("background", _style(INK, INK, 0))
	bar.add_theme_stylebox_override("fill", _style(color, color, 0))
	return bar


func _card_button(parent: Container, card: Dictionary, action: Callable, number: int,
		active := false, reward_from := -1, disabled := false) -> Button:
	var stack := _column(5)
	stack.size_flags_horizontal = Control.SIZE_FILL if reward_from >= 0 else Control.SIZE_EXPAND_FILL
	parent.add_child(stack)
	var panel := FieldUI.card_shell(card, run.data, reward_from < 0)
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if reward_from >= 0:
		panel.custom_minimum_size.x = REWARD_CARD_WIDTH
	stack.add_child(panel)
	var owned_level := int(run.levels.get(card.id, 1))
	var displayed_level := reward_from + 1 if reward_from >= 0 else owned_level
	var time: int = run.cooldown(card.id, displayed_level)
	var reference: int = run.cooldown(card.id, owned_level if reward_from > 0 else 1)
	FieldUI.set_card_values(panel, card.name, displayed_level, time, time != reference)
	if reward_from > 0:
		_upgrade_cards[card.id] = panel
	var column := panel.get_node("CardContent") as VBoxContainer
	var body := column.get_node("Details/CardBody") as VBoxContainer
	var description := FieldUI.card_effect_text(card.description)
	description.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if reward_from < 0:
		FieldUI.clamp_effect_lines(description, FieldUI.COMPACT_EFFECT_LINES)
	body.add_child(description)
	var action_text := "획득" if reward_from == 0 else "강화" if reward_from > 0 else "해제" if active else "장착"
	var button := _button(action_text, action, active)
	button.disabled = disabled
	FieldUI.style_card_action(button, active)
	button.accessibility_name = "%s %s" % [card.name, action_text]
	button.tooltip_text = description.tooltip_text
	button.accessibility_description = description.tooltip_text
	column.add_child(button)
	if number <= 9:
		_hotkeys[KEY_0 + number] = button
		var keycap := FieldUI.card_shortcut(number)
		if disabled:
			keycap.modulate.a = 0.5
		stack.add_child(keycap)
	return button
