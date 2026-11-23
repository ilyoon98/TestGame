extends Node

signal cue_triggered(id: String)

const STREAMS := {
	"attack": preload("res://art/audio/attack.wav"),
	"hit": preload("res://art/audio/hit.wav"),
	"block": preload("res://art/audio/block.wav"),
	"block-hit": preload("res://art/audio/block-hit.wav"),
	"guard": preload("res://art/audio/guard.wav"),
	"heal": preload("res://art/audio/heal.wav"),
	"critical": preload("res://art/audio/critical.wav"),
	"defeat": preload("res://art/audio/defeat.wav"),
	"bell": preload("res://art/audio/bell.wav"),
	"pursuit": preload("res://art/audio/pursuit.wav"),
}

var enabled := true:
	set(value):
		enabled = value
		if not enabled:
			stop_cues()

var suspended := false:
	set(value):
		suspended = value
		for player: AudioStreamPlayer in get_children():
			player.stream_paused = value


func cue(id: String) -> void:
	if not enabled or suspended:
		return
	cue_triggered.emit(id)
	if DisplayServer.get_name() == "headless":
		return
	var player := AudioStreamPlayer.new()
	player.name = "Cue_" + id
	player.stream = STREAMS[id]
	player.finished.connect(player.queue_free)
	add_child(player)
	player.play()


func play_result(event: Dictionary) -> void:
	match String(event.type):
		"guard":
			cue("guard")
		"heal":
			if event.recovered > 0:
				cue("heal")
		"hit":
			var metallic: bool = event.get("blocked", 0) > 0 or event.get("removed", 0) > 0 or event.get("gateBlock", false)
			if metallic:
				cue("block-hit" if event.dealt > 0 else "block")
			elif event.dealt > 0:
				cue("hit")
			if event.get("defeated", false):
				cue("defeat")
			elif event.get("critical", 0) > 0:
				cue("critical")


func stop_cues() -> void:
	for player: AudioStreamPlayer in get_children():
		player.stop()
		remove_child(player)
		player.queue_free()
