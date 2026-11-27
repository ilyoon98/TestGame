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

// Excel IDs retain their existing portraits, draft order, and fixed encounters after renames.
const crewPresentation = [
  [1001, "naru", "⛨"], [1002, "ian", "✳"], [1008, "yul", "↗"], [1014, "seol", "⌁"], [1015, "jin", "⌘"], [1020, "onha", "◇"],
  [1003, "hae"], [1004, "tae"], [1009, "miru"], [1016, "ryeon"], [1021, "bae"], [1010, "siwon"], [1017, "yeon"], [1005, "dam"],
  [1022, "seo"], [1006, "eun"], [1011, "rok"], [1012, "garam"], [1023, "dohwa"], [1018, "ho"], [1013, "bit"], [1024, "sol"],
  [1007, "baek"], [1019, "jun"],
];
const crewAppearance = new Map(crewPresentation.map(([sheetId, id, icon], order) => {
  const spriteIndex = order - 6;
  const portrait = spriteIndex < 0 ? {} : {
    portraitSheet: spriteIndex < 9 ? "crew-expansion-a" : "crew-expansion-b",
    portraitCell: spriteIndex % 9,
  };
  return [sheetId, { order, id, icon, ...portrait }];
}));

const crewCatalog = workbookCrew.map((unit) => {
  const { order, ...appearance } = crewAppearance.get(unit.sheetId) ?? { id: String(unit.sheetId), icon: "✦", order: Infinity };
  return { order, unit: { ...unit, ...appearance, type: unit.skills[0].type, affinity: unit.skills[0].affinity } };
}).sort((a, b) => a.order === b.order ? a.unit.sheetId - b.unit.sheetId : a.order - b.order)
  .map(({ unit }) => unit);
