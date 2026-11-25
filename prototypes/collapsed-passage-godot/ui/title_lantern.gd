extends Control
## Title backdrop: a 3D lantern on a wooden crate in total darkness.
## The candle leans toward the cursor and its light really falls on the crate.
## A gust snuffs it when a run starts, and the pursuer's eyes open in the dark,
## then close as the upper lid comes down.

signal snuffed

const FlameShader := preload("res://ui/title_flame.gdshader")
const HaloShader := preload("res://ui/title_halo.gdshader")
const WoodShader := preload("res://ui/title_wood.gdshader")
const StoneShader := preload("res://ui/title_stone.gdshader")

const VOID := Color("#040305")
const GLOW := Color("#ff9440")
const EMBER := Color("#ff5f1a")
const EYE := Color("#f2e3b0")
const EYE_HALO := Color("#9c1d18")

## Crate size in metres (width, height, depth); the lantern stands on its lid.
const CRATE := Vector3(0.82, 0.5, 0.58)
const LID := 0.02
const STAND := CRATE.y + LID
const CANDLE_TOP := STAND + 0.108
const WICK := Vector3(0, CANDLE_TOP + 0.008, 0)
## Sized so even a fully bent or stretched flame stays inside the hexagonal glass (inner half width 0.076, top 0.09 above the wick).
const FLAME_SIZE := Vector2(0.11, 0.085)
const EYE_LEVEL := Vector3(0, 0.05, 0)
## Where the lantern lands across the screen, leaving the left side for the menu.
const SCREEN_X := 0.64
const CAMERA_AT := Vector3(0, 1.05, 2.6)
const CAMERA_TARGET := Vector3(0, 0.5, 0)

const GUST_TIME := 0.42
const DARK_PAUSE := 0.38
const EYE_OPEN_TIME := 0.42
const EYE_HOLD_TIME := 0.62
const EYE_CLOSE_TIME := 0.3
const IDLE_EYE_HOLD := 1.15

static var _glow_texture: GradientTexture2D
static var _snuff_stream: AudioStreamWAV

var _time := 0.0
var _noise := FastNoiseLite.new()
var _rng := RandomNumberGenerator.new()
var _brightness := 1.0
var _light_level := 1.0
var _flame_scale := 1.0
var _lean := Vector2.ZERO
var _lean_speed := Vector2.ZERO
var _agitation := 0.0
## Set to 1 when the cursor touches a menu button; the flame gutters as it decays.
var _startle := 0.0
var _last_mouse := Vector2.INF
var _mouse_speed := Vector2.ZERO
var _ember := 0.0
var _smoke: Array = []
var _snuffing := false
var _snuff_time := 0.0
var _finished := false
var _eye_open := 0.0
var _eye_offset := Vector2(-200, -60)
var _eye_size := 1.0
var _eye_strength := 0.5
var _eye_clock := 0.0
var _eye_wait := 4.0
var _eye_active := false

var _camera: Camera3D
var _light: OmniLight3D
var _bounce: OmniLight3D
var _wax: StandardMaterial3D
var _stone: ShaderMaterial
var _floor_screen := Vector2.ZERO
var _flame_material: ShaderMaterial
var _halo_material: ShaderMaterial
var _overlay: Control
var _flame_screen := Vector2.ZERO
var _wick_screen := Vector2.ZERO


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	accessibility_name = "어둠 속 나무 상자 위에서 등불이 흔들린다."
	_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_noise.frequency = 1.0
	_noise.seed = 911
	_rng.randomize()
	if _glow_texture == null:
		_glow_texture = _make_glow()

	var frame := SubViewportContainer.new()
	frame.name = "LanternView"
	frame.stretch = true
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(frame)
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var view := SubViewport.new()
	view.own_world_3d = true
	view.transparent_bg = true
	view.msaa_3d = Viewport.MSAA_4X
	frame.add_child(view)
	_build_world(view)

	_overlay = Control.new()
	_overlay.name = "SmokeLayer"
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlay)
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.draw.connect(_draw_overlay)
	resized.connect(_frame_camera)
	_frame_camera()


## Makes the candle gutter as if it is about to go out.
func startle() -> void:
	if not _snuffing:
		_startle = 1.0


## Starts the gust. `snuffed` fires once the eyes have closed again.
func snuff() -> void:
	if _snuffing:
		return
	_snuffing = true
	_snuff_time = 0.0
	_eye_active = false
	_eye_open = 0.0


## Skips the rest of the sequence.
func finish() -> void:
	if _finished:
		return
	_finished = true
	snuffed.emit()


# --- 3D scene -------------------------------------------------------------------------------

func _build_world(world: SubViewport) -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_CLEAR_COLOR
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#2a1a1f")
	environment.ambient_light_energy = 0.12
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var setting := WorldEnvironment.new()
	setting.environment = environment
	world.add_child(setting)

	_camera = Camera3D.new()
	_camera.fov = 34.0
	_camera.current = true
	_camera.look_at_from_position(CAMERA_AT, CAMERA_TARGET)
	world.add_child(_camera)

	_light = OmniLight3D.new()
	_light.light_color = Color(1.0, 0.64, 0.32)
	_light.light_energy = 1.15
	_light.omni_range = 3.2
	_light.omni_attenuation = 1.6
	_light.shadow_enabled = true
	_light.shadow_opacity = 0.55
	_light.shadow_blur = 2.0
	_light.position = WICK + EYE_LEVEL
	world.add_child(_light)

	# A faint warm bounce from the front so the crate faces below the candle still read.
	_bounce = OmniLight3D.new()
	_bounce.light_color = Color(1.0, 0.55, 0.3)
	_bounce.light_energy = 0.2
	_bounce.omni_range = 2.4
	_bounce.position = Vector3(0.15, 0.3, 1.2)
	world.add_child(_bounce)

	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(3.2, 3.2)
	# Dense enough for the shader to raise each stone above its joints.
	floor_mesh.subdivide_width = 220
	floor_mesh.subdivide_depth = 220
	var stone := ShaderMaterial.new()
	stone.shader = StoneShader
	_stone = stone
	var ground := MeshInstance3D.new()
	ground.name = "StoneFloor"
	ground.mesh = floor_mesh
	ground.material_override = stone
	world.add_child(ground)

	var crate := Node3D.new()
	crate.name = "Crate"
	world.add_child(crate)
	_build_crate(crate)
	# The crate would shade the whole floor around it; let the light reach the stones.
	for board: GeometryInstance3D in crate.get_children():
		board.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var lantern := Node3D.new()
	lantern.name = "Lantern"
	world.add_child(lantern)
	_build_lantern(lantern)


func _build_crate(crate: Node3D) -> void:
	var w := CRATE.x
	var h := CRATE.y
	var d := CRATE.z
	var post := 0.06
	var rail := 0.06
	var board := 0.02
	var gap := 0.012
	var frame := Color("#5c3c23")
	var tones := [Color("#7c5333"), Color("#6d482b"), Color("#86593a")]
	_box(crate, Vector3(w - 0.03, h - 0.03, d - 0.03), Vector3(0, h * 0.5, 0), _surface(Color("#0b0706"), 1.0))
	for x: float in [-1.0, 1.0]:
		for z: float in [-1.0, 1.0]:
			_box(crate, Vector3(post, h, post), Vector3(x * (w - post) * 0.5, h * 0.5, z * (d - post) * 0.5), _wood(frame, 1))
	var plank := (h - rail * 2.0 - gap * 2.0) / 3.0
	for side: float in [-1.0, 1.0]:
		# Front and back faces: planks along X between the corner posts.
		var z := side * (d * 0.5 - board * 0.5)
		for index in 3:
			var y := rail + plank * 0.5 + index * (plank + gap)
			_box(crate, Vector3(w - post * 2.0, plank, board), Vector3(0, y, z - side * 0.004),
				_wood(tones[(index + int(side > 0)) % 3], 0))
		for y: float in [rail * 0.5, h - rail * 0.5]:
			_box(crate, Vector3(w - post * 2.0, rail, board * 1.4), Vector3(0, y, z), _wood(frame, 0))
		var span := Vector2(w - post * 2.0, h - rail * 2.0)
		_box(crate, Vector3(span.length(), 0.055, board * 1.3), Vector3(0, h * 0.5, z + side * 0.003), _wood(frame, 0),
			Vector3(0, 0, side * atan2(span.y, span.x)))
		# Left and right faces: planks along Z.
		var x := side * (w * 0.5 - board * 0.5)
		for index in 3:
			var y := rail + plank * 0.5 + index * (plank + gap)
			_box(crate, Vector3(board, plank, d - post * 2.0), Vector3(x - side * 0.004, y, 0), _wood(tones[(index + 1) % 3], 2))
		for y: float in [rail * 0.5, h - rail * 0.5]:
			_box(crate, Vector3(board * 1.4, rail, d - post * 2.0), Vector3(x, y, 0), _wood(frame, 2))
	var lid_plank := (d - gap * 3.0) / 4.0
	for index in 4:
		var z := -d * 0.5 + lid_plank * 0.5 + index * (lid_plank + gap)
		_box(crate, Vector3(w, LID, lid_plank), Vector3(0, h + LID * 0.5, z), _wood(tones[index % 3], 0))


## The nun's hexagonal brass lantern: riveted bands, glass between six posts, a sloped roof,
## a domed cap with a big ring, and a thick dripping candle. It stands on a flat pan here.
func _build_lantern(lantern: Node3D) -> void:
	var brass := StandardMaterial3D.new()
	brass.albedo_color = Color("#9a6a3c")
	brass.metallic = 0.85
	brass.roughness = 0.38
	var dark_brass := StandardMaterial3D.new()
	dark_brass.albedo_color = Color("#5e3f24")
	dark_brass.metallic = 0.8
	dark_brass.roughness = 0.5
	var glass := StandardMaterial3D.new()
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(1.0, 0.82, 0.56, 0.12)
	glass.roughness = 0.08
	var wax := _surface(Color("#f0dfb8"), 0.5)
	# Wax glows a little from the flame inside it; dimmed with the light in `_process`.
	wax.emission_enabled = true
	wax.emission = Color(1.0, 0.6, 0.28)
	_wax = wax
	var body_bottom := STAND + 0.048
	var body_top := STAND + 0.208

	_hexagon(lantern, 0.07, 0.095, 0.03, STAND + 0.015, dark_brass)
	_hexagon(lantern, 0.1, 0.1, 0.018, STAND + 0.039, brass)
	var pane := _hexagon(lantern, 0.088, 0.088, body_top - body_bottom, (body_top + body_bottom) * 0.5, glass)
	pane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_hexagon(lantern, 0.1, 0.1, 0.018, body_top + 0.009, brass)
	_hexagon(lantern, 0.045, 0.1, 0.05, body_top + 0.043, dark_brass)
	_cylinder(lantern, 0.042, 0.022, Vector3(0, body_top + 0.079, 0), brass)
	var dome_mesh := SphereMesh.new()
	dome_mesh.radius = 0.036
	dome_mesh.height = 0.036
	dome_mesh.is_hemisphere = true
	var dome := MeshInstance3D.new()
	dome.mesh = dome_mesh
	dome.material_override = brass
	dome.position = Vector3(0, body_top + 0.09, 0)
	lantern.add_child(dome)
	_cylinder(lantern, 0.008, 0.02, Vector3(0, body_top + 0.135, 0), brass)
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 0.036
	ring_mesh.outer_radius = 0.047
	var ring := MeshInstance3D.new()
	ring.mesh = ring_mesh
	ring.material_override = brass
	ring.position = Vector3(0, body_top + 0.186, 0)
	ring.rotation.x = PI * 0.5
	lantern.add_child(ring)

	for index in 6:
		# Corners sit between the faces so a flat pane faces the camera.
		var angle := TAU * index / 6.0 + PI / 6.0
		var corner := Vector3(sin(angle), 0, cos(angle))
		_box(lantern, Vector3(0.011, body_top - body_bottom, 0.011), corner * 0.088 + Vector3(0, (body_top + body_bottom) * 0.5, 0), brass)
		for y: float in [STAND + 0.039, body_top + 0.009]:
			var rivet := MeshInstance3D.new()
			var bead := SphereMesh.new()
			bead.radius = 0.006
			bead.height = 0.012
			rivet.mesh = bead
			rivet.material_override = brass
			rivet.position = corner * 0.1 + Vector3(0, y, 0)
			lantern.add_child(rivet)

	var candle := _cylinder(lantern, 0.032, CANDLE_TOP - body_bottom, Vector3(0, (CANDLE_TOP + body_bottom) * 0.5, 0), wax)
	candle.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for drip: Array in [[0.4, 0.024], [1.7, 0.016], [2.9, 0.03], [4.4, 0.02]]:
		var drop := CapsuleMesh.new()
		drop.radius = 0.0065
		drop.height = float(drip[1])
		var tear := MeshInstance3D.new()
		tear.mesh = drop
		tear.material_override = wax
		tear.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		tear.position = Vector3(sin(drip[0]) * 0.031, CANDLE_TOP - float(drip[1]) * 0.4, cos(drip[0]) * 0.031)
		lantern.add_child(tear)
	var wick := _cylinder(lantern, 0.002, 0.014, WICK + Vector3(0, -0.004, 0), _surface(Color("#1a120d"), 1.0))
	wick.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	_halo_material = ShaderMaterial.new()
	_halo_material.shader = HaloShader
	_billboard(lantern, Vector2(0.5, 0.5), WICK + Vector3(0, 0.05, 0.02), _halo_material).name = "Halo"
	_flame_material = ShaderMaterial.new()
	_flame_material.shader = FlameShader
	_billboard(lantern, FLAME_SIZE, WICK + Vector3(0, FLAME_SIZE.y * 0.5 - 0.004, 0), _flame_material).name = "Flame"


## A six-sided band, roof or pane turned so one flat face looks at the camera.
func _hexagon(parent: Node3D, top: float, bottom: float, height: float, y: float, material: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	mesh.radial_segments = 6
	mesh.rings = 1
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = material
	node.position = Vector3(0, y, 0)
	node.rotation.y = PI / 6.0
	parent.add_child(node)
	return node


func _wood(color: Color, axis: int) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = WoodShader
	material.set_shader_parameter("wood", color)
	material.set_shader_parameter("axis", axis)
	material.set_shader_parameter("seed", _rng.randf_range(0.0, 50.0))
	return material


func _box(parent: Node3D, extent: Vector3, at: Vector3, material: Material, turn := Vector3.ZERO) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = extent
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = material
	node.position = at
	node.rotation = turn
	parent.add_child(node)
	return node


func _cylinder(parent: Node3D, radius: float, height: float, at: Vector3, material: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 20
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = material
	node.position = at
	parent.add_child(node)
	return node


func _billboard(parent: Node3D, extent: Vector2, at: Vector3, material: Material) -> MeshInstance3D:
	var mesh := QuadMesh.new()
	mesh.size = extent
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = material
	node.position = at
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(node)
	return node


func _surface(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material


## Shifts the lens so the lantern sits right of centre at any aspect ratio.
func _frame_camera() -> void:
	if _camera == null or size.y <= 0.0:
		return
	var distance := CAMERA_AT.distance_to(CAMERA_TARGET)
	var half_width := distance * tan(deg_to_rad(_camera.fov) * 0.5) * size.x / size.y
	_camera.h_offset = -(SCREEN_X - 0.5) * 2.0 * half_width


# --- Animation ------------------------------------------------------------------------------

func _process(delta: float) -> void:
	delta = minf(delta, 0.05)
	_time += delta
	var unit := _unit()
	if _camera.is_inside_tree():
		_flame_screen = _camera.unproject_position(WICK + EYE_LEVEL)
		_wick_screen = _camera.unproject_position(WICK)
		_floor_screen = _camera.unproject_position(Vector3(0, 0, CRATE.z * 0.5))
	var mouse := get_local_mouse_position()
	if _last_mouse.is_finite():
		var speed := (mouse - _last_mouse) / maxf(delta, 0.001)
		_mouse_speed = _mouse_speed.lerp(speed, minf(1.0, delta * 12.0))
	_last_mouse = mouse
	_agitation = lerpf(_agitation, clampf(_mouse_speed.length() / (1800.0 * unit), 0.0, 1.0), minf(1.0, delta * 5.0))
	_startle = maxf(0.0, _startle - delta / 0.9)
	var gutter := _startle * _startle
	var shaken := maxf(_agitation, gutter)

	var target := Vector2.ZERO
	if _snuffing:
		target.x = 1.5 + 0.35 * _noise.get_noise_1d(_time * 19.0)
		target.y = 0.35
	else:
		var reach := clampf((mouse.x - _flame_screen.x) / (420.0 * unit), -1.0, 1.0)
		var lift := clampf((_flame_screen.y - mouse.y) / (420.0 * unit), -1.0, 1.0)
		var near := 1.0 - clampf(mouse.distance_to(_flame_screen) / (560.0 * unit), 0.0, 1.0)
		var drag := clampf(_mouse_speed.x / (1500.0 * unit), -1.0, 1.0)
		target.x = reach * 0.85 + drag * 0.7 + _noise.get_noise_1d(_time * 0.7 + 30.0) * 0.14
		target.x += gutter * 1.4 * _noise.get_noise_1d(_time * 17.0 + 70.0)
		target.y = -lift * 0.2 * near
	var pull := (target - _lean) * 70.0 - _lean_speed * 9.0
	_lean_speed += pull * delta
	_lean += _lean_speed * delta

	var flicker := ((0.93 + 0.07 * _noise.get_noise_1d(_time * 8.0) + 0.06 * shaken * _noise.get_noise_1d(_time * 27.0 + 50.0))
		* (1.0 - 0.65 * gutter * absf(_noise.get_noise_1d(_time * 31.0 + 90.0))))
	if _snuffing:
		_advance_snuff(delta)
	else:
		_advance_idle_eyes(delta)
	_brightness = _light_level * flicker
	_advance_smoke(delta)

	var height := (_flame_scale * (1.0 + 0.14 * _noise.get_noise_1d(_time * 11.0)
		+ 0.14 * shaken * _noise.get_noise_1d(_time * 29.0 + 40.0)) * (1.0 - _lean.y * 0.5)
		* (1.0 - 0.6 * gutter * absf(_noise.get_noise_1d(_time * 37.0 + 10.0))))
	_flame_material.set_shader_parameter("lean", _lean.x + gutter * 1.2 * _noise.get_noise_1d(_time * 23.0 + 5.0))
	_flame_material.set_shader_parameter("stretch", height)
	_flame_material.set_shader_parameter("agitation", shaken)
	_flame_material.set_shader_parameter("intensity", 1.0 if _flame_scale > 0.01 else 0.0)
	_halo_material.set_shader_parameter("intensity", 0.5 * _brightness)
	_light.light_energy = 1.15 * _brightness
	_bounce.light_energy = 0.2 * _brightness
	_wax.emission_energy_multiplier = 0.45 * _brightness
	_stone.set_shader_parameter("visibility", clampf(_brightness * 1.4, 0.0, 1.0))
	_light.position = WICK + EYE_LEVEL + Vector3(_lean.x * 0.02 * _flame_scale, 0, 0)
	queue_redraw()
	_overlay.queue_redraw()


func _advance_snuff(delta: float) -> void:
	_snuff_time += delta
	var t := _snuff_time
	if t < GUST_TIME:
		var progress := t / GUST_TIME
		_flame_scale = (1.0 - progress * progress) * (0.8 + 0.2 * absf(_noise.get_noise_1d(_time * 33.0)))
		_light_level = lerpf(1.0, 0.3, progress) * (0.75 + 0.25 * absf(_noise.get_noise_1d(_time * 41.0)))
	else:
		if _flame_scale > 0.0:
			_flame_scale = 0.0
			_ember = 1.0
			_spawn_smoke()
		_light_level = maxf(0.0, _light_level - delta / 0.16)
		_ember = maxf(0.0, _ember - delta / 0.95)
	_eye_offset = Vector2(-150, -105)
	_eye_size = 1.3
	_eye_strength = 0.95
	_eye_open = _eye_curve(t - GUST_TIME - DARK_PAUSE, EYE_HOLD_TIME)
	if t >= GUST_TIME + DARK_PAUSE + EYE_OPEN_TIME + EYE_HOLD_TIME + EYE_CLOSE_TIME:
		finish()


func _advance_idle_eyes(delta: float) -> void:
	_eye_clock += delta
	if not _eye_active:
		if _eye_clock >= _eye_wait:
			_eye_active = true
			_eye_clock = 0.0
			var side := -1.0 if _rng.randf() < 0.6 else 1.0
			_eye_offset = Vector2(side * _rng.randf_range(175, 235), -_rng.randf_range(35, 85))
			_eye_size = _rng.randf_range(0.85, 1.0)
			_eye_strength = 0.5
		return
	_eye_open = _eye_curve(_eye_clock, IDLE_EYE_HOLD)
	if _eye_clock >= EYE_OPEN_TIME + IDLE_EYE_HOLD + EYE_CLOSE_TIME:
		_eye_active = false
		_eye_open = 0.0
		_eye_clock = 0.0
		_eye_wait = _rng.randf_range(8.0, 14.0)


func _eye_curve(elapsed: float, hold: float) -> float:
	if elapsed <= 0.0:
		return 0.0
	if elapsed < EYE_OPEN_TIME:
		return ease(elapsed / EYE_OPEN_TIME, 0.4)
	elapsed -= EYE_OPEN_TIME
	if elapsed < hold:
		return 1.0
	return 1.0 - ease(clampf((elapsed - hold) / EYE_CLOSE_TIME, 0.0, 1.0), 1.8)


func _spawn_smoke() -> void:
	for index in 10:
		_smoke.append({
			"p": Vector2(_rng.randf_range(-1.5, 1.5), 0.0),
			"v": Vector2(_rng.randf_range(4.0, 16.0), -_rng.randf_range(16.0, 30.0)),
			"age": -index * 0.045,
			"life": _rng.randf_range(1.0, 1.6),
			"r": _rng.randf_range(2.2, 3.8),
		})


func _advance_smoke(delta: float) -> void:
	for puff: Dictionary in _smoke:
		puff.age += delta
		if puff.age > 0.0:
			var drift: Vector2 = puff.v
			drift.x += 9.0 * delta
			puff.v = drift
			puff.p += drift * delta
			puff.r += 3.2 * delta
	_smoke = _smoke.filter(func(puff: Dictionary) -> bool: return puff.age < puff.life)


func _unit() -> float:
	return maxf(size.y, 1.0) / 740.0


# --- 2D layers ------------------------------------------------------------------------------

func _draw() -> void:
	var unit := _unit()
	draw_rect(Rect2(Vector2.ZERO, size), VOID)
	_glow(_flame_screen, 560.0 * unit, Color(GLOW, 0.05 * _brightness))
	_glow(_flame_screen, 260.0 * unit, Color(GLOW, 0.08 * _brightness))
	draw_texture_rect(_glow_texture, Rect2(_floor_screen - Vector2(340, 34) * unit, Vector2(680, 68) * unit), false,
		Color(GLOW, 0.2 * _brightness))
	_draw_eyes(_flame_screen + _eye_offset * unit, unit * _eye_size)


func _draw_overlay() -> void:
	var unit := _unit()
	if _ember > 0.0:
		_glow(_wick_screen, 16.0 * unit, Color(EMBER, 0.45 * _ember), _overlay)
		_overlay.draw_circle(_wick_screen, 1.8 * unit, Color(EMBER, _ember))
	for puff: Dictionary in _smoke:
		if puff.age <= 0.0:
			continue
		var fade: float = 1.0 - puff.age / puff.life
		_overlay.draw_circle(_wick_screen + puff.p * unit, puff.r * unit, Color(0.62, 0.56, 0.55, 0.2 * fade))


## Draws both eyes. The upper lid comes down from the top as `_eye_open` drops to zero.
func _draw_eyes(center: Vector2, unit: float) -> void:
	if _eye_open <= 0.01:
		return
	var strength := _eye_strength * minf(1.0, _eye_open * 2.0)
	_glow(center, 80.0 * unit, Color(EYE_HALO, 0.2 * strength))
	var width := 11.0 * unit
	var height := 3.8 * unit
	var lid := -height + (1.0 - _eye_open) * height * 2.0
	for side: float in [-1.0, 1.0]:
		var eye := center + Vector2(side * 20.0 * unit, 0)
		var tilt := Transform2D(-side * 0.24, eye)
		var almond := PackedVector2Array()
		for index in 24:
			var angle := TAU * index / 24.0
			almond.append(Vector2(cos(angle) * width, sin(angle) * height * (1.0 - 0.45 * cos(angle) * side)))
		var below_lid := PackedVector2Array([Vector2(-width * 2.0, lid), Vector2(width * 2.0, lid),
			Vector2(width * 2.0, height * 3.0), Vector2(-width * 2.0, height * 3.0)])
		var white := Geometry2D.intersect_polygons(almond, below_lid)
		if white.is_empty():
			continue
		_glow(eye, 18.0 * unit, Color(EYE, 0.25 * strength * _eye_open))
		for shape: PackedVector2Array in white:
			_fill(tilt * shape, Color(EYE, strength))
		var pupil := PackedVector2Array()
		for index in 12:
			var angle := TAU * index / 12.0
			pupil.append(Vector2(side * -1.5 * unit + 2.0 * unit, 0.4 * unit) + Vector2(cos(angle), sin(angle)) * 1.6 * unit)
		for shape: PackedVector2Array in white:
			for dot: PackedVector2Array in Geometry2D.intersect_polygons(pupil, shape):
				_fill(tilt * dot, Color(0.08, 0.02, 0.02, strength))
		var edge := Geometry2D.intersect_polyline_with_polygon(
			PackedVector2Array([Vector2(-width * 1.2, lid), Vector2(width * 1.2, lid)]), almond)
		for line: PackedVector2Array in edge:
			draw_polyline(tilt * line, Color(0.05, 0.02, 0.02, strength), maxf(1.0, 1.4 * unit))


func _fill(points: PackedVector2Array, color: Color) -> void:
	if points.size() >= 3 and not Geometry2D.triangulate_polygon(points).is_empty():
		draw_colored_polygon(points, color)


func _glow(center: Vector2, radius: float, color: Color, canvas: CanvasItem = null) -> void:
	if color.a <= 0.002:
		return
	var target := canvas if canvas != null else self
	target.draw_texture_rect(_glow_texture, Rect2(center - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)


static func _make_glow() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.3, 1.0])
	gradient.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.42), Color(1, 1, 1, 0)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 256
	texture.height = 256
	return texture


## A gust of wind followed by a low huff as the candle goes out, synthesized once.
static func snuff_stream() -> AudioStreamWAV:
	if _snuff_stream != null:
		return _snuff_stream
	var rate := 22050
	var count := int(rate * 0.95)
	var samples := PackedFloat32Array()
	samples.resize(count)
	var rng := RandomNumberGenerator.new()
	rng.seed = 0x51CE
	var low := 0.0
	var lower := 0.0
	var huff_low := 0.0
	var peak := 0.0
	for index in count:
		var t := float(index) / rate
		var white := rng.randf_range(-1.0, 1.0)
		var cutoff := 260.0 + 1500.0 * sin(PI * clampf(t / 0.5, 0.0, 1.0))
		var blend := 1.0 - exp(-TAU * cutoff / rate)
		low += (white - low) * blend
		lower += (low - lower) * blend
		var gust := (low - lower * 0.5) * 2.2 * smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.22, 0.6, t))
		var huff := 0.0
		var since := t - GUST_TIME
		if since >= 0.0:
			huff_low += (white - huff_low) * 0.05
			var envelope := smoothstep(0.0, 0.012, since) * exp(-since * 11.0)
			huff = (huff_low * 3.0 + sin(TAU * (88.0 - 30.0 * since) * since) * 0.5) * envelope
		samples[index] = gust + huff
		peak = maxf(peak, absf(samples[index]))
	var data := PackedByteArray()
	data.resize(count * 2)
	var gain := 0.8 / maxf(peak, 0.0001)
	for index in count:
		data.encode_s16(index * 2, int(clampf(samples[index] * gain, -1.0, 1.0) * 32767.0))
	_snuff_stream = AudioStreamWAV.new()
	_snuff_stream.format = AudioStreamWAV.FORMAT_16_BITS
	_snuff_stream.mix_rate = rate
	_snuff_stream.stereo = false
	_snuff_stream.data = data
	return _snuff_stream
