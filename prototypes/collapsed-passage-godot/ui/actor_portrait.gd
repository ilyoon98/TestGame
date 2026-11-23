extends Control

var pose := "idle"
var sprite_path := ""
var _actor_visual: Dictionary
var _wound_art: Dictionary
var _conditions: Dictionary = {}
var _shown_anchors: Dictionary
var _textures: Dictionary = {}
var _sprite: Texture2D


func setup(visual: Dictionary, wounds: Dictionary) -> void:
	_actor_visual = visual
	_wound_art = wounds
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)
	_update_frame()


func set_conditions(conditions: Dictionary) -> void:
	if conditions == _conditions:
		return
	_conditions = conditions
	_update_frame()


func show_pose(value: String) -> void:
	if value == "idle" or _actor_visual.poses.has(value):
		pose = value
		_update_frame()


func anchor_at(part: String) -> Vector2:
	var point: Array = _shown_anchors[part]
	return point_at(Vector2(point[0], point[1]) / 100.0)


func point_at(fraction: Vector2) -> Vector2:
	var frame := _sprite_rect()
	return get_global_rect().position + frame.position + frame.size * fraction


func _update_frame() -> void:
	var arms_lost: bool = _conditions.get("arms") == "lost"
	var legs_lost: bool = _conditions.get("legs") == "lost"
	var default_path: String = _actor_visual.idle if pose == "idle" else _actor_visual.poses[pose]
	sprite_path = _actor_visual.armLoss.get(pose, default_path) if arms_lost else default_path
	_shown_anchors = _actor_visual.anchors.get(pose, _actor_visual.anchors.idle)
	if legs_lost and pose != "defeat":
		var variants: Dictionary = _actor_visual.kneeling.get("armsAndLegs" if arms_lost else "legsOnly", {})
		var pose_name := "attack" if pose == "release" else "idle" if pose == "heal" else pose
		var variant: Dictionary = variants.get(pose_name, variants.get("idle", {}))
		if not variant.is_empty():
			sprite_path = variant.src
			_shown_anchors = variant.anchors
	_sprite = _texture(sprite_path)
	queue_redraw()


func _sprite_rect() -> Rect2:
	var raw := _sprite.get_size()
	var drawn := raw * minf(size.x / raw.x, size.y / raw.y)
	return Rect2((size - drawn) / 2.0, drawn)


func _texture(path: String) -> Texture2D:
	if not _textures.has(path):
		_textures[path] = load("res://" + path)
	return _textures[path]


func _draw() -> void:
	if _sprite == null:
		return
	var frame := _sprite_rect()
	draw_texture_rect(_sprite, frame, false)
	if _wound_art.is_empty():
		return
	for part: String in _conditions:
		var level: String = _conditions[part]
		var appearance: Array = _wound_art.appearance.get(level, {}).get(part, [])
		if appearance.is_empty():
			continue
		var point: Array = _shown_anchors[part]
		var center := frame.position + frame.size * Vector2(point[0], point[1]) / 100.0
		if appearance[0] == null:
			var radius := frame.size.x * float(appearance[1]) * 0.022
			draw_line(center - Vector2(radius, radius), center + Vector2(radius, radius), Color("#e8aa90"), 1.4, true)
			draw_line(center + Vector2(-radius, radius), center + Vector2(radius, -radius), Color("#e8aa90"), 1.4, true)
			continue
		var decal := _texture(_wound_art.decals[appearance[0]])
		var decal_size := decal.get_size() * ((frame.size.x * float(appearance[1]) / 100.0) / decal.get_width())
		draw_texture_rect(decal, Rect2(center - decal_size / 2.0, decal_size), false, Color(0.86, 0.78, 0.78, 0.88))
	if _conditions.get("eyes") == "lost":
		_draw_eye_wrap(frame)


func _draw_eye_wrap(frame: Rect2) -> void:
	var fitted: Array = _wound_art.eyeWraps.get(sprite_path, [])
	if fitted.is_empty():
		return
	var center := frame.position + frame.size * Vector2(fitted[0], fitted[1]) / 100.0
	var extent := Vector2(frame.size.x * float(fitted[3]) / 100.0, frame.size.y * (0.0325 if pose == "defeat" else 0.0455))
	draw_set_transform(center, deg_to_rad(fitted[2]))
	var contour := PackedVector2Array([
		extent * Vector2(-0.50, -0.27), extent * Vector2(-0.28, -0.50), extent * Vector2(0.15, -0.44),
		extent * Vector2(0.50, -0.34), extent * Vector2(0.48, 0.36), extent * Vector2(0.16, 0.48),
		extent * Vector2(-0.28, 0.50), extent * Vector2(-0.50, 0.29),
	])
	draw_colored_polygon(contour, Color("#57434d"))
	draw_line(extent * Vector2(-0.42, -0.25), extent * Vector2(0.44, -0.18), Color("#947681"), 1.0, true)
	draw_line(extent * Vector2(-0.41, 0.18), extent * Vector2(0.39, 0.26), Color("#735966"), 1.0, true)
	draw_set_transform(Vector2.ZERO)
