// 가드가 막은 피해를 뺀 뒤 부위에 남은 내구도만큼만 피해를 준다.
// critical은 카드의 부위 보너스(bonusDamage) 중 실제로 들어간 양이다.
export function resolveHitDamage(durability, effectiveGuard, damage, bonusDamage = 0){
  const blocked = Math.min(damage, effectiveGuard);
  const dealt = Math.min(durability, damage - blocked);
  const critical = bonusDamage > 0 ? dealt - Math.min(durability, Math.max(0, damage - bonusDamage - effectiveGuard)) : 0;
  return {blocked, dealt, critical};
}
