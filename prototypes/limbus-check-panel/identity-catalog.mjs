import { readFileSync } from 'node:fs';

function attack(slot, name, affinity, basePower, coinPower, coinCount) {
  return { slot, name, affinity, basePower, coinPowers: Array(coinCount).fill(coinPower) };
}

const yiSangSkills = [
  attack(1, '얼어붙은 피를 삼백삼십 휘감아', '탐식', 3, 4, 2),
  attack(2, '소리 없이 손뼉 쳐 즐기고, 목소리 없이 슬피 꿰뚫어', '오만', 4, 4, 3),
  attack(3, '날 세워 칼을 웃거라, 낙엽 향 나듯 폭포를 울거라', '우울', 4, 3, 4),
];

const thumbHeathcliffFirst = attack(1, '팔레르모 스파다', '색욕', 3, 4, 2);

export const identityCatalog = {
  10115: {
    name: '거미집 검지 아비 이상',
    sinnerId: 1,
    factions: ['검지', '거미집'],
    source: 'https://soshage.com/limbus/ko/identity/10115',
    profiles: { calendarSample: yiSangSkills, uptie4: yiSangSkills },
  },
  10204: {
    name: '쥐는 자 파우스트',
    sinnerId: 2,
    factions: ['N사', 'N사 광신도'],
    source: 'https://soshage.com/limbus/ko/identity/10204',
    profiles: {
      uptie1Or2: [attack(1, '광소', '질투', 3, 3, 2), attack(2, '쥐어짐', '색욕', 4, 2, 3)],
      uptie4: [
        attack(1, '광소', '질투', 4, 3, 2),
        attack(2, '쥐어짐', '색욕', 4, 4, 3),
        attack(3, '처단', '오만', 6, 2, 3),
      ],
    },
  },
  10716: {
    name: '거미집 엄지 제자 히스클리프',
    sinnerId: 7,
    factions: ['거미집', '엄지'],
    source: 'https://soshage.com/limbus/ko/identity/10716',
    profiles: {
      calendarSample: [thumbHeathcliffFirst, attack(2, '콜피 소타니', '나태', 4, 3, 3)],
      uptie4: [
        thumbHeathcliffFirst,
        attack(2, '콜피 소타니', '나태', 4, 4, 3),
        attack(3, '카치아토레', '분노', 5, 4, 3),
      ],
    },
  },
};

export function getIdentity(identityId, profile) {
  if (!Object.hasOwn(identityCatalog, identityId)) return null;
  const { name, sinnerId, factions, profiles } = identityCatalog[identityId];
  const skills = Object.hasOwn(profiles, profile) ? profiles[profile] : undefined;
  return { id: Number(identityId), name, sinnerId, factions, skills };
}
let portraitCatalog;

export function getPortraitCatalog() {
  if (portraitCatalog) return portraitCatalog;
  const entries = JSON.parse(readFileSync(new URL('./identity-data.json', import.meta.url), 'utf8'));
  portraitCatalog = Object.entries(entries).map(([id, entry]) => ({
    identity: {
      id: Number(id),
      name: entry.name,
      sinnerId: entry.sinnerId,
      factions: entry.factions,
      skillProfiles: Object.values(entry.profiles),
      skillProfileStages: Object.keys(entry.profiles).map(Number),
    },
    portraits: entry.portraits.map((portrait) => Buffer.from(portrait, 'base64')),
  }));
  return portraitCatalog;
}

export function matchIdentityPortrait(sample, catalog = getPortraitCatalog()) {
  let best = null;
  let bestDistance = Infinity;
  let secondDistance = Infinity;
  for (const entry of catalog) {
    let entryDistance = Infinity;
    for (const portrait of entry.portraits) {
      for (let start = 0; start < portrait.length; start += sample.length) {
        let distance = 0;
        for (let i = 0; i < sample.length; i += 1) {
          distance += Math.abs(sample[i] - portrait[start + i]);
        }
        entryDistance = Math.min(entryDistance, distance / sample.length);
      }
    }
    if (entryDistance < bestDistance) {
      best = entry.identity;
      secondDistance = bestDistance;
      bestDistance = entryDistance;
    } else {
      secondDistance = Math.min(secondDistance, entryDistance);
    }
  }
  return bestDistance <= 29 && secondDistance - bestDistance >= 9.5 ? best : null;
}

let wideCatalog;

function getWidePortraitCatalog() {
  if (wideCatalog) return wideCatalog;
  const { identities } = JSON.parse(readFileSync(new URL('./portrait-profiles.json', import.meta.url), 'utf8'));
  wideCatalog = getPortraitCatalog().map(({ identity, portraits }) => ({
    identity,
    portraits: [...portraits, ...Object.values(identities[identity.id] ?? {}).map((data) => Buffer.from(data, 'base64'))],
  }));
  return wideCatalog;
}

export function matchWideIdentityPortrait(samples) {
  const ranked = getWidePortraitCatalog().map(({ identity, portraits }) => {
    const scores = samples.map((sample) => {
      let best = Infinity;
      for (const portrait of portraits) {
        for (let start = 0; start + sample.length <= portrait.length; start += sample.length) {
          let distance = 0;
          for (let i = 0; i < sample.length; i += 1) {
            distance += Math.abs(sample[i] - portrait[start + i]);
          }
          best = Math.min(best, distance);
        }
      }
      return best / sample.length;
    }).sort((a, b) => a - b);
    return { identity, distance: scores[2] };
  }).sort((a, b) => a.distance - b.distance);
  const [first, second] = ranked;
  return first.distance <= 31 && second.distance - first.distance >= 5 ? first.identity : null;
}
