import { calculateCheck } from './check-probability.mjs';
import { forecastRoster } from './roster-forecast.mjs';

const portraitSource = 'https://limbuscompany.wiki.gg/wiki/Bygone_Days';
const extractedChecks = 'https://raw.githubusercontent.com/PGGB/limbus-company-data/main/Assets/Resources_moved/StaticData/static-data/abnormality-event/mirror-dungeon-personality-choice-event.json';
const singingMachineRule = {
  id: 'dusk-of-amber',
  favoredTarget: 14,
  ordinaryTarget: 28,
  scoreModifiers: [{ subject: 'faction', key: '로보토미 본사', amount: 8 }],
  source: 'https://limbuscompany.wiki.gg/wiki/Harmony',
};

export const mirrorEvents = {
  'rising-ashes': {
    name: '밀려오는 재',
    choices: [
      {
        label: '안개 속으로 걸어 들어간다.',
        kind: 'check',
        favoredAffinities: ['분노', '색욕'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 8, ordinaryTarget: 16, source: 'https://limbuscompany.wiki.gg/wiki/Rising_Ashes' }],
      },
      {
        label: '안개의 눈을 바라본다.',
        kind: 'check',
        favoredAffinities: ['분노', '질투'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 7, ordinaryTarget: 14, source: 'https://limbuscompany.wiki.gg/wiki/Rising_Ashes' }],
      },
    ],
  },
  sleepyhead: {
    name: '꾸벅이',
    choices: [
      {
        label: '수감자의 피를 줘서 채운다.',
        kind: 'check',
        favoredAffinities: ['색욕', '우울'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 12, ordinaryTarget: 24, source: 'https://limbuscompany.wiki.gg/wiki/Sleepyhead' }],
      },
      {
        label: '수감자들에게 강제로 머리와 플라스크를 잡아 머리를 들어올리게 한다.',
        kind: 'immediate',
        effects: ['변화 없음'],
      },
    ],
  },
  'time-duck': {
    name: '시간오리',
    choices: [
      {
        label: '오리다.',
        kind: 'check',
        favoredAffinities: ['나태', '우울'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 9, ordinaryTarget: 18, source: 'https://limbuscompany.wiki.gg/wiki/Time_Duck' }],
      },
      {
        label: '토끼다.',
        kind: 'check',
        favoredAffinities: ['나태', '질투'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 11, ordinaryTarget: 22, source: 'https://limbuscompany.wiki.gg/wiki/Time_Duck' }],
      },
    ],
  },
  'portrait-of-a-certain-day': {
    name: '어느 날의 초상',
    choices: [
      {
        label: '보이지 않는다고 답한다.',
        kind: 'check',
        favoredAffinities: ['질투', '오만'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 9, ordinaryTarget: 18, source: portraitSource }],
        onSuccess: ['E.G.O 기프트 머리 없는 초상화 획득'],
        onFailure: ['모든 아군 체력·정신력 10 감소'],
      },
      {
        label: '잘 보인다고 답한다.',
        kind: 'check',
        favoredAffinities: ['질투', '나태'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 7, ordinaryTarget: 14, source: portraitSource }],
        onSuccess: ['편성한 모든 인격 레벨 2 증가'],
        onFailure: ['질투 속성 죄를 보유하지 않은 인격 체력·정신력 10 감소'],
      },
      {
        label: '먼지 때문에 안 보인다고 답한다.',
        kind: 'check',
        favoredAffinities: ['우울', '나태'],
        comparison: '>=',
        ruleVariants: [{ id: 'wiki', favoredTarget: 8, ordinaryTarget: 16, source: portraitSource }],
        onSuccess: ['E.G.O 기프트 어느 날의 기억 획득'],
        onFailure: ['우울 속성 공격 스킬이 없는 인격 체력·정신력 10 감소'],
      },
    ],
  },
  'ambling-pearl': {
    name: '걷는 진주',
    choices: [
      {
        label: '녹색 물질을 담는다.',
        kind: 'check',
        favoredAffinities: ['탐식', '우울'],
        comparison: '>=',
        ruleVariants: [
          {
            id: 'extracted-5-10',
            favoredTarget: 5,
            ordinaryTarget: 10,
            source: extractedChecks,
          },
          {
            id: 'wiki-9-18',
            favoredTarget: 9,
            ordinaryTarget: 18,
            source: 'https://limbuscompany.wiki.gg/wiki/Ambling_Pearl',
          },
        ],
        onSuccess: ['E.G.O 기프트 끈적거리는 진액 획득'],
        onFailure: ['판정에 실패한 수감자 정신력 10 감소'],
      },
      {
        label: '다가간다.',
        kind: 'immediate',
        effects: ['전투 시작 시 속도 -2'],
      },
      {
        label: '녹색 물질을 던진다.',
        kind: 'battle',
        onWin: ['E.G.O 기프트 끈적거리는 진액 획득', 'E.G.O 기프트 생체 맹독 바이알 획득'],
        onLoss: ['보상 없음'],
      },
    ],
  },
  'sleeping-bag-of-a-bygone-day': {
    name: '지난 날의 침낭',
    choices: [
      {
        label: '바닥에 놓여져있는 호흡기를 입에 물어준다.',
        kind: 'check',
        favoredAffinities: ['오만', '우울'],
        comparison: '>=',
        ruleVariants: [{
          id: 'wiki-13-26',
          favoredTarget: 13,
          ordinaryTarget: 26,
          source: 'https://limbuscompany.wiki.gg/wiki/Nebulizer',
        }],
        onSuccess: ['E.G.O 기프트 네뷸라이저 획득'],
        onFailure: ['변화 없음'],
      },
      {
        label: '그저 지켜본다.',
        kind: 'immediate',
        effects: ['모든 아군 체력·정신력 회복 10', '오만 속성 보유 인격 체력·정신력 회복 15'],
      },
    ],
  },
  'singing-machine': {
    name: '노래하는 기계 격리실',
    choices: [
      {
        label: '도와주고 기타를 가져가기로 한다.',
        kind: 'check',
        favoredAffinities: ['분노', '색욕'],
        comparison: '>=',
        ruleVariants: [singingMachineRule],
        onSuccess: ['E.G.O 기프트 하모닉스 획득'],
        onFailure: ['E.G.O 기프트 하모닉스 획득', '선택 인격 체력 50·정신력 10 감소'],
      },
      {
        label: '도와주고 베이스를 가져가기로 한다.',
        kind: 'check',
        favoredAffinities: ['분노', '색욕'],
        comparison: '>=',
        ruleVariants: [singingMachineRule],
        onSuccess: ['E.G.O 기프트 워킹 베이스 획득'],
        onFailure: ['E.G.O 기프트 워킹 베이스 획득', '선택 인격 체력 50·정신력 10 감소'],
      },
      {
        label: '도와주지 않는다.',
        kind: 'immediate',
        effects: ['변화 없음'],
      },
    ],
  },
  'my-form-empties': {
    name: '나는 비워내느니',
    choices: [
      {
        label: '귀를 기울인다.',
        kind: 'team-condition',
        condition: { metric: 'average-sanity', comparison: '>=', target: 0 },
      },
      {
        label: '놋쇠반지를 집는다.',
        kind: 'check',
        favoredAffinities: ['색욕', '탐식'],
        comparison: '>=',
        ruleVariants: [
          {
            id: 'wiki-8-16',
            favoredTarget: 8,
            ordinaryTarget: 16,
            source: 'https://limbuscompany.wiki.gg/wiki/My_Form_Empties',
          },
          {
            id: 'extracted-6-12',
            favoredTarget: 6,
            ordinaryTarget: 12,
            source: extractedChecks,
          },
        ],
      },
      {
        label: '동전을 올려둔다.',
        kind: 'battle',
      },
    ],
  },
};

// The input target is the success value shown for this skill and run.
export function previewEventChoice(eventId, choiceNumber, checkInput) {
  const event = Object.hasOwn(mirrorEvents, eventId) ? mirrorEvents[eventId] : undefined;
  const choice = Number.isInteger(choiceNumber) && event?.choices[choiceNumber - 1];
  if (!choice) {
    throw new RangeError('Unknown Mirror Dungeon event choice.');
  }

  const result = choice.kind === 'check' && checkInput != null
    ? calculateCheck({ ...checkInput, comparison: choice.comparison })
    : null;

  return { ...choice, result };
}

export function forecastEventChoice(eventId, choiceNumber, ruleId, roster) {
  const choice = previewEventChoice(eventId, choiceNumber);
  const rule = choice.ruleVariants?.find(({ id }) => id === ruleId);
  if (!rule) throw new RangeError('Select a known rule variant for this event choice.');

  return forecastRoster(roster, {
    favoredAffinities: choice.favoredAffinities,
    comparison: choice.comparison,
    ...rule,
  });
}
