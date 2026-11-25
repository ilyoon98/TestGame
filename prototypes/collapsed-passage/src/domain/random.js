// 시드 난수. 같은 시드는 같은 수열을 만든다. 지도·보상·? 방 사건이 이것으로 재현된다.
// 도메인 코드는 Math.random을 직접 쓰지 않고, 이 함수나 호출하는 쪽이 넘긴 random을 쓴다.
export function seededRandom(seed){
  let state = 2166136261;
  for(const letter of seed) state = Math.imul(state ^ letter.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random){
  const result = [...items];
  for(let i = result.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
