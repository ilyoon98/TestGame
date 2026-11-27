"use strict";

const crewTeams = [
  { name: "Battle 전투팀", stat: "clashPower", label: "합 위력", values: [1, 2] },
  { name: "Omega 서포트 팀", stat: "headsBonus", label: "앞면 확률", unit: "%p", values: [5, 10] },
  { name: "Before 사전 준비 팀", stat: "openingPower", label: "첫 라운드 기본 위력", values: [1, 2] },
  { name: "Detective 추적팀", stat: "mark", label: "첫 적중 표식 추가 피해", values: [1, 2] },
  { name: "Nadir 뒷정리 팀", stat: "finishDamage", label: "체력 절반 이하 적 추가 피해", values: [2, 3] },
  { name: "Clear 암살팀", stat: "followUpPower", label: "일방 공격 기본 위력", values: [1, 2] },
  { name: "zenith 지원팀", stat: "guard", label: "전투 시작 보호막", values: [3, 5] },
  { name: "Alfa 간부", stat: "commandLevel", label: "공격·방어 레벨", values: [2, 4] },
];
const crewAttackTypes = { slash: "참격", pierce: "관통", blunt: "타격" };
const crewAffinities = { steam: "증기", frost: "서리", current: "전류" };

// Local rows fill in until the matching IDs are added to Skill.xlsx.
const localCrew = [
  {
    sheetId: 1025, name: "브린", affiliation: "Before 사전 준비 팀", cost: 2,
    maxHp: 28, level: 20, attack: 7, armor: 3, spirit: 0, clashPower: 0,
    typeResists: { blunt: 0.75, slash: 1.25 }, affinityResists: { steam: 0.75, frost: 1.25 },
    animal: "산토끼", weapon: "신호 깃발", sets: ["affiliation", "type", "animal", "weapon"],
    artReference: "자기 키보다 큰 청록색 군기를 양손으로 다루는 산토끼 수인 기수.",
    skills: [
      { name: "기수의 버팀", type: "blunt", affinity: "steam", basePower: 4, coinCount: 2, coinPower: 2, clashBonus: 1 },
      { name: "교차 신호", type: "blunt", affinity: "frost", basePower: 5, coinCount: 2, coinPower: 3, mark: 2 },
      { name: "청기 선도", type: "slash", affinity: "steam", basePower: 6, coinCount: 3, coinPower: 3, followUpDamage: 2 },
    ],
  },
  {
    sheetId: 1026, name: "오티", affiliation: "Omega 서포트 팀", cost: 3,
    maxHp: 30, level: 21, attack: 7, armor: 4, spirit: 0, clashPower: 0,
    typeResists: { pierce: 0.75, blunt: 1.25 }, affinityResists: { current: 0.75, steam: 1.25 },
    animal: "너구리", weapon: "전자장비", sets: ["affiliation", "type", "affinity", "weapon"],
    artReference: "투명 고글과 계전기 점검기를 쓰는 너구리 수인 정비 훈련생.",
    skills: [
      { name: "접점 점검", type: "blunt", affinity: "current", basePower: 4, coinCount: 2, coinPower: 2, mark: 1 },
      { name: "차단 계전", type: "blunt", affinity: "current", basePower: 5, coinCount: 2, coinPower: 3, guard: 5 },
      { name: "우회 송전", type: "pierce", affinity: "current", basePower: 5, coinCount: 3, coinPower: 4, heal: 5 },
    ],
  },
];

const crewProfiles = new Map([
  [1001, { age: 19, gender: "남성" }], [1002, { age: 24, gender: "남성" }],
  [1003, { age: 17, gender: "여성" }], [1004, { age: 18, gender: "남성" }],
  [1005, { age: 23, gender: "여성" }], [1006, { age: 26, gender: "남성" }],
  [1007, { age: 19, gender: "남성" }], [1008, { age: 16, gender: "남성" }],
  [1009, { age: 17, gender: "여성" }], [1010, { age: 18, gender: "여성" }],
  [1011, { age: 29, gender: "남성" }], [1012, { age: 32, gender: "여성" }],
  [1013, { age: 17, gender: "여성" }], [1014, { age: 19, gender: "여성" }],
  [1015, { age: 23, gender: "남성" }], [1016, { age: 25, gender: "남성" }],
  [1017, { age: 24, gender: "여성" }], [1018, { age: 29, gender: "남성" }],
  [1019, { age: 26, gender: "남성" }], [1020, { age: 18, gender: "남성" }],
  [1021, { age: 19, gender: "여성" }], [1022, { age: 29, gender: "남성" }],
  [1023, { age: 24, gender: "여성" }], [1024, { age: 25, gender: "남성" }],
  [1025, { age: 15, gender: "남성" }], [1026, { age: 17, gender: "남성" }],
]);

// The gallery and game share the original art by workbook ID. The two crop fields are for small in-game portraits.
const crewPortraits = new Map([
  [1001, ["assets/naru-recruit.png", "195%", "67% top"]],
  [1002, ["concept-art/1002-ian.png", "225%", "55% 8%"]],
  [1003, ["concept-art/1003-hae.png", "230%", "48% 11%"]],
  [1004, ["concept-art/1004-tae.png", "212%", "55% 9%"]],
  [1005, ["concept-art/1005-dam.png", "215%", "50% 14%"]],
  [1006, ["concept-art/1006-eun.png", "225%", "59% 9%"]],
  [1007, ["assets/baek-recruit.png", "210%", "45% 7%"]],
  [1008, ["concept-art/1008-yul.png", "225%", "45% 9%"]],
  [1009, ["assets/miru-mouse.png", "140%", "50% 7%"]],
  [1010, ["concept-art/1010-siwon.png", "210%", "60% 15%"]],
  [1011, ["concept-art/1011-rok.png", "240%", "48% 4%"]],
  [1012, ["concept-art/1012-garam.png", "230%", "56% 6%"]],
  [1013, ["concept-art/1013-bit.png", "210%", "56% 6%"]],
  [1014, ["concept-art/1014-seol.png", "185%", "43% 4%"]],
  [1015, ["concept-art/1015-jin.png", "240%", "48% 11%"]],
  [1016, ["concept-art/1016-ryeon.png", "220%", "52% 4%"]],
  [1017, ["concept-art/1017-yeon.png", "220%", "54% 4%"]],
  [1018, ["concept-art/1018-ho.png", "215%", "50% 5%"]],
  [1019, ["assets/jun-recruit.png", "210%", "50% 4%"]],
  [1020, ["concept-art/1020-onha.png", "204%", "50% 11%"]],
  [1021, ["concept-art/1021-bae.png", "200%", "51% 5%"]],
  [1022, ["concept-art/1022-seo.png", "205%", "48% 12%"]],
  [1023, ["concept-art/1023-dohwa.png", "210%", "50% 7%"]],
  [1024, ["concept-art/1024-sol.png", "245%", "50% 9%"]],
  [1025, ["concept-art/trainees/brin.png", "330%", "79% 50%"]],
  [1026, ["concept-art/trainees/otti.png", "150%", "50% 4%"]],
]);

function crewPortrait(unit) {
  const preset = crewPortraits.get(unit?.sheetId);
  if (!unit?.portraitSource) return preset;
  return [unit.portraitSource, preset?.[1] ?? "200%", preset?.[2] ?? "50% top"];
}

// Excel IDs retain draft order and fixed encounters after renames.
const crewPresentation = [
  [1001, "naru", "⛨"], [1002, "ian", "✳"], [1008, "yul", "↗"], [1014, "seol", "⌁"], [1015, "jin", "⌘"], [1020, "onha", "◇"],
  [1003, "hae"], [1004, "tae"], [1009, "miru"], [1016, "ryeon"], [1021, "bae"], [1010, "siwon"], [1017, "yeon"], [1005, "dam"],
  [1022, "seo"], [1006, "eun"], [1011, "rok"], [1012, "garam"], [1023, "dohwa"], [1018, "ho"], [1013, "bit"], [1024, "sol"],
  [1007, "baek"], [1019, "jun"], [1025, "brin", "⚑"], [1026, "otti", "⌁"],
];
const crewAppearance = new Map(crewPresentation.map(([sheetId, id, icon], order) => [sheetId, { order, id, icon }]));

const workbookIds = new Set(workbookCrew.map(({ sheetId }) => sheetId));
const crewRows = [...workbookCrew, ...localCrew.filter(({ sheetId }) => !workbookIds.has(sheetId))];
const crewCatalog = crewRows.map((unit) => {
  const { order, ...appearance } = crewAppearance.get(unit.sheetId) ?? { id: String(unit.sheetId), icon: "✦", order: Infinity };
  return { order, unit: {
    ...unit, ...crewProfiles.get(unit.sheetId), ...appearance,
    type: unit.skills[0].type, affinity: unit.skills[0].affinity,
  } };
}).sort((a, b) => a.order === b.order ? a.unit.sheetId - b.unit.sheetId : a.order - b.order)
  .map(({ unit }) => unit);
