extends SceneTree
## Run with the project renderer to bake the original card surfaces.

const Glyph := preload("res://ui/field_glyph.gd")
const FieldUI := preload("res://ui/field_ui.gd")
const OUTPUT := "res://art/ui/cards"
const ROLE_SHAPES := {
	"attack": [0, 16, 14, 2, 90, 2, 104, 16, 90, 30, 14, 30],
	"defense": [0, 3, 104, 3, 98, 21, 83, 29, 52, 32, 21, 29, 6, 21],
	"heal": [0, 11, 11, 11, 11, 2, 93, 2, 93, 11, 104, 11, 104, 21,
		93, 21, 93, 30, 11, 30, 11, 21, 0, 21],
	"skill": [0, 8, 17, 8, 28, 2, 76, 2, 87, 8, 104, 8, 104, 24,
		87, 24, 76, 30, 28, 30, 17, 24, 0, 24],
}
const LEGACY_ART := {
	"aim": "art/skills/emotes/aimedShot.webp",
	"break": "art/skills/shieldRam.webp",
	"split": "art/skills/brace.webp",
	"counter": "art/skills/shieldCounter.webp",
	"aid": "art/skills/mending-v5.webp",
}

var _viewport: SubViewport
var _plate: Node2D


func _initialize() -> void:
	call_deferred("_bake")


func _bake() -> void:
	var directory := DirAccess.make_dir_recursive_absolute(OUTPUT)
	if directory != OK:
		push_error("Could not create the card art directory")
		quit(1)
		return
	_viewport = SubViewport.new()
	_viewport.transparent_bg = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(_viewport)
	_plate = Node2D.new()
	_viewport.add_child(_plate)

	for grade: String in FieldUI.RARITIES:
		_viewport.size = Vector2i(112, 112)
		var draw_frame := _draw_frame.bind(FieldUI.RARITIES[grade][1])
		if not await _save(draw_frame, "frame-" + grade + ".png"):
			quit(1)
			return
	_viewport.size = Vector2i(104, 32)
	for symbol: String in ROLE_SHAPES:
		if not await _save(_draw_role.bind(symbol), "role-" + symbol + ".png"):
			quit(1)
			return
	_viewport.size = Vector2i(96, 46)
	if not await _save(_draw_action, "card-action.png"):
		quit(1)
		return

	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/threshold.json"))
	_viewport.size = Vector2i(24, 24)
	var terms := {}
	for definition: Array in FieldUI.CARD_TERMS.values():
		terms[definition[0]] = true
	for symbol: String in terms:
		if not await _save(_draw_term.bind(symbol), "term-" + symbol + ".png"):
			quit(1)
			return

	_viewport.size = FieldUI.CARD_ART_SIZE
	for index in data.cards.size():
		var card: Dictionary = data.cards[index]
		var art := load("res://" + LEGACY_ART.get(card.id, card.art)) as Texture2D
		if art == null or not await _save(_draw_face.bind(card, art, index), card.id + ".webp"):
			quit(1)
			return
	print("Baked %d card illustrations, %d rarity frames, %d role plaques and %d term icons" %
		[data.cards.size(), FieldUI.RARITIES.size(), ROLE_SHAPES.size(), terms.size()])
	quit()


func _save(paint: Callable, filename: String) -> bool:
	_plate.draw.connect(paint)
	_plate.queue_redraw()
	# Flush the queued CanvasItem draw before collecting the rendered texture.
	await process_frame
	await RenderingServer.frame_post_draw
	var image := _viewport.get_texture().get_image()
	_plate.draw.disconnect(paint)
	var path := OUTPUT.path_join(filename)
	var result := image.save_png(path) if filename.ends_with(".png") else image.save_webp(path, true, 0.94)
	if result != OK:
		push_error("Could not save " + path)
	return result == OK


func _cut(bounds: Rect2, bevel: float) -> PackedVector2Array:
	var a := bounds.position
	var b := bounds.end
	return PackedVector2Array([
		Vector2(a.x + bevel, a.y), Vector2(b.x - bevel, a.y), Vector2(b.x, a.y + bevel),
		Vector2(b.x, b.y - bevel), Vector2(b.x - bevel, b.y), Vector2(a.x + bevel, b.y),
		Vector2(a.x, b.y - bevel), Vector2(a.x, a.y + bevel),
	])


func _layer(bounds: Rect2, bevel: float, top: Color, bottom: Color) -> void:
	_plate.draw_polygon(_cut(bounds, bevel),
		PackedColorArray([top, top, top, bottom, bottom, bottom, bottom, top]))


func _draw_frame(metal: Color) -> void:
	_layer(Rect2(1, 4, 110, 107), 13, Color("#10090b69"), Color("#0d070ae0"))
	_layer(Rect2(2, 1, 108, 107), 13, metal.lightened(0.16), Color("#261b1c"))
	_layer(Rect2(4, 3, 104, 101), 11, Color("#201518"), metal.darkened(0.35))
	_layer(Rect2(6, 5, 100, 97), 10, metal, metal.darkened(0.29))
	_layer(Rect2(9, 7, 94, 92), 9, Color("#392727"), Color("#533922"))
	_layer(Rect2(11, 9, 90, 88), 8, FieldUI.PAPER, Color("#c8a976"))
	for point: Vector2 in [Vector2(14, 13), Vector2(98, 13), Vector2(14, 94), Vector2(98, 94)]:
		_plate.draw_circle(point, 3.0, Color("#46332a"), true, -1, true)
		_plate.draw_circle(point - Vector2.ONE, 1.4, metal.lightened(0.52), true, -1, true)


func _draw_action() -> void:
	_layer(Rect2(0, 2, 96, 43), 13, Color("#381e25"), Color("#1c1218"))
	_layer(Rect2(1, 1, 94, 40), 12, Color("#c7a472"), Color("#624338"))
	_layer(Rect2(3, 3, 90, 36), 10, Color("#473337"), Color("#241b25"))
	_layer(Rect2(6, 6, 84, 19), 8, Color("#59423e"), Color("#38282e"))


func _draw_role(symbol: String) -> void:
	var outline: Array = ROLE_SHAPES[symbol]
	var ink: Color = FieldUI.CARD_TYPES[symbol][1]
	var center := Vector2(52, 16)
	var border := PackedVector2Array()
	var face := PackedVector2Array()
	var sheen := PackedColorArray()
	for i in range(0, outline.size(), 2):
		var point := Vector2(outline[i], outline[i + 1])
		border.append(point)
		face.append(center + (point - center) * Vector2(0.94, 0.80))
		sheen.append(ink.darkened(0.22 + point.y / 110.0))
	_plate.draw_polygon(border, sheen)
	_plate.draw_colored_polygon(face, ink.darkened(0.78).lerp(Color("#1b131d"), 0.35))


func _draw_face(card: Dictionary, art: Texture2D, serial: int) -> void:
	var symbol := FieldUI.card_symbol(card)
	var role: Array = FieldUI.CARD_TYPES[symbol]
	var enamel: Color = role[1]
	var rarity: Array = FieldUI.RARITIES[card.get("rarity", "common")]
	var rim: Color = rarity[1]
	var height := FieldUI.CARD_ART_SIZE.y
	_layer(Rect2(1, 1, 390, height - 4), 23, rim.lerp(enamel, 0.34 + 0.06 * (serial % 5)), Color("#21171a"))
	_layer(Rect2(4, 4, 384, height - 11), 20, Color("#20151b"), rim.darkened(0.15))
	_layer(Rect2(8, 8, 376, height - 19), 17, enamel.darkened(0.7), Color("#2b1b21"))
	_draw_art(art, Rect2(12, 12, 368, height - 27))
	for point: Vector2 in [Vector2(20, 19), Vector2(372, 19), Vector2(20, height - 21), Vector2(372, height - 21)]:
		_plate.draw_circle(point, 3.5, Color("#2c1c20"), true, -1, true)
		_plate.draw_circle(point - Vector2.ONE, 1.8, enamel.lightened(0.32), true, -1, true)
	var count: int = rarity[2].length()
	_layer(Rect2(22, height - 49, count * 17 + 14, 25), 7,
		Color("#271b22"), Color("#121013"))
	for index in count:
		var rivet := Vector2(37 + index * 17, height - 37)
		_layer(Rect2(rivet - Vector2(6, 6), Vector2(12, 12)), 4, rim.lightened(0.65), rim)
	for notch in 7:
		var start := Vector2(169 + notch * 8, height - 9)
		var depth := 7 if serial & (1 << notch) else 4
		_plate.draw_line(start, start + Vector2(3, depth), enamel.darkened(0.34), 1.5, true)


func _draw_term(symbol: String) -> void:
	for stroke: Array in Glyph.STROKES[symbol]:
		var points := PackedVector2Array()
		for i in range(0, stroke.size(), 2):
			points.append(Vector2(stroke[i], stroke[i + 1]))
		_plate.draw_polyline(points, FieldUI.PAPER_INK, 2.1, true)


func _draw_art(art: Texture2D, opening: Rect2) -> void:
	var aperture := _cut(opening, 13)
	var art_scale := maxf(opening.size.x / art.get_width(), opening.size.y / art.get_height())
	var crop_size := opening.size / (art.get_size() * art_scale)
	var uvs := PackedVector2Array()
	for point: Vector2 in aperture:
		uvs.append((Vector2.ONE - crop_size) / 2.0 +
			((point - opening.position) / opening.size) * crop_size)
	_plate.draw_polygon(aperture, PackedColorArray([Color.WHITE]), uvs, art)
