extends Control
## 기술 충전과 적 행동을 한 줄에 모아 보여 주는 수렴선.
## 아군 기술 카드는 왼쪽, 적의 다음 행동은 오른쪽에서 중앙 발동선으로 다가온다.
## 발동 직전 카드는 선에서 떠나 중앙 위 대기열에 올라가 규칙의 발동 순서대로 서고, 적 카드가 발동선 건너편에서 마주 본다.
##
## 전투 규칙은 읽기만 한다. 발동 순서는 run.firing_order(), 막기 예고는 run.guard_blocks()에 묻고 따로 흉내 내지 않는다.
## 화면은 매 틱 refresh()로 상태를 넘기고, 발동 연출 동안 set_active()/cast_enemy()로 발동 중인 카드를 알려 준다.
## 배치는 refresh·set_lead·크기 변경 때 _layout()에서 계산하고, _draw()는 그 결과만 그린다.

const FieldUI := preload("res://ui/field_ui.gd")
const Glyph := preload("res://ui/field_glyph.gd")
const PAD := 4.0
const GAP := 8.0
const END := 14.0
const TOKEN := 24.0
const CARD := Vector2(58, 36)
const CARD_LABEL := 17.0
## 발동선과 대기열 카드 사이 거리.
const MIDDLE := 9.0
const SLOT_GAP := 5.0
## 1배속 기준 대기열에 오르는 남은 시간. 배속이 높으면 실제 시간으로 너무 짧지 않게 2배속까지 넓힌다.
const QUEUE_MS := 1000
const QUEUE_SIZE := 3
## 카드가 선과 대기열 사이를 옮겨 가는 시간(1배속 실제 초). 배속만큼 빨라진다.
const LIFT_TIME := 0.22
## 이보다 짧은 기술만 있어도 반쪽 폭은 6초다. 더 긴 기술이 있으면 그 기술이 끝에서 출발하도록 넓힌다.
const MIN_WINDOW := 6000
## VISUAL_DESIGN.md의 보조 글 크기.
const FONT_SIZE := 13
const ENEMY := "@enemy"

## 화면 배속. 대기열 진입 시간과 옮겨 가는 속도에 쓴다.
var speed := 1:
	set(value):
		speed = maxi(1, value)
		_layout()

var _run: RefCounted
var _window := MIN_WINDOW
var _lead := 0.0
var _active := ""
var _eyes := "healthy"
## 화면 갱신 시점의 아군 토큰. {id, side, left, order, symbol, state, label, name, guards}
var _tokens: Array[Dictionary] = []
## 다음 적 행동 {id, left, label}과 지금 연출 중인 적 행동 {id, label, result}.
var _foe: Dictionary = {}
var _foe_cast: Dictionary = {}
## _layout() 결과. {key, kind: "line"|"queue"|"foe_line"|"foe_queue", rect, tokens, ...}
var _items: Array[Dictionary] = []
var _overflow: Array[String] = []
## 선 위 묶음에서 앞 카드 뒤에 가려진 기술.
var _tucked: Array[String] = []
## 카드마다 지금 보이는 자리. {key: {queued, from, target, t}}
var _motion: Dictionary = {}
var _art: Dictionary = {}
## 대원이 둘 이상이면 대기열 카드 아래에 대원 이름 줄을 하나 더 쓴다. 전투 시작 때 정한다.
var _named := false


func setup(run: RefCounted) -> void:
	_run = run
	name = "ConvergeTrack"
	mouse_filter = Control.MOUSE_FILTER_PASS
	_named = _run.party_sides().size() > 1
	custom_minimum_size.y = PAD * 2 + CARD.y + _label_height() + GAP + TOKEN
	_window = MIN_WINDOW
	for slot: Dictionary in _run.slots:
		_window = maxi(_window, int(slot.cooldown))
	if _run.training_enemy_acts:
		_window = maxi(_window, int(_run.enemy_ready_at))
	resized.connect(_layout)
	set_process(false)


## 매 틱 뒤 화면이 부른다. eyes는 예고를 볼 수 있는지 정하는 수녀의 눈 상태다.
func refresh(eyes: String) -> void:
	_lead = 0.0
	_eyes = eyes
	_foe = {}
	var planned: Dictionary = _run.intent()
	if not planned.is_empty():
		var text := "?"
		if eyes == "healthy":
			var card: Dictionary = _run.cards[planned.id]
			var amount: int = _run.intent_power(planned)
			text = "%s %s" % [_aim_text(planned.id, planned.get("side", "enemy"), planned.targets),
				str(amount) if card.type == "attack" else "+%d" % amount]
		_foe = {"id": planned.id, "left": maxi(0, int(_run.enemy_ready_at) - int(_run.elapsed)), "label": text}
	var order: Array = _run.firing_order()
	var allies: Array = _run.party_sides()
	_tokens.clear()
	for slot: Dictionary in _run.slots:
		# 쓰러지거나 떠난 대원의 기술은 다시 발동하지 않으므로 선에서 뺀다.
		if slot.side not in allies:
			continue
		var card: Dictionary = _run.cards[slot.id]
		var pinned: bool = slot.id == _active
		var left := 0 if pinned else maxi(0, int(slot.readyAt) - int(_run.elapsed))
		var issue: String = _run.skill_issue(slot.id, slot.side)
		var state := "charging"
		if not issue.is_empty():
			state = "blocked"
		elif not pinned and not _run.skill_conditions_met(slot.id, slot.side):
			state = "waiting"
		var label: String = card.name
		if state == "blocked":
			label = issue
		elif state == "waiting":
			label = "회복 대기" if card.target == "heal" else "조건 대기"
		# 적보다 먼저 또는 같은 틱에 발동하면 아군이 먼저다. 막는지는 규칙이 판단한다.
		var guards: bool = state == "charging" and not pinned and card.type == "defense" and eyes == "healthy" \
			and not _foe.is_empty() and int(slot.readyAt) <= int(_run.enemy_ready_at) and _run.guard_blocks(slot.id, slot.side)
		_tokens.append({"id": slot.id, "side": slot.side, "left": left, "order": order.find(slot.id),
			"symbol": FieldUI.card_symbol(card), "state": state, "label": label, "name": card.name, "guards": guards})
	var summary := _summary()
	if summary != accessibility_name:
		accessibility_name = summary
	_layout()


## 다음 틱까지 쌓인 시간(ms). 100ms 틱 사이에서도 토큰이 부드럽게 움직인다.
func set_lead(ms: float) -> void:
	if not is_equal_approx(ms, _lead):
		_lead = ms
		_layout()


## 지금 발동 연출 중인 아군 기술. 빈 문자열이면 연출이 끝난 것이라 실제 상태로 다시 읽는다.
## 연출 중에는 화면이 다시 갱신돼도 그 카드를 대기열 맨 앞에 붙잡아 둔다.
func set_active(id: String) -> void:
	var was := _active
	_active = id
	if id.is_empty():
		_foe_cast = {}
		if not was.is_empty() and _run.phase == "combat":
			refresh(_eyes)
		return
	# 적 행동 도중 아군 반격이 끼어들면 강조는 그 아군 카드 하나에만 둔다.
	_foe_cast = {}
	for token: Dictionary in _tokens:
		if token.id == id:
			token.left = 0
			token.state = "charging"
			token.guards = false
	_layout()


## 적 행동 연출이 시작될 때 그 이벤트를 받는다. 규칙은 이미 다음 예고로 넘어갔으므로 이벤트에서 카드를 만든다.
func cast_enemy(event: Dictionary) -> void:
	_active = ENEMY
	var result := ""
	match event.get("type", ""):
		"hit":
			var parts: PackedStringArray = []
			if int(event.get("dealt", 0)) > 0:
				parts.append("피해 %d" % int(event.dealt))
			if int(event.get("blocked", 0)) > 0:
				parts.append("막음 %d" % int(event.blocked))
			result = " ".join(parts) if not parts.is_empty() else "피해 0"
		"guard": result = "가드 +%d" % int(event.get("added", 0))
		"heal": result = "회복 +%d" % int(event.get("recovered", 0))
	# 결과는 전장에 숫자가 뜨는 접촉 순간(show_cast_result)에 보인다. 그 전에는 행동 이름만 보인다.
	_foe_cast = {"id": event.card, "label": _aim_text(event.card, event.get("side", "enemy"), event.get("targets", [])),
		"result": "발동", "pending": result}
	_layout()


## 적 행동이 대상에 닿았을 때 화면이 부른다.
func show_cast_result() -> void:
	if not _foe_cast.is_empty():
		_foe_cast.result = _foe_cast.pending
		queue_redraw()


## 남은 시간(ms) 기준의 선 위 x 위치. 0이면 중앙 발동선이다.
func token_x(left: float, enemy: bool) -> float:
	var center := size.x * 0.5
	var half := maxf(0.0, center - END)
	var fraction := clampf(left / _window, 0.0, 1.0)
	return center + (half if enemy else -half) * fraction


## 대기열에 오르는 남은 시간(ms).
func lift_window() -> int:
	return QUEUE_MS * clampi(speed, 1, 2)


## 대기열의 아군 카드. 발동 중인 카드가 맨 앞, 그다음 규칙의 발동 순서, 조건을 기다리는 카드는 뒤에 선다.
func queue() -> Array[Dictionary]:
	var ready: Array[Dictionary] = []
	var waiting: Array[Dictionary] = []
	for token: Dictionary in _tokens:
		if token.id == _active or (token.state == "charging" and _left(token) <= lift_window()):
			ready.append(token)
		elif token.state == "waiting" and _left(token) <= lift_window():
			waiting.append(token)
	ready.sort_custom(_in_order)
	waiting.sort_custom(_in_order)
	return ready + waiting


## 다음에 실제로 발동할 아군 기술. 조건을 만족한 카드 가운데 규칙의 발동 순서가 가장 앞선 것이다.
func next_ally() -> String:
	var best: Dictionary = {}
	for token: Dictionary in _tokens:
		if token.state == "charging" and (best.is_empty() or token.order < best.order):
			best = token
	return "" if best.is_empty() else best.id


func foe_queued() -> bool:
	return not _foe_cast.is_empty() or (not _foe.is_empty() and _foe.left - _lead <= lift_window())


## 키(기술 ID 또는 ENEMY)의 지금 보이는 자리. 그려지지 않으면 빈 사각형.
func placed(key: String) -> Rect2:
	return _shown(_motion[key]) if _motion.has(key) else Rect2()


func moving() -> bool:
	return _motion.values().any(func(state): return state.t < 1.0)


## 옮겨 가는 카드를 모두 도착 위치에 둔다.
func settle() -> void:
	for state: Dictionary in _motion.values():
		state.t = 1.0
	set_process(false)
	queue_redraw()


func _process(delta: float) -> void:
	var still := false
	for state: Dictionary in _motion.values():
		if state.t < 1.0:
			state.t = minf(1.0, state.t + delta * speed / LIFT_TIME)
			still = still or state.t < 1.0
	queue_redraw()
	if not still:
		set_process(false)


func _in_order(a: Dictionary, b: Dictionary) -> bool:
	if (a.id == _active) != (b.id == _active):
		return a.id == _active
	return a.order < b.order


func _left(token: Dictionary) -> float:
	if token.state == "blocked":
		return _window
	return maxf(0.0, token.left - _lead)


func _line_y() -> float:
	return size.y - PAD - TOKEN * 0.5


func _link_y() -> float:
	return PAD + CARD.y + _label_height() + GAP * 0.5


func _label_height() -> float:
	return CARD_LABEL * (2 if _named else 1)


## 배치 계산. 선 위 토큰은 가까운 것끼리 한 덩어리로 묶고, 대기열은 슬롯에 놓는다.
func _layout() -> void:
	_items.clear()
	_overflow.clear()
	_tucked.clear()
	if _run == null or size.x <= 0.0:
		queue_redraw()
		return
	var center := size.x * 0.5
	var line_y := _line_y()
	var lifted := queue()
	var lifted_ids := lifted.map(func(token): return token.id)
	var on_line := _tokens.filter(func(token): return token.id not in lifted_ids)
	on_line.sort_custom(func(a, b): return _left(a) < _left(b) or (_left(a) == _left(b) and a.order < b.order))
	# 묶음의 앞 카드는 막기 예고가 붙은 방어 카드를 우선한다. 묶음 위치는 그대로 가장 가까운 카드의 시간이다.
	var clusters: Array = []
	for token: Dictionary in on_line:
		var x := token_x(_left(token), false)
		if not clusters.is_empty() and absf(x - clusters.back().x) < TOKEN + 2:
			clusters.back().tokens.append(token)
		else:
			clusters.append({"x": x, "tokens": [token]})
	for cluster: Dictionary in clusters:
		var linked: Array = cluster.tokens.filter(func(token): return token.guards)
		if not linked.is_empty() and not cluster.tokens[0].guards:
			cluster.tokens.erase(linked[0])
			cluster.tokens.push_front(linked[0])
		var rect := Rect2(Vector2(cluster.x, line_y) - Vector2(TOKEN, TOKEN) * 0.5, Vector2(TOKEN, TOKEN))
		for token: Dictionary in cluster.tokens:
			_ease_to(token.id, rect, false)
			if token != cluster.tokens[0]:
				_tucked.append(token.id)
		_items.append({"key": cluster.tokens[0].id, "kind": "line", "tokens": cluster.tokens})
	for index in lifted.size():
		var slot := mini(index, QUEUE_SIZE - 1)
		var rect := Rect2(Vector2(center - MIDDLE - (slot + 1) * CARD.x - slot * SLOT_GAP, PAD), CARD)
		_ease_to(lifted[index].id, rect, true)
		if index < QUEUE_SIZE:
			_items.append({"key": lifted[index].id, "kind": "queue", "tokens": [lifted[index]]})
		else:
			_overflow.append(lifted[index].id)
	if foe_queued():
		_ease_to(ENEMY, Rect2(Vector2(center + MIDDLE, PAD), CARD), true)
		_items.append({"key": ENEMY, "kind": "foe_queue"})
	elif not _foe.is_empty():
		var x := token_x(_foe.left - _lead, true)
		_ease_to(ENEMY, Rect2(Vector2(x, line_y) - Vector2(TOKEN, TOKEN) * 0.5, Vector2(TOKEN, TOKEN)), false)
		_items.append({"key": ENEMY, "kind": "foe_line"})
	queue_redraw()


## 선과 대기열을 오갈 때만 옮겨 가는 움직임을 시작한다. 선 위 이동은 남은 시간을 그대로 따른다.
func _ease_to(key: String, target: Rect2, queued: bool) -> void:
	if not _motion.has(key):
		_motion[key] = {"queued": queued, "from": target, "target": target, "t": 1.0}
		return
	var state: Dictionary = _motion[key]
	if state.queued != queued:
		state.from = _shown(state)
		state.queued = queued
		state.t = 0.0
		set_process(true)
	state.target = target


func _shown(state: Dictionary) -> Rect2:
	if state.t >= 1.0:
		return state.target
	var weight := 1.0 - pow(1.0 - state.t, 3.0)
	return Rect2(state.from.position.lerp(state.target.position, weight), state.from.size.lerp(state.target.size, weight))


## 글과 연결선은 카드가 옮겨 가는 동안 서서히 나타난다.
func _settled(key: String) -> float:
	return clampf(_motion[key].t * 1.6, 0.0, 1.0) if _motion.has(key) else 1.0


func _draw() -> void:
	if _run == null:
		return
	var font := FieldUI.BODY_FONT
	var center := size.x * 0.5
	var line_y := _line_y()
	draw_rect(Rect2(Vector2.ZERO, size), Color("#141214d0"))
	for enemy: bool in [false, true]:
		var edge := token_x(lift_window(), enemy)
		draw_line(Vector2(edge, line_y - 7), Vector2(edge, line_y + 7), Color(FieldUI.BRASS, 0.6), 1.5)
	draw_line(Vector2(END, line_y), Vector2(center, line_y), Color(FieldUI.ALLY, 0.35), 1.0)
	draw_line(Vector2(center, line_y), Vector2(size.x - END, line_y), Color(FieldUI.DANGER, 0.35), 1.0)
	for second in range(1, int(_window / 1000.0) + 1):
		for enemy: bool in [false, true]:
			var x := token_x(second * 1000, enemy)
			draw_line(Vector2(x, size.y - 3), Vector2(x, size.y - 1), Color(FieldUI.MUTED, 0.4), 1.0)
	draw_line(Vector2(center, PAD), Vector2(center, size.y - 1), FieldUI.BRASS, 2.0)
	var lines := _items.filter(func(item): return item.kind == "line")
	lines.reverse()
	for item: Dictionary in lines + _items.filter(func(item): return item.kind != "line"):
		match item.kind:
			"line": _draw_cluster(font, item.tokens)
			"queue": _draw_queued(font, item.tokens[0])
			"foe_line": _draw_foe_token(font)
			"foe_queue": _draw_foe_card(font)
	if not _overflow.is_empty():
		var right := center - MIDDLE - QUEUE_SIZE * (CARD.x + SLOT_GAP)
		draw_string(font, Vector2(right - 30, PAD + CARD.y * 0.5 + FONT_SIZE * 0.4), "+%d" % _overflow.size(),
			HORIZONTAL_ALIGNMENT_RIGHT, 26, FONT_SIZE, FieldUI.MUTED)
	_draw_guard_links()


func _draw_cluster(font: Font, members: Array) -> void:
	var token: Dictionary = members[0]
	var rect := placed(token.id)
	_draw_card(rect, token.id, token.side, _ink(token), token.state, false)
	if members.size() > 1:
		var text := "×%d" % members.size()
		var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x + 4
		var badge := Rect2(Vector2(rect.end.x + 1, rect.get_center().y - (FONT_SIZE + 2) * 0.5), Vector2(width, FONT_SIZE + 2))
		draw_rect(badge, FieldUI.BLACK)
		draw_string(font, Vector2(badge.position.x + 2, badge.end.y - 3), text, HORIZONTAL_ALIGNMENT_LEFT, -1,
			FONT_SIZE, FieldUI.TEXT)


func _draw_queued(font: Font, token: Dictionary) -> void:
	var rect := placed(token.id)
	var active: bool = token.id == _active
	_draw_card(rect, token.id, token.side, _ink(token), token.state, active)
	var alpha := _settled(token.id)
	if alpha <= 0.0:
		return
	# 대기열 안에서도 남은 시간을 보여 줘서 적 카드의 시간과 비교할 수 있게 한다.
	var time := "발동" if active else "%.1f" % (_left(token) / 1000.0) if token.state == "charging" else ""
	if not time.is_empty():
		var width := font.get_string_size(time, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x + 6
		var box := Rect2(Vector2(rect.end.x - width, rect.end.y - FONT_SIZE - 2), Vector2(width, FONT_SIZE + 2))
		draw_rect(box, Color(FieldUI.BLACK, 0.85 * alpha))
		draw_string(font, Vector2(box.position.x + 3, box.end.y - 3), time, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE,
			Color(FieldUI.BRASS if active else FieldUI.TEXT, alpha))
	var tint := FieldUI.BRASS if active else FieldUI.TEXT if token.state == "charging" else FieldUI.MUTED
	var baseline := rect.end.y + FONT_SIZE + 1
	# 대원이 여럿이면 윗줄에 누구의 기술인지 쓴다. 작은 얼굴보다 글자가 잘 읽힌다.
	if _named:
		draw_string(font, Vector2(rect.position.x - SLOT_GAP * 0.5, baseline), _short(_run.get(token.side).name),
			HORIZONTAL_ALIGNMENT_CENTER, CARD.x + SLOT_GAP, FONT_SIZE, Color(FieldUI.MUTED, alpha))
		baseline += CARD_LABEL
	draw_string(font, Vector2(rect.position.x - SLOT_GAP * 0.5, baseline), token.label,
		HORIZONTAL_ALIGNMENT_CENTER, CARD.x + SLOT_GAP, FONT_SIZE, Color(tint, alpha))


func _draw_foe_token(font: Font) -> void:
	var rect := placed(ENEMY)
	_draw_card(rect, _foe.id, "enemy", FieldUI.DANGER, "charging", false)
	var alpha := _settled(ENEMY)
	var room := size.x - END - rect.end.x - 5
	if alpha > 0.0 and room > 0.0:
		# 선이 글자를 지나가지 않도록 어두운 바탕을 깐다.
		var width := minf(room, font.get_string_size(_foe.label, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x)
		var y := rect.get_center().y
		draw_rect(Rect2(rect.end.x + 3, y - FONT_SIZE * 0.7, width + 4, FONT_SIZE * 1.4), Color(FieldUI.BLACK, 0.9 * alpha))
		draw_string(font, Vector2(rect.end.x + 5, y + FONT_SIZE * 0.4), _foe.label,
			HORIZONTAL_ALIGNMENT_LEFT, room, FONT_SIZE, Color(FieldUI.DANGER, alpha))


func _draw_foe_card(font: Font) -> void:
	var rect := placed(ENEMY)
	var casting := not _foe_cast.is_empty()
	var shown: Dictionary = _foe_cast if casting else _foe
	_draw_card(rect, shown.id, "enemy", FieldUI.DANGER, "charging", casting)
	var alpha := _settled(ENEMY)
	if alpha <= 0.0:
		return
	var room := maxf(0.0, size.x - END - rect.end.x - 6)
	draw_string(font, Vector2(rect.end.x + 6, rect.position.y + FONT_SIZE + 2), shown.label,
		HORIZONTAL_ALIGNMENT_LEFT, room, FONT_SIZE, Color(FieldUI.DANGER, alpha))
	var detail: String = shown.result if casting else "%.1f초" % (maxf(0.0, _foe.left - _lead) / 1000.0)
	draw_string(font, Vector2(rect.end.x + 6, rect.end.y - 2), detail, HORIZONTAL_ALIGNMENT_LEFT, room, FONT_SIZE,
		Color(FieldUI.BRASS if casting else FieldUI.MUTED, alpha))


## 막기 예고: 적 공격보다 먼저 그 부위의 피해를 막을 방어 카드와 적 카드를 점선으로 잇고, 발동선 위에 방패를 단다.
## 연결선은 대기열 이름 줄과 선 사이의 빈 줄로만 지나가서 다른 카드를 가로지르지 않는다.
func _draw_guard_links() -> void:
	if not _foe_cast.is_empty() or not _motion.has(ENEMY) or _foe.is_empty():
		return
	var foe := placed(ENEMY)
	var lane := _link_y()
	var center := size.x * 0.5
	for token: Dictionary in _tokens:
		if not token.guards or not _motion.has(token.id) or token.id in _overflow or token.id in _tucked:
			continue
		var alpha := minf(_settled(token.id), _settled(ENEMY))
		var own := placed(token.id)
		if alpha <= 0.0 or own.size.x == 0.0:
			continue
		var ink := Color(FieldUI.ALLY, alpha)
		var start := Vector2(own.get_center().x, own.position.y) if own.size.x == TOKEN else Vector2(own.get_center().x, lane)
		var finish := Vector2(foe.get_center().x, foe.position.y) if foe.size.x == TOKEN else Vector2(foe.get_center().x, lane)
		var points := PackedVector2Array([start, Vector2(start.x, lane), Vector2(finish.x, lane), finish])
		for i in points.size() - 1:
			if points[i] != points[i + 1]:
				draw_dashed_line(points[i], points[i + 1], ink, 1.2, 3.0, true)
		var shield := Rect2(Vector2(center - 7, lane - 7), Vector2(14, 14))
		draw_rect(shield, Color(FieldUI.BLACK, alpha))
		_draw_glyph(shield, "defense", ink)
		var mark := 10.0
		var corner := Rect2(Vector2(own.end.x - mark - 1, own.position.y + 1), Vector2(mark, mark))
		draw_rect(corner, Color(FieldUI.BLACK, alpha))
		_draw_glyph(corner, "defense", ink)


## 카드 원화를 잘라 그린다. 정사각에 가까우면 선 위 토큰처럼 자른다.
func _draw_card(rect: Rect2, id: String, side: String, ink: Color, state: String, active: bool) -> void:
	if rect.size.x <= 0.0:
		return
	var compact := rect.size.x < rect.size.y * 1.3
	var shown := rect.grow(2.0) if active else rect
	draw_rect(shown, FieldUI.IRON)
	var texture := _card_art(id)
	var hidden := side == "enemy" and _eyes != "healthy" and not (active and not _foe_cast.is_empty())
	if texture and not hidden:
		var size_px := texture.get_size()
		var region: Rect2
		if compact:
			var square := size_px.y * 0.72
			region = Rect2(Vector2((size_px.x - square) * 0.5, size_px.y * 0.14), Vector2(square, square))
		else:
			var width := size_px.x * 0.86
			var height := minf(size_px.y, width * shown.size.y / shown.size.x)
			region = Rect2(Vector2((size_px.x - width) * 0.5, (size_px.y - height) * 0.5), Vector2(width, height))
		var tone := Color(0.5, 0.5, 0.5, 0.6) if state == "blocked" else Color.WHITE
		draw_texture_rect_region(texture, shown, region, tone)
	elif hidden:
		var extent := shown.size.y * 0.7
		_draw_glyph(Rect2(shown.get_center() - Vector2(extent, extent) * 0.5, Vector2(extent, extent)), "mystery", FieldUI.DANGER)
	var rim := FieldUI.BRASS if active else ink
	if state == "waiting":
		var corners := [shown.position, Vector2(shown.end.x, shown.position.y), shown.end, Vector2(shown.position.x, shown.end.y)]
		for i in 4:
			draw_dashed_line(corners[i], corners[(i + 1) % 4], rim, 1.5, 3.0, true)
	else:
		draw_rect(shown, rim, false, 2.0 if active else 1.5)
	if state == "blocked":
		draw_line(shown.position + Vector2(3, 3), shown.end - Vector2(3, 3), FieldUI.MUTED, 1.5, true)
		draw_line(Vector2(shown.end.x - 3, shown.position.y + 3), Vector2(shown.position.x + 3, shown.end.y - 3),
			FieldUI.MUTED, 1.5, true)



func _draw_glyph(rect: Rect2, symbol: String, ink: Color) -> void:
	var unit := minf(rect.size.x, rect.size.y) / 24.0
	for stroke: Array in Glyph.STROKES.get(symbol, Glyph.STROKES.seal):
		var points := PackedVector2Array()
		for i in range(0, stroke.size(), 2):
			points.append(rect.position + Vector2(stroke[i], stroke[i + 1]) * unit)
		draw_polyline(points, ink, maxf(1.0, 1.6 * unit), true)


func _ink(token: Dictionary) -> Color:
	if token.state == "blocked":
		return Color(FieldUI.MUTED, 0.6)
	return FieldUI.CARD_TYPES[token.symbol][1]


## "강타 → 수녀 다리"처럼 카드와 받는 대원·부위. 대원이 하나면 대원 이름은 뺀다.
func _aim_text(id: String, side: String, targets: Array) -> String:
	var parts: PackedStringArray = []
	for part: String in targets:
		parts.append(_run.data.parts[part])
	var recipient := ""
	if side != "enemy" and _run.party_sides().size() > 1 and _run.get(side) is Dictionary:
		recipient = _short(_run.get(side).name) + " "
	return "%s → %s%s" % [_run.cards[id].name, recipient, ", ".join(parts)]


## 기술 칸과 같은 원화를 쓴다. 구운 카드 면이 있으면 그것을, 없으면 카드의 원본 원화를 쓴다.
func _card_art(id: String) -> Texture2D:
	if not _art.has(id):
		var face_path: String = FieldUI.CARD_UI + id + ".webp"
		var path: String = face_path if ResourceLoader.exists(face_path) else "res://" + str(_run.cards[id].get("art", ""))
		_art[id] = load(path) if ResourceLoader.exists(path) else null
	return _art[id]


func _get_tooltip(at_position: Vector2) -> String:
	for item: Dictionary in _items:
		if not placed(item.key).grow(2.0).has_point(at_position):
			continue
		if item.key == ENEMY:
			if not _foe_cast.is_empty():
				return "%s  %s  %s" % [_run.enemy.name, _foe_cast.label, _foe_cast.result]
			return "%s  %s  %.1f초" % [_run.enemy.name, _foe.label, _foe.left / 1000.0]
		var lines: PackedStringArray = []
		for token: Dictionary in item.tokens:
			var guard := "  · 적 공격보다 먼저 그 부위를 막음" if token.guards else ""
			lines.append("%s · %s  %s%s" % [_run.get(token.side).name, token.name, _describe(token), guard])
		return "\n".join(lines)
	return ""


func _describe(token: Dictionary) -> String:
	if token.state != "charging":
		return token.label
	return "준비 완료" if token.left == 0 else "%.1f초" % (token.left / 1000.0)


## 수렴선 글에는 이름의 마지막 낱말만 쓴다. 탈옥한 주술사 → 주술사.
static func _short(full: String) -> String:
	var words := full.split(" ", false)
	return full if words.is_empty() else words[words.size() - 1]


## 화면 낭독용 요약. 매 틱 바뀌지 않도록 시간은 넣지 않는다.
func _summary() -> String:
	var parts: PackedStringArray = []
	var next := next_ally()
	if not next.is_empty():
		parts.append("다음 아군 기술 " + _run.cards[next].name)
	if not _foe.is_empty():
		parts.append("적 다음 행동 " + _foe.label)
	return ", ".join(parts)
