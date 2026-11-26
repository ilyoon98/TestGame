extends Control
## 기술 충전과 적 행동을 한 줄에 모아 보여 주는 수렴선.
## 아군 기술은 왼쪽, 적의 다음 행동은 오른쪽에서 중앙의 발동선으로 다가온다.
## 전투 규칙은 읽기만 하고 바꾸지 않는다. 화면이 refresh()를 부를 때의 상태를 사진처럼 저장해 두므로,
## 발동 연출이 재생되는 동안에는 발동한 토큰이 중앙에 머문다.

const FieldUI := preload("res://ui/field_ui.gd")
const Glyph := preload("res://ui/field_glyph.gd")
const LANE := 20.0
const FOE_LANE := 24.0
const PAD := 4.0
const GUTTER := 46.0
const RADIUS := 8.0
## 이보다 짧은 기술만 있어도 반쪽 폭은 6초다. 더 긴 기술이 있으면 그 기술이 끝에서 출발하도록 넓힌다.
const MIN_WINDOW := 6000
const FONT_SIZE := 12
## set_active()에 넘기면 적 토큰을 강조한다.
const ENEMY := "@enemy"

var _run: RefCounted
var _sides: Array = []
var _window := MIN_WINDOW
var _lead := 0.0
var _active := ""
## 화면 갱신 시점의 토큰. {id, side, lane, left, symbol, state, label, name}
var _tokens: Array[Dictionary] = []
var _foe: Dictionary = {}


func setup(run: RefCounted, sides: Array) -> void:
	_run = run
	_sides = sides.duplicate()
	name = "ConvergeTrack"
	mouse_filter = Control.MOUSE_FILTER_PASS
	custom_minimum_size.y = PAD * 2 + LANE * _sides.size() + FOE_LANE
	_window = MIN_WINDOW
	for slot: Dictionary in _run.slots:
		_window = maxi(_window, int(slot.cooldown))
	if _run.training_enemy_acts:
		_window = maxi(_window, int(_run.enemy_ready_at))
	resized.connect(queue_redraw)


## 매 틱 뒤 화면이 부른다. eyes는 예고를 볼 수 있는지 정하는 수녀의 눈 상태다.
func refresh(eyes: String) -> void:
	_lead = 0.0
	_tokens.clear()
	for slot: Dictionary in _run.slots:
		var card: Dictionary = _run.cards[slot.id]
		var left := maxi(0, int(slot.readyAt) - int(_run.elapsed))
		var issue: String = _run.skill_issue(slot.id, slot.side)
		var state := "charging"
		if not issue.is_empty():
			state = "blocked"
		elif left == 0 and not _run.skill_conditions_met(slot.id, slot.side):
			state = "waiting"
		var label: String = card.name
		if state == "blocked":
			label = issue
		elif state == "waiting":
			label = "회복 대기" if card.target == "heal" else "조건 대기"
		_tokens.append({"id": slot.id, "side": slot.side, "lane": _sides.find(slot.side), "left": left,
			"symbol": FieldUI.card_symbol(card), "state": state, "label": label, "name": card.name})
	_foe = {}
	var planned: Dictionary = _run.intent()
	if not planned.is_empty():
		var card: Dictionary = _run.cards[planned.id]
		var text := "?"
		if eyes == "healthy":
			var amount: int = _run.intent_power(planned)
			var targets: PackedStringArray = []
			for part: String in planned.targets:
				targets.append(_run.data.parts[part])
			var recipient := ""
			if card.type == "attack" and _run.party_sides().size() > 1:
				recipient = _short(_run.get(planned.side).name) + " "
			text = "%s → %s%s %s" % [card.name, recipient, ", ".join(targets),
				str(amount) if card.type == "attack" else "+%d" % amount]
		_foe = {"left": maxi(0, int(_run.enemy_ready_at) - int(_run.elapsed)),
			"symbol": FieldUI.card_symbol(card) if eyes == "healthy" else "mystery", "label": text}
	accessibility_name = _summary()
	queue_redraw()


## 다음 틱까지 쌓인 시간(ms). 100ms 틱 사이에서도 토큰이 부드럽게 움직인다.
func set_lead(ms: float) -> void:
	if not is_equal_approx(ms, _lead):
		_lead = ms
		queue_redraw()


## 지금 발동 연출 중인 기술. 빈 문자열이면 강조를 끈다.
## 마지막 갱신은 발동 직전 틱이므로, 발동한 토큰은 중앙선에 붙여 둔다.
func set_active(id: String) -> void:
	_active = id
	if id == ENEMY and not _foe.is_empty():
		_foe.left = 0
	for token: Dictionary in _tokens:
		if token.id == id:
			token.left = 0
	queue_redraw()


## 남은 시간(ms) 기준의 토큰 x 위치. 테스트도 이 계산을 쓴다.
func token_x(left: float, enemy: bool) -> float:
	var center := size.x * 0.5
	var half := maxf(0.0, center - GUTTER)
	var fraction := clampf(left / _window, 0.0, 1.0)
	return center + (half if enemy else -half) * fraction


func _left(token: Dictionary) -> float:
	if token.get("state", "") == "blocked":
		return _window
	return maxf(0.0, token.left - _lead)


func _lane_y(lane: int) -> float:
	return PAD + LANE * (lane + 0.5)


func _foe_y() -> float:
	return PAD + LANE * _sides.size() + FOE_LANE * 0.5


func _draw() -> void:
	if _run == null:
		return
	var font := FieldUI.BODY_FONT
	var center := size.x * 0.5
	draw_rect(Rect2(Vector2.ZERO, size), Color("#141214d0"))
	var foe_y := _foe_y()
	for lane in _sides.size():
		var y := _lane_y(lane)
		draw_line(Vector2(GUTTER, y), Vector2(center, y), Color(FieldUI.ALLY, 0.28), 1.0)
		var owner := _short(_run.get(_sides[lane]).name)
		draw_string(font, Vector2(4, y + FONT_SIZE * 0.4), owner, HORIZONTAL_ALIGNMENT_LEFT, GUTTER - 8,
			FONT_SIZE, FieldUI.ALLY)
	draw_line(Vector2(center, foe_y), Vector2(size.x - GUTTER, foe_y), Color(FieldUI.DANGER, 0.32), 1.0)
	draw_string(font, Vector2(size.x - GUTTER + 6, foe_y + FONT_SIZE * 0.4), _short(_run.enemy.name),
		HORIZONTAL_ALIGNMENT_LEFT, GUTTER - 8, FONT_SIZE, FieldUI.DANGER)
	# 1초 눈금. 중앙에서 멀수록 남은 시간이 길다.
	for second in range(1, int(_window / 1000.0) + 1):
		for enemy: bool in [false, true]:
			var x := token_x(second * 1000, enemy)
			draw_line(Vector2(x, size.y - 4), Vector2(x, size.y - 1), Color(FieldUI.MUTED, 0.35), 1.0)
	draw_line(Vector2(center, 1), Vector2(center, size.y - 1), FieldUI.BRASS, 2.0)
	_draw_lanes(font)
	if not _foe.is_empty():
		var x := token_x(maxf(0.0, _foe.left - _lead), true)
		_draw_token(Vector2(x, foe_y), _foe.symbol, FieldUI.DANGER, _active == ENEMY, false)
		draw_string(font, Vector2(x + RADIUS + 5, foe_y + FONT_SIZE * 0.4), _foe.label,
			HORIZONTAL_ALIGNMENT_LEFT, maxf(0.0, size.x - GUTTER - x - RADIUS - 8), FONT_SIZE, FieldUI.DANGER)


func _draw_lanes(font: Font) -> void:
	for lane in _sides.size():
		var y := _lane_y(lane)
		var members := _tokens.filter(func(token): return token.lane == lane)
		# 먼 토큰부터 그려서 곧 발동할 토큰이 위에 보이게 한다.
		members.sort_custom(func(a, b): return _left(a) > _left(b))
		var lead: Dictionary = {}
		for token: Dictionary in members:
			if token.state != "blocked" and (lead.is_empty() or _left(token) <= _left(lead)):
				lead = token
		if lead.is_empty() and not members.is_empty():
			lead = members.back()
		for token: Dictionary in members:
			var ink: Color = FieldUI.CARD_TYPES[token.symbol][1]
			if token.state == "blocked":
				ink = Color(FieldUI.MUTED, 0.5)
			_draw_token(Vector2(_token_x(token), y), token.symbol, ink, token.id == _active, token.state == "waiting")
		if not lead.is_empty():
			_draw_label(font, lead, y)


## 이름표는 곧 발동할 토큰에만 단다. 중앙선 쪽이 비어 있으면 그쪽에, 아니면 바깥쪽에 둔다.
func _draw_label(font: Font, token: Dictionary, y: float) -> void:
	var x := _token_x(token)
	var width := font.get_string_size(token.label, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
	var start := x + RADIUS + 5
	if size.x * 0.5 - start - 4 < width:
		start = maxf(GUTTER, x - RADIUS - 5 - width)
	var tint := FieldUI.BRASS if token.id == _active else FieldUI.TEXT
	if token.state == "blocked":
		tint = FieldUI.MUTED
	draw_rect(Rect2(start - 3, y - FONT_SIZE * 0.65, width + 6, FONT_SIZE * 1.3), Color(FieldUI.BLACK, 0.85))
	draw_string(font, Vector2(start, y + FONT_SIZE * 0.4), token.label, HORIZONTAL_ALIGNMENT_LEFT, -1,
		FONT_SIZE, tint)


## 충전을 마치고 조건을 기다리는 기술은 발동선 바로 앞에 세워 둔다.
func _token_x(token: Dictionary) -> float:
	var x := token_x(_left(token), false)
	return x - RADIUS - 3.0 if token.state == "waiting" else x


## 수렴선 칸에는 이름의 마지막 낱말만 쓴다. 탈옥한 주술사 → 주술사.
static func _short(full: String) -> String:
	var words := full.split(" ", false)
	return full if words.is_empty() else words[words.size() - 1]

func _draw_token(at: Vector2, symbol: String, ink: Color, active: bool, waiting: bool) -> void:
	var radius := RADIUS + (2.0 if active else 0.0)
	draw_circle(at, radius, FieldUI.IRON)
	var rim := FieldUI.BRASS if active else ink
	if waiting:
		# 충전은 끝났지만 조건을 기다리는 기술은 끊긴 테두리로 구분한다.
		for i in 8:
			var from := TAU * i / 8.0
			draw_arc(at, radius, from, from + TAU / 16.0, 4, rim, 1.6, true)
	else:
		draw_arc(at, radius, 0.0, TAU, 24, rim, 2.0 if active else 1.5, true)
	var unit := radius * 1.2 / 24.0
	var origin := at - Vector2(12, 12) * unit
	for stroke: Array in Glyph.STROKES.get(symbol, Glyph.STROKES.seal):
		var points := PackedVector2Array()
		for i in range(0, stroke.size(), 2):
			points.append(origin + Vector2(stroke[i], stroke[i + 1]) * unit)
		draw_polyline(points, ink, 1.2, true)


func _get_tooltip(at_position: Vector2) -> String:
	var best := ""
	var nearest := RADIUS + 4.0
	for token: Dictionary in _tokens:
		var point := Vector2(_token_x(token), _lane_y(token.lane))
		if point.distance_to(at_position) < nearest:
			nearest = point.distance_to(at_position)
			best = "%s  %s" % [token.name, _describe(token)]
	if not _foe.is_empty():
		var point := Vector2(token_x(maxf(0.0, _foe.left - _lead), true), _foe_y())
		if point.distance_to(at_position) < nearest:
			best = "%s  %s  %.1f초" % [_run.enemy.name, _foe.label, _foe.left / 1000.0]
	return best


func _describe(token: Dictionary) -> String:
	if token.state != "charging":
		return token.label
	return "준비 완료" if token.left == 0 else "%.1f초" % (token.left / 1000.0)


func _summary() -> String:
	var next: Dictionary = {}
	for token: Dictionary in _tokens:
		if token.state == "charging" and (next.is_empty() or token.left < next.left):
			next = token
	var parts: PackedStringArray = []
	if not next.is_empty():
		parts.append("다음 아군 기술 %s %.1f초" % [next.name, next.left / 1000.0])
	if not _foe.is_empty():
		parts.append("적 %s %.1f초" % [_foe.label, _foe.left / 1000.0])
	return ", ".join(parts)
