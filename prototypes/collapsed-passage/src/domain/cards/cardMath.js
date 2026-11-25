// 카드 위력은 사용 부위가 정상일 때 보너스를 받는다.
export function cardPower(card, actor){
  return card.power + (card.part && actor.condition(card.part) === "healthy" ? (card.bonus ?? 0) : 0);
}

// 관통형(aim)과 가드 제거형(break)은 카드에 적힌 피해를, 강타형은 위력을 피해로 쓴다.
export function attackDamage(card, id, amount){
  const effect = card.effect || id;
  return card.hitPower ?? (effect === "aim" ? 2 : effect === "break" ? 1 : amount);
}
