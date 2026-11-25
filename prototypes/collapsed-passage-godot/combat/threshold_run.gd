extends RefCounted
## A run through the first stage. BattleRules owns each encounter's clock and tactics.

const BattleRules := preload("res://combat/battle_rules.gd")
const SeedMap := preload("res://world/seed_map.gd")
const Random := preload("res://world/seed_random.gd")
const PARTS := ["head", "eyes", "arms", "chest", "belly", "legs"]
const RANKS := ["전위", "중위", "후위"]
const COMPANION_SIDES := ["companion", "companion2", "companion3", "companion4"]

var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/threshold.json"))
## Godot-only floors 2-3; kept apart because threshold.json is regenerated from the web build.
var floor_data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/floors.json"))
var cards: Dictionary = {}
var phase := "prep"
var area := "threshold"
var trail: Array[String] = ["threshold"]
## Zero-based floor index and how many floors this run climbs (1 keeps the web layout).
var floor := 0
var floor_count := 1
var _room_catalog: Dictionary
var steps := 0
var player: Dictionary
var enemy: Dictionary
var companion: Dictionary = {}
var companion2: Dictionary = {}
var companion3: Dictionary = {}
var companion4: Dictionary = {}
var formation: Array = ["player", null, null]
var loadout: Array
var levels: Dictionary = {}
var rewards: Array[String] = []
var seed: String
var map_options: Variant
var training := false
var training_enemy_acts := true
var training_enemy_damage := 1
var qa_uses := 0
var journal: Array[String] = []
var loss_message := ""
var rank: int:
	get: return formation.find("player")
var elapsed := 0
var combat_time := 0
var distance: int
var loss_cause := ""
var stair_treatment: Dictionary = {}
var rest_finished := false
var slots: Array[Dictionary] = []
var enemy_ready_at := 0
var events: Array[Dictionary] = []
var event_states: Array[Dictionary] = []
var pending_recruit := ""
var pending_mystery := ""
var coins := 0
var lantern_oil := false
var lockpicks := false
var shop_purchases: Dictionary = {}
var mystery_result := ""
var _recruit_queue: Array = []
var _met: Array[String] = []
var _dead: Array[String] = []
var _battle: RefCounted
var _training_formation: Array = []


func _init(run_seed := "THRESHOLD", options: Variant = SeedMap.DEFAULT_OPTIONS, training_mode := false) -> void:
	seed = run_seed
	training = training_mode
	# Null is used by the previous fixed-map regression fixtures.
	map_options = options.duplicate(true) if options != null else null
	if training:
		if map_options == null:
			map_options = SeedMap.DEFAULT_OPTIONS.duplicate(true)
		map_options.merge({"shops": 0, "rests": 0, "elites": 0, "mysteries": 0}, true)
	data.foes.merge(floor_data.foes)
	data.visuals.merge(floor_data.visuals)
	_room_catalog = data.map.duplicate(true)
	_room_catalog.merge(floor_data.rooms)
	if map_options != null and not training:
		floor_count = clampi(int(map_options.get("floors", 1)), 1, floor_data.floors.size())
	if floor_count > 1:
		# The climb retunes floor-1 foes; single-floor runs keep the web numbers.
		for kind: String in floor_data.floors[0].get("foes", {}):
			data.foes[kind].merge(floor_data.floors[0].foes[kind], true)
	if map_options != null:
		_build_floor()
	if training:
		var plan := floor_plan()
		data.map.erase(plan.end)
		data.map[plan.boss].next.clear()
	for card: Dictionary in data.cards:
		cards[card.id] = card
	player = _fighter(data.nun, data.nun.health, int(data.nun.vitality), "nun")
	loadout = data.loadout.duplicate()
	for id: String in loadout:
		levels[id] = 1
	if training:
		var kinds: Array = data.recruits.keys()
		for index in COMPANION_SIDES.size():
			set(COMPANION_SIDES[index], _make_companion(kinds[index]))
		formation = ["player", "companion4", "companion3"]
		for id: String in cards:
			if cards[id].get("reward", false):
				levels[id] = 1
	distance = int(data.distance)
	_record("QA 훈련장 · 적 체력 ∞" if training else "폭동 경보. 사형수가 뒤쫓는다.")
	_enter_room()


func _fighter(definition: Dictionary, durability: Array, vitality: int, kind: String) -> Dictionary:
	var body := {}
	for i in PARTS.size():
		var value := int(durability[i])
		body[PARTS[i]] = {"hp": value, "max": value, "guard": 0}
	return {"kind": kind, "name": definition.name, "hp": vitality, "maxHp": vitality,
		"body": body, "counter": {}, "weapon": definition.get("weapon", ""),
		"jobs": definition.get("jobs", []), "factions": definition.get("factions", [])}


func _make_companion(kind: String) -> Dictionary:
	var definition: Dictionary = data.recruits[kind]
	var actor := _fighter(definition, definition.health, int(definition.vitality), kind)
	actor.loadout = definition.loadout.duplicate()
	return actor


## The floor being climbed: its start, boss and end rooms, battle pool and elite room.
func floor_plan() -> Dictionary:
	if floor_count == 1:
		return SeedMap.FIRST_FLOOR
	var plan: Dictionary = floor_data.floors[floor].duplicate()
	if floor == floor_count - 1:
		plan.end = "exit"
	return plan


func floor_name() -> String:
	return floor_data.floors[floor].name if floor_count > 1 else ""


func _build_floor() -> void:
	var options: Dictionary = map_options if floor == 0 else floor_data.floors[floor].options
	var floor_seed := seed if floor == 0 else JSON.stringify(["floor", floor + 1, seed])
	data.map = SeedMap.generate(floor_seed, options, _room_catalog, data.mysteryEvents.keys(), floor_plan())


func _ascend() -> void:
	floor += 1
	_build_floor()
	area = floor_plan().start
	trail = [area]
	_record(floor_data.floors[floor].arrival)
	# The lift leaves the pursuer a floor behind.
	var lead := int(floor_data.floors[floor].get("lead", 0))
	if lead > 0:
		distance += lead
		_record("승강기로 따돌림 · 도망 여유 +%d" % lead)
	# A quiet ride lets the party mend part of every wound (lost parts stay lost).
	var breather := float(floor_data.floors[floor].get("breather", 0.0))
	if breather > 0.0:
		var mended := 0
		for side: String in party_sides():
			for part: String in PARTS:
				var wound: Dictionary = get(side).body[part]
				if wound.hp > 0:
					mended += _heal_part(get(side), part, ceili((wound.max - wound.hp) * breather))
		_record("승강기에서 숨을 고름 · 내구도 +%d" % mended)


func _enter_room() -> void:
	rest_finished = false
	shop_purchases.clear()
	mystery_result = ""
	_battle = null
	slots.clear()
	_clear_events()
	elapsed = 0
	var room: Dictionary = data.map[area]
	if room.type == "ascend":
		_ascend()
		room = data.map[area]
	pending_mystery = room.get("event", "")
	if room.foe.is_empty():
		phase = "won" if room.type == "exit" else "route"
		return
	var foe: Dictionary = data.foes[room.foe]
	var bonus := 2 if room.type == "elite" else 0
	enemy = _fighter(foe, foe.hp, int(foe.vitality) + bonus, room.foe)
	if training:
		enemy.infinite = true
	_apply_ramp(room)
	for part: String in foe.armor:
		enemy.body[part].guard = int(foe.armor[part])
	phase = "prep"


## Deeper rooms on a floor field tougher foes: body and HP scale with the room's
## column, and late rooms hit harder. Only multi-floor runs have a ramp, and bosses
## keep their own tuned numbers.
func _apply_ramp(room: Dictionary) -> void:
	var ramp: Dictionary = floor_plan().get("ramp", {})
	if ramp.is_empty() or room.type == "boss":
		return
	var depth := int(room.col) - 1
	var scale := float(ramp.get("start", 1.0)) + float(ramp.get("step", 0.0)) * depth
	enemy.maxHp = maxi(1, roundi(enemy.maxHp * scale))
	enemy.hp = enemy.maxHp
	for part: Dictionary in enemy.body.values():
		part.max = maxi(1, roundi(part.max * scale))
		part.hp = part.max
	enemy.might = floori(float(ramp.get("might", 0.0)) * depth)
	enemy.haste = int(ramp.get("haste", 0)) * depth


func party_sides() -> Array:
	return formation.filter(func(side): return side != null and not down(get(side)))


func trait_counts(outgoing := "", incoming: Dictionary = {}) -> Dictionary:
	var members := party_sides().filter(func(side): return side != outgoing).map(func(side): return get(side))
	if not incoming.is_empty():
		members.append(incoming)
	var counts := {}
	for member: Dictionary in members:
		for id: String in member.factions + member.jobs:
			counts[id] = counts.get(id, 0) + 1
	return counts


func fallen_names() -> PackedStringArray:
	var names: PackedStringArray = []
	for kind: String in _dead:
		names.append(data.recruits[kind].name)
	return names


func living_roster() -> Array:
	return (["player"] + COMPANION_SIDES).filter(func(side):
		var actor: Dictionary = get(side)
		return not actor.is_empty() and not down(actor))


func side_loadout(side: String) -> Array:
	return loadout if side == "player" else get(side).loadout


func available_skills(side: String) -> Array:
	return cards.keys().filter(func(id):
		var card: Dictionary = cards[id]
		return _fits(card, get(side)) and (levels.has(id) or (exclusive(card) and not card.get("reward", false))))


func equipped_by(id: String) -> String:
	for side: String in living_roster() if training else party_sides():
		if side_loadout(side).has(id):
			return side
	return ""


func can_set_rank(value: int, side: String) -> bool:
	if phase != "prep" or side not in living_roster() or value < 0 or value >= RANKS.size():
		return false
	return formation.has(side) or (training and formation[value] != "player")


func set_rank(value: int, side := "player") -> bool:
	if not can_set_rank(value, side):
		return false
	var current := formation.find(side)
	if current >= 0:
		formation[current] = formation[value]
	formation[value] = side
	return true


func set_training_reserve(side: String) -> bool:
	if not training or phase != "prep" or side == "player" or side not in party_sides():
		return false
	formation[formation.find(side)] = null
	return true


func set_training_skill(side: String, slot: int, id: String) -> bool:
	if not training or phase != "prep" or side not in living_roster():
		return false
	var equipped := side_loadout(side)
	if slot < 0 or slot >= equipped.size():
		return false
	if id.is_empty():
		equipped[slot] = null
		return true
	var owner := equipped_by(id)
	if id not in available_skills(side) or (not owner.is_empty() and owner != side):
		return false
	var source := equipped.find(id)
	if source >= 0:
		equipped[source] = equipped[slot]
	equipped[slot] = id
	return true


func set_training_enemy_acts(active: bool) -> bool:
	if not training or phase == "combat":
		return false
	training_enemy_acts = active
	return true


func set_training_enemy_damage(multiplier: int) -> bool:
	if not training or phase == "combat" or multiplier < 1 or multiplier > 5:
		return false
	training_enemy_damage = multiplier
	return true


func set_training_injury(side: String, part: String, level: String) -> bool:
	if not training or phase != "combat" or side not in party_sides() or part not in PARTS:
		return false
	var actor: Dictionary = get(side)
	var wound: Dictionary = actor.body[part]
	var durability: int
	match level:
		"healthy": durability = wound.max
		"injured": durability = floori(wound.max * 0.5)
		"lost": durability = 0
		_: return false
	if durability == wound.hp:
		return false
	_clear_events()
	if durability < wound.hp:
		_battle.training_hit(side, part, wound.hp - durability)
		for event: Dictionary in events:
			_record_combat_event(event)
		finish_battle()
	else:
		_heal_part(actor, part, durability - wound.hp)
		_record("QA · %s %s 회복" % [actor.name, data.parts[part]])
	return true


func open_training_view(destination: String) -> bool:
	if not training or destination not in ["prep", "route"] or phase == destination:
		return false
	if not _training_formation.is_empty():
		formation = _training_formation
		_training_formation = []
		_dead.clear()
		loss_cause = ""
		loss_message = ""
		for side: String in ["player"] + COMPANION_SIDES:
			restore_fighter(get(side))
	if destination == "prep":
		_enter_room()
	else:
		_clear_events()
		phase = "route"
	return true


func toggle_skill(id: String, side := "player") -> bool:
	if phase != "prep" or not party_sides().has(side) or not available_skills(side).has(id):
		return false
	var active := side_loadout(side)
	var current := active.find(id)
	if current >= 0:
		active[current] = null
		return true
	var empty := active.find(null)
	var owner := equipped_by(id)
	if empty < 0 or (not owner.is_empty() and exclusive(cards[id])):
		return false
	if not owner.is_empty():
		var previous := side_loadout(owner)
		previous[previous.find(id)] = null
	active[empty] = id
	return true


func ready_to_fight() -> bool:
	return party_sides().all(func(side): return not side_loadout(side).has(null))


func begin() -> bool:
	if phase != "prep" or not ready_to_fight():
		return false
	if training:
		_training_formation = formation.duplicate()
	_battle = BattleRules.new(self)
	phase = "combat"
	return true


func step() -> Dictionary:
	_clear_events()
	if phase != "combat":
		return {}
	var previous_distance := distance
	var action: Dictionary = _battle.step()
	if distance < previous_distance:
		_record("전투 시간 경과 · 도망 여유 −1")
	for event: Dictionary in events:
		_record_combat_event(event)
	return action


func queue_event(event: Dictionary) -> void:
	events.append(event)
	var snapshot := {}
	for side: String in ["player", "enemy"] + COMPANION_SIDES:
		var actor: Dictionary = get(side)
		if not actor.is_empty():
			snapshot[side] = actor.duplicate(true)
	event_states.append(snapshot)


func _clear_events() -> void:
	events.clear()
	event_states.clear()


func intent() -> Dictionary:
	return _battle.intent()


func intent_power(plan: Dictionary) -> int:
	return _battle.intent_power(plan)


func gate_phase() -> String:
	return _battle.gate_phase() if _battle else ""


func cooldown(id: String, level := 0) -> int:
	var current := int(levels.get(id, 1)) if level == 0 else level
	return int(cards[id].cooldown) - (current - 1) * 400


func condition(actor: Dictionary, part: String) -> String:
	var state: Dictionary = actor.body[part]
	if state.hp == 0:
		return "lost"
	return "injured" if state.hp * 2 <= state.max else "healthy"


func down(actor: Dictionary) -> bool:
	return not actor.get("infinite", false) and (actor.hp == 0 or actor.body.head.hp == 0)


func restore_fighter(actor: Dictionary) -> void:
	actor.hp = actor.maxHp
	for part: Dictionary in actor.body.values():
		part.hp = part.max
	actor.erase("mark")
	clear_defense(actor)


func clear_defense(actor: Dictionary) -> void:
	for part in actor.body.values():
		part.guard = 0
	actor.counter = {}


func remove_fallen(side: String) -> void:
	if side in COMPANION_SIDES:
		_dead.append(get(side).kind)
		formation[formation.find(side)] = null


func finish_battle() -> void:
	if phase != "combat":
		return
	if down(player):
		_lose("combat")
	elif training:
		return
	elif down(enemy):
		_record("%s 격파" % enemy.name)
		for side: String in party_sides():
			clear_defense(get(side))
		_recruit_queue = data.map[area].recruits.filter(func(kind):
			return not _met.has(kind) and not _dead.has(kind))
		if map_options != null:
			coins += 1
		_next_recruit()
	elif distance <= 0:
		_lose("pursuit")


func can_use_qa(action: String) -> bool:
	if training and action != "heal":
		return false
	match action:
		"win": return phase == "combat" or (phase == "prep" and ready_to_fight())
		"heal", "margin": return phase in ["prep", "combat", "recruit", "reward", "route"]
		_: return false


func use_qa(action: String) -> bool:
	if not can_use_qa(action):
		return false
	match action:
		"win":
			if phase == "prep":
				begin()
			enemy.hp = 0
			_record("QA · 전투 즉시 승리")
			finish_battle()
		"heal":
			for side: String in party_sides():
				var actor: Dictionary = get(side)
				actor.hp = actor.maxHp
				for wound: Dictionary in actor.body.values():
					wound.hp = wound.max
			_record("QA · 살아 있는 아군의 전체 HP와 모든 부위 회복")
		"margin":
			distance += 5
			_record("QA · 도망 여유 +5")
	qa_uses += 1
	return true


func _lose(cause: String) -> void:
	phase = "lost"
	loss_cause = cause
	if cause == "pursuit":
		loss_message = "기도를 받았던 사형수에게 따라잡혔어요."
	elif player.body.head.hp == 0:
		loss_message = "머리가 결손되어 쓰러졌어요."
	else:
		loss_message = "전체 HP가 0이 되어 쓰러졌어요."
	_record(loss_message)


func _next_recruit() -> void:
	pending_recruit = "" if _recruit_queue.is_empty() else _recruit_queue.pop_front()
	if not pending_recruit.is_empty():
		_met.append(pending_recruit)
		phase = "recruit"
	elif data.map[area].type == "boss":
		phase = "route"
	else:
		_roll_rewards()
		phase = "reward" if not rewards.is_empty() else "route"


func decide_recruit(accept: bool, outgoing := "") -> bool:
	if phase != "recruit":
		return false
	if accept:
		var allies := party_sides()
		var full := allies.size() == RANKS.size()
		if full and (outgoing not in COMPANION_SIDES or outgoing not in allies):
			return false
		if not full and not outgoing.is_empty():
			return false
		var side := outgoing
		if not full:
			for candidate: String in COMPANION_SIDES:
				if get(candidate).is_empty() or down(get(candidate)):
					side = candidate
					break
		var definition: Dictionary = data.recruits[pending_recruit]
		var actor := _make_companion(pending_recruit)
		if definition.has("hurtArm"):
			actor.body.arms.hp = int(definition.hurtArm)
			actor.hp -= actor.body.arms.max - actor.body.arms.hp
		set(side, actor)
		_record("%s 합류" % actor.name)
		if not full:
			if allies.size() == 1 and rank == 0:
				formation = [null, null, "player"]
			var open := formation.find(null)
			var preferred := int(definition.get("preferredRank", open))
			formation[open] = formation[preferred]
			formation[preferred] = side
	_next_recruit()
	return true


func choose_reward(id := "") -> bool:
	if phase != "reward" or (not id.is_empty() and not rewards.has(id)):
		return false
	if not id.is_empty():
		levels[id] = int(levels.get(id, 0)) + 1
		_record("기술 습득 · %s" % cards[id].name if levels[id] == 1 else "%s 강화 · Lv.%d" % [cards[id].name, levels[id]])
	else:
		_record("전투 보상을 건너뛰었어요.")
	rewards.clear()
	phase = "route"
	return true


func travel_gain() -> int:
	match condition(player, "legs"):
		"lost": return 0
		"injured": return 1
		_: return 2


func can_move(destination: String) -> bool:
	if training:
		return phase == "route" and destination != area and data.map.has(destination) and not data.map[destination].foe.is_empty()
	return phase == "route" and pending_mystery.is_empty() and data.map[area].next.has(destination)


func move_to(destination: String) -> bool:
	if not can_move(destination):
		return false
	var room_name: String = data.map[destination].name
	if not training:
		var gain := travel_gain()
		distance += gain
		_record("%s 도착 · 도망 여유 +%d" % [room_name, gain])
	else:
		_record("QA · %s 도착" % room_name)
	area = destination
	steps += 1
	trail.append(area)
	if distance <= 0:
		_lose("pursuit")
	else:
		_enter_room()
	return true


func can_treat(side: String, part: String) -> bool:
	if phase != "route" or data.map[area].type != "rest" or rest_finished or not stair_treatment.is_empty() or distance <= 1:
		return false
	if side not in party_sides() or part not in PARTS:
		return false
	var wound: Dictionary = get(side).body[part]
	return wound.hp > 0 and wound.hp < wound.max


func treat_at_stairs(side: String, part: String) -> bool:
	if not can_treat(side, part):
		return false
	var actor: Dictionary = get(side)
	var recovered := _heal_part(actor, part, 2)
	distance -= 1
	stair_treatment = {"area": area, "name": actor.name, "target": part, "recovered": recovered}
	rest_finished = true
	_record("%s %s 내구도 +%d · 도망 여유 −1" % [actor.name, data.parts[part], recovered])
	return true


func finish_rest() -> bool:
	if phase != "route" or data.map[area].type != "rest" or rest_finished:
		return false
	rest_finished = true
	_record("휴식을 마쳤어요.")
	return true


func _heal_part(actor: Dictionary, part: String, amount: int) -> int:
	var wound: Dictionary = actor.body[part]
	var recovered := mini(amount, wound.max - wound.hp)
	wound.hp += recovered
	actor.hp = mini(actor.maxHp, actor.hp + recovered)
	return recovered


func shop_targets(id: String) -> Dictionary:
	var targets := {}
	for side: String in ["player"] + COMPANION_SIDES:
		var actor: Dictionary = get(side)
		if actor.is_empty() or down(actor):
			continue
		if id == "tonic" and actor.hp < actor.maxHp:
			targets[side] = "%s · %d/%d HP" % [actor.name, actor.hp, actor.maxHp]
		elif id == "bandage":
			for part: String in PARTS:
				var wound: Dictionary = actor.body[part]
				if wound.hp > 0 and wound.hp < wound.max:
					targets[side + ":" + part] = "%s · %s %d → %d/%d" % [
						actor.name, data.parts[part], wound.hp, mini(wound.max, wound.hp + int(data.shopOffers.bandage.amount)), wound.max]
	return targets


func shop_issue(id: String) -> String:
	if shop_purchases.has(id):
		return "구입 완료"
	if (id == "oil" and lantern_oil) or (id == "lockpicks" and lockpicks):
		return "보유 중"
	var offer: Dictionary = data.shopOffers[id]
	if coins < int(offer.price):
		return "동전 %d 필요" % int(offer.price)
	if id in ["bandage", "tonic"] and shop_targets(id).is_empty():
		return "회복할 대상 없음"
	return ""


func buy_shop_offer(id: String, target := "") -> bool:
	if phase != "route" or data.map[area].type != "shop" or not data.shopOffers.has(id) or not shop_issue(id).is_empty():
		return false
	if id in ["bandage", "tonic"] and not shop_targets(id).has(target):
		return false
	var offer: Dictionary = data.shopOffers[id]
	match id:
		"shortcut": distance += int(offer.amount)
		"oil": lantern_oil = true
		"lockpicks": lockpicks = true
		"bandage":
			var parts := target.split(":")
			_heal_part(get(parts[0]), parts[1], int(offer.amount))
		"tonic":
			var actor: Dictionary = get(target)
			actor.hp = mini(actor.maxHp, actor.hp + int(offer.amount))
	coins -= int(offer.price)
	shop_purchases[id] = true
	_record("암시장 · %s 구입 · 동전 −%d" % [offer.name, int(offer.price)])
	return true


func mystery_distance() -> int:
	if pending_mystery == "cache" and lockpicks:
		return 0
	return int(data.mysteryEvents[pending_mystery].distance)


func mystery_issue() -> String:
	if distance + mystery_distance() <= 0:
		return "도망 여유 부족"
	if coins + int(data.mysteryEvents[pending_mystery].coins) < 0:
		return "동전 부족"
	return ""


func resolve_mystery(take: bool) -> bool:
	if phase != "route" or pending_mystery.is_empty():
		return false
	if take:
		if not mystery_issue().is_empty():
			return false
		var event: Dictionary = data.mysteryEvents[pending_mystery]
		var change := mystery_distance()
		distance += change
		coins += int(event.coins)
		mystery_result = "%s · 도망 여유 %+d · 동전 %+d" % [event.name, change, int(event.coins)]
		if pending_mystery == "cache":
			lockpicks = false
		_record(mystery_result)
	else:
		_record("%s · 지나침" % data.mysteryEvents[pending_mystery].name)
	pending_mystery = ""
	return true


func _record(message: String) -> void:
	journal.push_front(message)
	if journal.size() > 24:
		journal.pop_back()


func _record_combat_event(event: Dictionary) -> void:
	var source: String = get(event.from).name
	var target: String = get(event.side).name
	var name: String = cards[event.card].name
	var parts: PackedStringArray = []
	for part: String in event.targets:
		parts.append(data.parts[part])
	var place := "%s %s" % [target, "·".join(parts)] if not parts.is_empty() else target
	match String(event.type):
		"hit":
			if event.get("training_override", false):
				source = "QA"
			if event.get("gateBlock", false):
				_record("%s · %s 철문에 막힘" % [source, name])
				return
			var outcomes: PackedStringArray = []
			if event.dealt:
				outcomes.append("피해 %d" % event.dealt)
			if event.blocked:
				outcomes.append("막음 %d" % event.blocked)
			if event.get("removed", 0):
				outcomes.append("가드 −%d" % event.removed)
			if event.get("defeated", false):
				outcomes.append("쓰러짐")
			_record("%s → %s · %s" % [source, place, " · ".join(outcomes)])
		"guard":
			_record("%s · 가드 +%d" % [place, event.added])
		"heal":
			_record("%s · 내구도 +%d" % [place, event.recovered])
		"setup":
			_record("%s · %s" % [source, name])


func exclusive(card: Dictionary) -> bool:
	return card.has("character") or card.has("weapon")


func _fits(card: Dictionary, actor: Dictionary) -> bool:
	return card.get("character", actor.kind) == actor.kind and card.get("weapon", actor.weapon) == actor.weapon


func rear_ally(side: String) -> String:
	for i in range(formation.size() - 1, formation.find(side), -1):
		var target = formation[i]
		if target != null and not down(get(target)):
			return target
	return ""


func skill_available(id: String, side: String) -> bool:
	return skill_issue(id, side).is_empty()


func skill_issue(id: String, side: String) -> String:
	var card: Dictionary = cards[id]
	if side not in party_sides():
		return "동료 이탈"
	if card.has("ranks") and not card.ranks.has(float(formation.find(side))):
		return "위치 제한"
	if card.get("target") == "rear" and rear_ally(side).is_empty():
		return "후열 아군 없음"
	if card.has("part") and condition(get(side), card.part) == "lost":
		return "%s 결손" % data.parts[card.part]
	return ""


func skill_conditions_met(id: String, side: String) -> bool:
	return _battle.conditions_met(id, side)


func _roll_rewards() -> void:
	var gained: Array[String] = []
	var ready: Array[String] = []
	var upgrades: Array[String] = []
	var allies := party_sides()
	for id: String in cards:
		var card: Dictionary = cards[id]
		var owners := allies.filter(func(side): return _fits(card, get(side)))
		if owners.is_empty():
			continue
		if levels.has(id) and int(levels[id]) < int(data.maxSkillLevel):
			upgrades.append(id)
		elif card.get("reward", false) and not levels.has(id):
			gained.append(id)
			if owners.any(func(side): return skill_available(id, side)):
				ready.append(id)
	var random := Random.new(JSON.stringify(["reward", seed, area]))
	var learned := _draw_reward(gained if ready.is_empty() else ready, true, random)
	var upgraded := _draw_reward(upgrades, true, random)
	var personal := 0
	for id in [learned, upgraded]:
		if not id.is_empty():
			rewards.append(id)
			personal += int(exclusive(cards[id]))
	var remaining := gained + upgrades
	for id in rewards:
		remaining.erase(id)
	var extra := _draw_reward(remaining, personal < 2, random)
	if not extra.is_empty():
		rewards.append(extra)


func _draw_reward(ids: Array[String], prefer_exclusive: bool, random: RefCounted) -> String:
	if ids.is_empty():
		return ""
	var candidates := ids.filter(func(id): return exclusive(cards[id]) == prefer_exclusive)
	if candidates.is_empty():
		candidates = ids
	var tiers: Array[Dictionary] = []
	var total := 0
	for rarity in ["common", "uncommon", "rare"]:
		var choices := candidates.filter(func(id): return cards[id].get("rarity", "common") == rarity)
		if not choices.is_empty():
			var weight := int(data.rarities[rarity].weight)
			tiers.append({"weight": weight, "choices": choices})
			total += weight
	var roll: float = random.real() * total
	for tier in tiers:
		roll -= tier.weight
		if roll < 0:
			return tier.choices[floori(random.real() * tier.choices.size())]
	return ""
