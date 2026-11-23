extends SceneTree

const Playthrough := preload("res://tests/play_full_run.gd")


func _initialize() -> void:
	root.add_child.call_deferred(Playthrough.new())
