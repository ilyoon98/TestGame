extends Control

const LOSS_DELAY := 1.0
const LOSS_DURATION := 0.55
const FLASH_INK := Color("#fff9ed")

var value := 0.0
var trail := 0.0
var _maximum := 1.0
var _ink := Color.WHITE
var _lag_left := 0.0
var _from := 0.0


func setup(maximum: float, health: float, ink: Color) -> void:
	_maximum = maxf(maximum, 1.0)
	_ink = ink
	value = clampf(health, 0.0, _maximum)
	trail = value
	_from = value
	custom_minimum_size.y = 12
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func set_health(health: float) -> void:
	var next := clampf(health, 0.0, _maximum)
	if next == value:
		return
	if next < value:
		_from = trail
		_lag_left = LOSS_DELAY + LOSS_DURATION
	else:
		trail = next
		_lag_left = 0.0
	value = next
	queue_redraw()


func remaining_loss() -> float:
	return _lag_left


func advance(delta: float) -> void:
	if _lag_left <= 0.0:
		return
	_lag_left = maxf(0.0, _lag_left - delta)
	var progress := 1.0 - minf(_lag_left / LOSS_DURATION, 1.0)
	var next := lerpf(_from, value, smoothstep(0.0, 1.0, progress))
	if next != trail:
		trail = next
		queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#543d36"))
	var bed := Rect2(Vector2(2, 2), (size - Vector2(4, 4)).max(Vector2.ZERO))
	draw_rect(bed, Color("#100e11"))
	_draw_fill(bed, trail, FLASH_INK)
	_draw_fill(bed, value, _ink)


func _draw_fill(bed: Rect2, amount: float, ink: Color) -> void:
	var width := bed.size.x * amount / _maximum
	if width > 0.0:
		draw_rect(Rect2(bed.position, Vector2(width, bed.size.y)), ink)
