extends RefCounted
## FNV-1a and Mulberry32, with the same unsigned arithmetic as the web prototype.

var _state := 2166136261

func _init(key: String) -> void:
	for i in key.length():
		_state = ((_state ^ key.unicode_at(i)) * 16777619) & 0xffffffff

func real() -> float:
	_state = (_state + 0x6d2b79f5) & 0xffffffff
	var value := ((_state ^ (_state >> 15)) * (_state | 1)) & 0xffffffff
	value = (value ^ (value + ((value ^ (value >> 7)) * (value | 61)))) & 0xffffffff
	return float((value ^ (value >> 14)) & 0xffffffff) / 4294967296.0

func shuffled(items: Array) -> Array:
	var result := items.duplicate()
	for i in range(items.size() - 1, 0, -1):
		var j := floori(real() * (i + 1))
		var first = result[i]
		result[i] = result[j]
		result[j] = first
	return result
