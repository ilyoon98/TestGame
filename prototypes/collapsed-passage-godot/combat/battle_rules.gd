extends RefCounted
## Simulates one encounter on the same 100 ms clock as the web first stage.

const PARTS := ["head", "eyes", "arms", "chest", "belly", "legs"]

var _state: WeakRef
var run: RefCounted:
	get: return _state.get_ref()
var _plan: Array = []
var _index := 0
var _bellboy := false
## Milliseconds between enemy actions; upper-floor foes set their own pace in data/floors.json.
var _interval := 0
## Extra damage on every enemy attack; upper-floor foes set it in data/floors.json.
var _might := 0
var _staggered := false
var _traits: Dictionary = {}
var _used: Dictionary = {}
var _tactics := {"blocked": {}, "selfHealed": {}, "aim": {}}


func _init(state: RefCounted) -> void:
	_state = weakref(state)
	_bellboy = run.enemy.kind == "bellboy"
	for pattern: Array in run.data.foes[run.enemy.kind].patterns:
		_plan.append_array(pattern)
	_interval = int(run.data.foes[run.enemy.kind].get("interval", run.data.timing.enemyInterval))
	_interval = maxi(1500, _interval - int(run.enemy.get("haste", 0)))
	run.enemy_ready_at = _interval
	_might = int(run.data.foes[run.enemy.kind].get("might", 0)) + int(run.enemy.get("might", 0))
	_traits = run.trait_counts()
	for side: String in run.party_sides():
		var actor: Dictionary = run.get(side)
		run.clear_defense(actor)
		for id: String in run.side_loadout(side):
			var cooldown: int = run.cooldown(id)
			run.slots.append({"id": id, "side": side, "cooldown": cooldown, "readyAt": cooldown})
	if run.lantern_oil:
		var front: Dictionary = run.get(run.party_sides().front())
		var part := "chest" if front.body.chest.hp > 0 else "head"
		front.body[part].guard += int(run.data.shopOffers.oil.amount)
		run.lantern_oil = false


func gate_phase() -> String:
	if not _bellboy:
		return ""
	if not run.training_enemy_acts:
		return "closed"
	if run.elapsed >= run.enemy_ready_at - int(run.data.bellboyTiming.windup):
		return "bell"
	return "staggered" if _staggered else "closed"


func _gate_closed() -> bool:
	return gate_phase() in ["closed", "bell"]


func step() -> Dictionary:
	if run.enemy.get("infinite", false) and run.enemy.body.head.hp == 0:
		run.restore_fighter(run.enemy)
		_tactics.erase("strippedPart")
	var skill := _ready_slot()
	if skill.is_empty() and (not run.training_enemy_acts or run.elapsed < run.enemy_ready_at):
		var tick := int(run.data.timing.tick)
		run.elapsed += tick
		run.combat_time += tick
		if not run.training and run.elapsed % int(run.data.timing.pursuit) == 0:
			run.distance -= 1
			run.finish_battle()
			return {"clockOnly": true}
		skill = _ready_slot()
	if not skill.is_empty():
		skill.readyAt = run.elapsed + skill.cooldown
		_execute_ally(skill.id, skill.side)
		run.finish_battle()
		return {"id": skill.id, "actor": skill.side}
	if run.training_enemy_acts and run.elapsed >= run.enemy_ready_at:
		var action := intent()
		if action.get("intercept", false):
			_tactics.erase("intercept")
		run.enemy_ready_at += _interval
		if _bellboy:
			_staggered = true
		_apply(action.id, "enemy", action.get("side", "enemy"), action.targets)
		_index = (_index + 1) % _plan.size()
		run.finish_battle()
		return {"id": action.id, "actor": "enemy"}
	return {"clockOnly": true}


func intent() -> Dictionary:
	if not run.training_enemy_acts:
		return {}
	var plan: Array = _plan[_index]
	var id: String = plan[0]
	var targets := plan.slice(1)
	if id == "aid":
		var wound := _weakest_wound(run.enemy) if _heal_value(run.enemy, 2) > 0 else ""
		if not wound.is_empty():
			return {"id": id, "targets": [wound]}
		id = "guard"
		targets = ["head"]
	var side := _enemy_side(id)
	var card: Dictionary = run.cards[id]
	if card.has("part") and run.condition(run.enemy, card.part) == "lost":
		id = "strike" if card.type == "attack" else "guard"
		targets.resize(1)
	if run.cards[id].type == "defense":
		targets = targets.filter(func(part): return run.enemy.body[part].hp > 0)
		if targets.is_empty():
			id = "strike"
			side = _enemy_side(id)
			targets = ["chest"]
		elif id == "split" and targets.size() == 1:
			id = "guard"
	if run.cards[id].type == "attack":
		var target := _active_target(run.get(side), targets[0])
		var intercept: String = _tactics.get("intercept", "")
		if id == "aim" and intercept in run.party_sides() and run.formation.find(intercept) < run.formation.find(side) \
				and run.get(intercept).body[target].hp > 0:
			return {"id": id, "side": intercept, "targets": [target], "intercept": true}
		return {"id": id, "side": side, "targets": [target]}
	return {"id": id, "targets": targets}


func intent_power(plan: Dictionary) -> int:
	var id: String = plan.id
	var amount := _power(id, run.enemy)
	match run.cards[id].type:
		"attack":
			var boss_bonus := int(run.data.bellboyTiming.damageBonus) if _bellboy and id == "heavy" else 0
			var damage := (_base_damage(id, amount) + boss_bonus + _might) * int(run.training_enemy_damage)
			return maxi(0, damage - int(_tactics.get("weaken", 0)))
		"skill": return _heal_value(run.enemy, amount)
		_: return 1 if id == "counter" else amount


func _enemy_side(id: String) -> String:
	var allies: Array = run.party_sides()
	if allies.is_empty():
		return "player"
	return allies.back() if id == "aim" else allies.front()


func _power(id: String, actor: Dictionary) -> int:
	var card: Dictionary = run.cards[id]
	var bonus := 0
	if card.has("part") and run.condition(actor, card.part) == "healthy":
		bonus = int(card.get("bonus", 0))
	return int(card.power) + bonus


func _base_damage(id: String, amount: int) -> int:
	var card: Dictionary = run.cards[id]
	match card.get("effect", id):
		"aim": return int(card.get("hitPower", 2))
		"break": return int(card.get("hitPower", 1))
		_: return int(card.get("hitPower", amount))


func _intact(actor: Dictionary) -> Array:
	return PARTS.filter(func(part): return actor.body[part].hp > 0)


func _wounds(actor: Dictionary) -> Array:
	return PARTS.filter(func(part): return actor.body[part].hp > 0 and actor.body[part].hp < actor.body[part].max)


func _weakest_wound(actor: Dictionary) -> String:
	var lowest := INF
	var target := ""
	for part: String in _wounds(actor):
		var value: int = actor.body[part].hp + actor.body[part].guard
		if value < lowest:
			lowest = value
			target = part
	return target


func _active_target(actor: Dictionary, desired: String) -> String:
	if actor.body[desired].hp > 0:
		return desired
	return "chest" if actor.body.chest.hp > 0 else "head"


func _ready_slot() -> Dictionary:
	var ready: Array[Dictionary] = []
	for slot: Dictionary in run.slots:
		if slot.readyAt > run.elapsed or not run.skill_available(slot.id, slot.side):
			continue
		if conditions_met(slot.id, slot.side):
			ready.append(slot)
	ready.sort_custom(_earlier)
	return {} if ready.is_empty() else ready[0]


func conditions_met(id: String, side: String) -> bool:
	var card: Dictionary = run.cards[id]
	if card.target == "heal":
		return not _heal_targets(id, side).is_empty()
	if card.get("effect") == "setup":
		return _setup_ready(card, side)
	if card.has("guardMode"):
		return not _guard_plan(id, side).is_empty()
	return true


func _earlier(a: Dictionary, b: Dictionary) -> bool:
	if a.readyAt != b.readyAt:
		return a.readyAt < b.readyAt
	var attacks: bool = run.cards[a.id].type == "attack"
	if attacks != (run.cards[b.id].type == "attack"):
		return not attacks
	if a.cooldown != b.cooldown:
		return a.cooldown > b.cooldown
	return a.id < b.id


func _execute_ally(id: String, side: String) -> void:
	var card: Dictionary = run.cards[id]
	var actor: Dictionary = run.get(side)
	if card.type == "attack":
		_attack(id, side, "enemy", [])
	elif card.target == "heal":
		for plan: Dictionary in _heal_targets(id, side):
			_heal(id, side, plan.side, plan.target, plan.amount)
	elif card.get("effect") == "setup":
		_setup(card, side)
	else:
		var plan := _guard_plan(id, side)
		if plan.is_empty():
			return
		if card.get("guardMode") == "recovery":
			_tactics.erase("recovery")
		if card.has("injuredGuard"):
			for part: String in plan.targets:
				var bonus := int(card.injuredGuard) if run.condition(run.get(plan.side), part) == "injured" else 0
				_guard(id, side, plan.side, [part], _power(id, actor) + bonus)
		else:
			_guard(id, side, plan.side, plan.targets, _power(id, actor))


func _apply(id: String, from: String, side: String, targets: Array) -> void:
	var card: Dictionary = run.cards[id]
	var amount := _power(id, run.get(from))
	match card.type:
		"attack": _attack(id, from, side, targets)
		"defense": _guard(id, from, side, targets, amount)
		"skill": _heal(id, from, side, targets[0], amount)


## 장착 기술을 발동 순서대로. 동시 발동 순서(준비 시각, 공격 이외 기술, 긴 충전, ID)를 그대로 쓴다.
## 상태를 바꾸지 않으므로 화면 예고에 쓴다.
func firing_order() -> Array[String]:
	var ordered: Array[Dictionary] = run.slots.duplicate()
	ordered.sort_custom(_earlier)
	var ids: Array[String] = []
	for slot: Dictionary in ordered:
		ids.append(slot.id)
	return ids


## 방어 기술이 지금 발동하면, 예고된 적 공격이 노리는 대원·부위에서 이 카드의 가드가 피해를 실제로 막는가.
## 가드 깨기의 제거와 정밀 타격의 관통까지 센다. 상태를 바꾸지 않는다.
func guard_blocks(id: String, side: String) -> bool:
	var forecast := intent()
	if forecast.is_empty() or run.cards[forecast.id].type != "attack":
		return false
	var plan := _guard_plan(id, side)
	var target: String = forecast.targets[0]
	if plan.get("side", "") != forecast.get("side", "") or target not in plan.get("targets", []):
		return false
	var card: Dictionary = run.cards[id]
	var added := 1 if id == "counter" else _power(id, run.get(side))
	if card.has("injuredGuard") and run.condition(run.get(plan.side), target) == "injured":
		added += int(card.injuredGuard)
	if plan.side == run.party_sides().front():
		added += _trait("guard")
	var current := int(run.get(plan.side).body[target].guard)
	# 이미 걸린 가드가 같거나 크면 이 카드는 보탤 것이 없고, 피해가 0이면 막을 것도 없다.
	if added <= current or intent_power(forecast) <= 0:
		return false
	var guard := added
	var effect: String = run.cards[forecast.id].get("effect", forecast.id)
	var amount := _power(forecast.id, run.enemy)
	var removed := amount if effect == "break" else 0
	var pierce := amount if effect == "aim" else 0
	return guard - removed - pierce > 0


func _guard_plan(id: String, side: String) -> Dictionary:
	var card: Dictionary = run.cards[id]
	var mode: String = card.get("guardMode", "")
	var forecast := intent() if run.condition(run.player, "eyes") == "healthy" else {}
	var rear: bool = card.target == "rear" or mode == "rearWound"
	var recipient: String = run.rear_ally(side) if rear else side if mode.begins_with("self") else forecast.get("side", side)
	if mode == "recovery":
		var entry: Dictionary = _tactics.get("recovery", {})
		if not entry.is_empty() and entry.side in run.party_sides() and run.condition(run.get(entry.side), entry.target) == "healthy":
			return {"side": entry.side, "targets": [entry.target]}
		return {}
	if mode == "wounded":
		var lowest := INF
		var result := {}
		for ally_side: String in run.party_sides():
			var ally: Dictionary = run.get(ally_side)
			for part: String in _wounds(ally):
				if run.condition(ally, part) == "injured" and ally.body[part].hp < lowest:
					lowest = ally.body[part].hp
					result = {"side": ally_side, "targets": [part]}
		if not result.is_empty():
			return result
		var front: String = run.party_sides().front()
		return {"side": front, "targets": [_active_target(run.get(front), "chest")]}
	if recipient.is_empty():
		return {}
	var ally: Dictionary = run.get(recipient)
	var incoming: String = forecast.targets[0] if forecast.get("side", "") == recipient else ""
	var targets: Array
	match mode:
		"selfHead": targets = ["head"]
		"selfChest": targets = ["chest"]
		"selfLegs": targets = ["legs"]
		"selfVitals": targets = ["head", "chest"]
		"rearWound":
			var wound := _largest_wound(ally, true)
			if wound.is_empty():
				return {}
			targets = [wound if incoming.is_empty() else incoming]
		_:
			var first := _active_target(ally, card.get("guardFallback", "head") if incoming.is_empty() else incoming)
			targets = [first]
			if card.get("effect", id) == "split":
				var other := _intact(ally)
				other.erase(first)
				if not other.is_empty():
					targets.append("chest" if rear and other.has("chest") else other.front())
	targets = targets.filter(func(part): return ally.body[part].hp > 0)
	return {} if targets.is_empty() else {"side": recipient, "targets": targets}


func _guard(id: String, from: String, side: String, targets: Array, amount: int) -> void:
	var actor: Dictionary = run.get(side)
	var added := 1 if id == "counter" else amount
	if from != "enemy" and side == run.party_sides().front():
		added += _take_trait("guard")
	for part: String in targets:
		actor.body[part].guard = maxi(actor.body[part].guard, added)
	if run.cards[id].get("effect", id) == "counter":
		actor.counter = {"id": id, "target": targets[0], "damage": amount}
	run.queue_event({"type": "guard", "card": id, "from": from, "side": side, "targets": targets, "added": added})


func _heal_value(actor: Dictionary, amount: int) -> int:
	match run.condition(actor, "belly"):
		"lost": return 0
		"injured": return floori(amount / 2.0)
		_: return amount


func _largest_wound(actor: Dictionary, injured_only := false) -> String:
	var target := ""
	var missing := 0
	for part: String in _wounds(actor):
		var state: Dictionary = actor.body[part]
		if (not injured_only or run.condition(actor, part) == "injured") and state.max - state.hp > missing:
			target = part
			missing = state.max - state.hp
	return target


func _heal_targets(id: String, side: String) -> Array:
	var card: Dictionary = run.cards[id]
	var mode: String = card.get("healMode", "")
	var candidates := []
	for patient: String in run.party_sides():
		if (mode == "self" and patient != side) or (mode == "others" and patient == side):
			continue
		var ally: Dictionary = run.get(patient)
		for part: String in _wounds(ally):
			var state: Dictionary = ally.body[part]
			var injured: bool = run.condition(ally, part) == "injured"
			var vital := part in ["head", "chest"]
			if (mode == "limbs" and (not injured or part not in ["arms", "legs"])) or (mode == "injured" and not injured):
				continue
			var amount := 2 if mode == "vitals" and not vital else _power(id, run.get(side))
			var healing := _heal_value(ally, amount)
			if healing == 0:
				continue
			var priority := 0
			if mode == "vitals" and vital:
				priority = 100 - state.hp
			elif (mode == "limbs" and (state.hp + healing) * 2 > state.max) or (mode == "self" and injured):
				priority = 100
			candidates.append({"side": patient, "target": part, "amount": amount, "priority": priority,
				"missing": state.max - state.hp, "order": candidates.size()})
	candidates.sort_custom(func(a, b):
		if a.priority != b.priority: return a.priority > b.priority
		if a.missing != b.missing: return a.missing > b.missing
		return a.order < b.order)
	var seen := {}
	var choices := []
	for pick: Dictionary in candidates:
		if not seen.has(pick.side):
			seen[pick.side] = true
			choices.append(pick)
	if choices.size() < int(card.get("minimumPatients", 1)):
		return []
	return choices.slice(0, int(card.get("healAllies", 1)))


func _heal(id: String, from: String, side: String, target: String, amount: int) -> void:
	var actor: Dictionary = run.get(side)
	var part: Dictionary = actor.body[target]
	if part.hp == 0 or run.down(actor):
		return
	var before: String = run.condition(actor, target)
	var healing := _heal_value(actor, amount)
	var bonus := _take_trait("mage") if healing and part.hp < part.max and "mage" in run.get(from).jobs else 0
	var recovered := mini(healing + bonus, part.max - part.hp)
	part.hp += recovered
	actor.hp = mini(actor.maxHp, actor.hp + recovered)
	if side != "enemy" and recovered > 0:
		if from == side:
			_tactics.selfHealed[side] = true
		if before != run.condition(actor, target):
			_tactics.recovery = {"side": side, "target": target}
	if healing > 0:
		part.guard = maxi(part.guard, int(run.cards[id].get("healGuard", 0)))
	run.queue_event({"type": "heal", "card": id, "from": from, "side": side, "targets": [target], "recovered": recovered})


func _setup_ready(card: Dictionary, side: String) -> bool:
	match card.setup:
		"intercept": return not _tactics.has("intercept") and not run.rear_ally(side).is_empty()
		"strip": return not _gate_closed() and _intact(run.enemy).any(func(part): return run.enemy.body[part].guard > 0)
		"aim": return not _tactics.aim.has(side)
		"weaken": return not _tactics.has("weaken")
		"empower": return not _tactics.has("empower") and run.party_sides().size() > 1
		_: return false


func _setup(card: Dictionary, side: String) -> void:
	var recipient := side
	var targets := []
	var removed := 0
	match card.setup:
		"intercept": _tactics.intercept = side
		"aim": _tactics.aim[side] = int(card.power)
		"weaken":
			_tactics.weaken = int(card.power)
			recipient = "enemy"
		"empower": _tactics.empower = {"side": side, "amount": int(card.power)}
		"strip":
			var best := ""
			var thickest := -1
			for target: String in _intact(run.enemy):
				if run.enemy.body[target].guard > thickest:
					thickest = run.enemy.body[target].guard
					best = target
			removed = mini(thickest, int(card.power))
			run.enemy.body[best].guard -= removed
			_tactics.strippedPart = best
			recipient = "enemy"
			targets = [best]
	run.queue_event({"type": "setup", "card": card.id, "from": side, "side": recipient,
		"targets": targets, "removed": removed})


func _trait(id: String, key := "") -> int:
	if key.is_empty():
		key = id
	if int(_traits.get(id, 0)) < int(run.data.traitThreshold) or _used.has(key):
		return 0
	return int(run.data.traits[id].bonus)


func _take_trait(id: String, key := "") -> int:
	var bonus := _trait(id, key)
	if bonus > 0:
		_used[id if key.is_empty() else key] = true
	return bonus


func _attack(id: String, from: String, side: String, explicit: Array) -> void:
	var card: Dictionary = run.cards[id]
	var actor: Dictionary = run.get(from)
	var defender: Dictionary = run.get(side)
	var prepared := {
		"aim": int(_tactics.aim.get(from, 0)) if card.get("weapon") == "bow" and not card.has("hits") else 0,
		"recover": int(card.get("recoveryBonus", 0)) if _tactics.selfHealed.has(from) else 0,
		"retaliation": int(card.get("blockedRemoval", 0)) if _tactics.blocked.has(from) else 0,
	}
	if prepared.aim:
		_tactics.aim.erase(from)
	if prepared.recover:
		_tactics.selfHealed.erase(from)
	if prepared.retaliation:
		_tactics.blocked.erase(from)
	var gate := side == "enemy" and _gate_closed()
	var hits := int(card.get("hits", 1))
	if gate:
		hits = 1
	elif not explicit.is_empty():
		hits = mini(hits, explicit.size())
	var chosen := []
	var first_damage := 0
	for i in hits:
		if run.down(defender) or (i > 0 and card.has("followupPower") and first_damage == 0):
			break
		var target: String = explicit[i] if not explicit.is_empty() else _attack_target(id, from, chosen, i, prepared)
		if target.is_empty():
			break
		if defender.body[target].hp == 0:
			continue
		chosen.append(target)
		var request := _hit_request(id, from, target, i, prepared)
		if request.gap and not gate:
			_tactics.erase("strippedPart")
		var result := _hit(id, from, side, target, request)
		if i == 0:
			first_damage = int(result.get("dealt", 0))
	if first_damage > 0 and card.has("onHitHeal"):
		var target := _largest_wound(actor)
		if not target.is_empty():
			_heal(id, from, from, target, int(card.onHitHeal))


func _hit_request(id: String, from: String, target: String, index: int, prepared: Dictionary) -> Dictionary:
	var card: Dictionary = run.cards[id]
	var effect: String = card.get("effect", id)
	var amount := _power(id, run.get(from))
	var gap := int(card.get("stripBonus", 0)) if _tactics.get("strippedPart") == target else 0
	var boss_bonus := int(run.data.bellboyTiming.damageBonus) if _bellboy and from == "enemy" and id == "heavy" else 0
	var might := _might if from == "enemy" else 0
	var value := _base_damage(id, amount) + boss_bonus + might + int(prepared.aim + prepared.recover) + gap
	if index > 0 and card.has("followupPower"):
		value = int(card.followupPower)
	return {"damage": value, "gap": gap, "pierce": amount if effect == "aim" else 0,
		"remove": amount if effect == "break" else int(prepared.retaliation),
		"bonus": 0 if effect in ["aim", "break"] else amount - int(card.power)}


func _target_priority(order: String, actor: Dictionary, part: String) -> int:
	var injured: bool = run.condition(run.enemy, part) == "injured"
	var limb := part in ["arms", "legs"]
	var guard: int = run.enemy.body[part].guard
	match order:
		"visibleGuard": return guard if run.condition(actor, "eyes") == "healthy" else 0
		"injuredArms": return int(part == "arms" and injured)
		"wounded": return int(injured)
		"woundedLimbs": return int(limb and injured)
		"stripped": return int(_tactics.get("strippedPart") == part)
		"healthyGuardedLimbs": return guard if limb and not injured else 0
		"limbs": return int(limb)
		"unguarded": return int(guard == 0)
		"guarded": return guard
		_: return 0


func _attack_target(id: String, from: String, excluded: Array, index: int, prepared: Dictionary) -> String:
	var card: Dictionary = run.cards[id]
	var effect: String = card.get("effect", id)
	if _gate_closed():
		return "head" if effect == "aim" else "chest"
	var actor: Dictionary = run.get(from)
	var targets := _intact(run.enemy).filter(func(part): return part not in excluded)
	if targets.is_empty():
		return ""
	var scores := {}
	var highest := 0
	for target: String in targets:
		var priority := _target_priority(card.get("targetOrder", ""), actor, target)
		if priority == 0:
			priority = mini(prepared.retaliation, run.enemy.body[target].guard)
		highest = maxi(highest, priority)
		var request := _hit_request(id, from, target, index, prepared)
		var dealt := int(_evaluate_hit(id, from, "enemy", target, request).get("dealt", 0))
		var tie := mini(_power(id, actor), run.enemy.body[target].guard) if effect == "break" else int("warrior" in actor.jobs and run.condition(run.enemy, target) == "injured")
		scores[target] = Vector3i(priority, dealt, tie)
	if targets.has("head") and (highest == 0 or scores.head.x == highest) and scores.head.y >= run.enemy.body.head.hp:
		return "head"
	var best: String = "chest" if targets.has("chest") else targets.front()
	for target: String in targets:
		var a: Vector3i = scores[target]
		var b: Vector3i = scores[best]
		if a.x > b.x or (a.x == b.x and (a.y > b.y or (a.y == b.y and a.z > b.z))):
			best = target
	return best


func _evaluate_hit(id: String, from: String, side: String, target: String, request: Dictionary) -> Dictionary:
	var defender: Dictionary = run.get(side)
	if run.down(defender):
		return {}
	if side == "enemy" and _gate_closed():
		if request.pierce > 0:
			target = "head"
		else:
			return {"target": "chest", "dealt": 0, "blocked": request.damage, "gateBlock": true}
	var part: Dictionary = defender.body[target]
	if part.hp == 0:
		return {}
	var card: Dictionary = run.cards[id]
	var actor: Dictionary = run.get(from)
	var before: String = run.condition(defender, target)
	var removed := mini(part.guard, request.remove)
	var strip_bonus := int(card.get("stripFinish", 0)) if removed > 0 and removed == part.guard else 0
	var wound_bonus := 0
	if card.has("woundBonus") and before == "injured" and target in card.get("woundParts", PARTS):
		var injuries := _intact(defender).filter(func(key): return run.condition(defender, key) == "injured").size()
		if injuries >= int(card.get("minimumWounds", 0)):
			wound_bonus = int(card.woundBonus)
	var enemy_attack: bool = from == "enemy" and not request.get("training_override", false)
	var multiplier := int(run.training_enemy_damage) if enemy_attack else 1
	var weakened := int(_tactics.get("weaken", 0)) if enemy_attack and card.type == "attack" else 0
	var damage := maxi(0, (request.damage + strip_bonus + wound_bonus) * multiplier - weakened)
	var effective := maxi(0, part.guard - removed - int(request.pierce))
	var prisoner := _trait("prisoner") if removed > 0 and "prisoner" in actor.factions else 0
	var warrior := 0
	if before == "injured" and card.type == "attack" and damage + prisoner >= effective and "warrior" in actor.jobs:
		warrior = _trait("warrior", "warrior:" + from)
	var total := damage + prisoner + warrior
	var mark: Dictionary = defender.get("mark", {})
	var exposed := 0
	if mark.get("target") == target and card.type == "attack" and from != "enemy" and total > effective and mark.side != from:
		exposed = int(mark.bonus)
	var empower: Dictionary = _tactics.get("empower", {})
	var strengthened := 0
	if not empower.is_empty() and empower.side != from and from != "enemy" and side == "enemy" and card.type == "attack" and total > effective:
		strengthened = int(empower.amount)
	total += exposed + strengthened
	var blocked := mini(total, effective)
	var dealt := mini(part.hp, total - blocked)
	var critical := dealt - mini(part.hp, maxi(0, total - request.bonus * multiplier - effective)) if request.bonus > 0 else 0
	return {"target": target, "removed": removed, "blocked": blocked, "dealt": dealt, "critical": critical,
		"weakened": weakened, "prisoner": prisoner, "warrior": warrior, "exposed": exposed, "strengthened": strengthened}


func _hit(id: String, from: String, side: String, target: String, request: Dictionary) -> Dictionary:
	var result := _evaluate_hit(id, from, side, target, request)
	if result.is_empty():
		return {}
	var defender: Dictionary = run.get(side)
	target = result.target
	var event := {"type": "hit", "card": id, "from": from, "side": side, "targets": [target],
		"dealt": result.dealt, "blocked": result.blocked}
	var training_override: bool = request.get("training_override", false)
	if training_override:
		event.training_override = true
	if result.get("gateBlock", false):
		event.gateBlock = true
		run.queue_event(event)
		return event
	var part: Dictionary = defender.body[target]
	if result.weakened:
		_tactics.erase("weaken")
	if result.prisoner:
		_take_trait("prisoner")
	if result.warrior:
		_take_trait("warrior", "warrior:" + from)
	if result.strengthened:
		_tactics.erase("empower")
	part.guard -= result.removed + result.blocked
	if result.removed and side == "enemy":
		_tactics.strippedPart = target
	part.hp -= result.dealt
	if not defender.get("infinite", false):
		defender.hp = maxi(0, defender.hp - result.dealt)
	if not training_override and from == "enemy" and side != "enemy" and result.blocked:
		_tactics.blocked[side] = true
	var defeated: bool = run.down(defender)
	var mark: Dictionary = defender.get("mark", {})
	if result.exposed or (not mark.is_empty() and (defeated or (part.hp == 0 and mark.target == target))):
		defender.erase("mark")
	var card: Dictionary = run.cards[id]
	if card.has("mark") and side == "enemy" and result.dealt and not defeated and part.hp > 0:
		defender.mark = {"target": target, "side": from, "bonus": int(card.mark)}
	if part.hp == 0:
		part.guard = 0
		if defender.counter.get("target") == target:
			defender.counter = {}
		if side == "enemy" and _tactics.get("strippedPart") == target:
			_tactics.erase("strippedPart")
	event.merge({"removed": result.removed, "critical": result.critical, "defeated": defeated})
	run.queue_event(event)
	if defeated:
		run.remove_fallen(side)
	elif not training_override and defender.counter.get("target") == target:
		var counter: Dictionary = defender.counter
		defender.counter = {}
		_hit(counter.id, side, from, "chest", {"damage": counter.damage, "pierce": 0,
			"remove": 0, "bonus": counter.damage - int(run.cards[counter.id].power)})
	return event


func training_hit(side: String, part: String, damage: int) -> void:
	_hit("strike", "enemy", side, part, {"damage": damage, "pierce": run.get(side).body[part].guard,
		"remove": 0, "bonus": 0, "training_override": true})
