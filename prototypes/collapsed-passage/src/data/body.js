// 신체 부위 이름, 상태 이름, 부위별 효과 설명
// 호출할 때마다 새 객체를 만든다. 판마다 값을 바꿔 시험하는 QA 도구가 서로 영향을 주지 않게 하기 위해서다.
export function createBodyData(){
  const parts = {head:"머리", eyes:"눈", arms:"팔", chest:"가슴", belly:"배", legs:"다리"};
  const labels = {healthy:"정상", injured:"부상", lost:"결손"};
  const effects = {
    head:"결손 시 사망",
    eyes:"부상 시 행동 예고가 가려짐 · 결손 시 내 가드도 가려짐",
    arms:"부상 시 팔 기술의 위력 감소 · 결손 시 사용 불가",
    chest:"가슴 결손 시 철문 방패 사용 불가",
    belly:"부상 시 받는 회복량 절반 · 결손 시 전투 중 회복 불가",
    legs:"이동 시 얻는 도망 여유가 부상 시 +1, 결손 시 +0"
  };
  return {parts, labels, effects};
}
