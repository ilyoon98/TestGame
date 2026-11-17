import { calculateCheck } from './check-probability.mjs';

function getScoreModifier(identity, modifiers) {
  return modifiers.reduce((total, { subject, key, amount }) => {
    let applies;
    switch (subject) {
      case 'faction': applies = identity.factions?.includes(key); break;
      case 'sinner': applies = identity.sinnerId === key; break;
      case 'identity': applies = identity.id === key; break;
      default: throw new TypeError('Unknown event modifier subject.');
    }
    return total + (applies ? amount : 0);
  }, 0);
}

export function forecastRoster(roster, check) {
  return roster.map(({ identity, sanity, slot, gameGrade }) => {
    const observed = { slot, sanity };
    if (gameGrade) observed.gameGrade = gameGrade;
    if (!identity) return { ...observed, status: 'unknown-portrait' };
    const candidate = { ...observed, identity: identity.name, sinnerId: identity.sinnerId };
    if (sanity == null) return { ...candidate, status: 'unknown-sanity' };
    const profiles = identity.skillProfiles ?? (identity.skills?.length ? [identity.skills] : []);
    if (!profiles.length) return { ...candidate, status: 'unknown-skills' };
    if (!check) return { ...candidate, status: 'unknown-check' };

    const scoreModifier = getScoreModifier(identity, check.scoreModifiers ?? []);
    const results = profiles.map((skills) => {
      // Additional skills listed in the same slot require combat states that a base check does not apply.
      const baseSkills = skills.filter((skill, index) =>
        skill.slot == null || skills.findIndex(({ slot }) => slot === skill.slot) === index);
      const attempts = baseSkills.map((skill) => {
        const favored = check.favoredAffinities.includes(skill.affinity);
        const target = favored ? check.favoredTarget : check.ordinaryTarget;
        const result = calculateCheck({
          sanity,
          basePower: skill.basePower + scoreModifier,
          coinPowers: skill.coinPowers,
          target,
          comparison: check.comparison,
          includeOutcomes: true,
        });
        return { ...skill, target, scoreModifier, ...result };
      });
      return attempts.sort((a, b) => b.successProbability - a.successProbability)[0];
    });

    const probabilities = results.map(({ successProbability }) => successProbability);
    const lower = Math.min(...probabilities);
    const upper = Math.max(...probabilities);
    if (upper - lower > 1e-12) {
      const forecast = { ...candidate, status: 'unknown-uptie', lower, upper };
      const byStage = new Map(identity.skillProfileStages?.map((stage, index) => [stage, probabilities[index]]));
      if ([1, 2, 3, 4].every((stage) => Number.isFinite(byStage.get(stage)))) {
        forecast.uptieGroups = [[1, 2], [3, 4]].map(([first, last]) => ({
          first, last,
          lower: Math.min(byStage.get(first), byStage.get(last)),
          upper: Math.max(byStage.get(first), byStage.get(last)),
        }));
      }
      return forecast;
    }
    return { ...candidate, status: 'calculated', bestSkill: results[0] };
  });
}
