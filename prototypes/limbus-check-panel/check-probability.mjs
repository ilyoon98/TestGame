const comparisons = {
  '>=': (power, target) => power >= target,
  '>': (power, target) => power > target,
  '<=': (power, target) => power <= target,
  '<': (power, target) => power < target,
};

// Pass the power and target after applying any event-specific modifiers.
export function calculateCheck({ sanity, basePower, coinPowers, target, comparison, includeOutcomes = false }) {
  if (!Number.isInteger(sanity) || sanity < -45 || sanity > 45) {
    throw new RangeError('Sanity must be an integer between -45 and 45.');
  }
  if (!Number.isSafeInteger(basePower) || !Number.isSafeInteger(target)) {
    throw new TypeError('Base power and target must be integers.');
  }
  if (!Array.isArray(coinPowers) || !coinPowers.length || !Array.from(coinPowers).every(Number.isSafeInteger)) {
    throw new TypeError('Provide the signed power of each coin.');
  }
  if (!Object.hasOwn(comparisons, comparison)) {
    throw new TypeError('Comparison must be >=, >, <=, or <.');
  }

  const headProbability = (50 + sanity) / 100;
  const tailProbability = (50 - sanity) / 100;
  let outcomes = new Map([[basePower, 1]]);

  for (const coinPower of coinPowers) {
    const next = new Map();
    for (const [power, probability] of outcomes) {
      const headsPower = power + coinPower;
      next.set(power, (next.get(power) ?? 0) + probability * tailProbability);
      next.set(headsPower, (next.get(headsPower) ?? 0) + probability * headProbability);
    }
    outcomes = next;
  }

  const passes = comparisons[comparison];
  let successProbability = 0;
  let passingOutcomes = 0;
  for (const [power, probability] of outcomes) {
    if (passes(power, target)) {
      successProbability += probability;
      passingOutcomes += 1;
    }
  }

  const result = {
    headProbability,
    successProbability: passingOutcomes === outcomes.size ? 1 : successProbability,
    expectedPower: basePower + headProbability * coinPowers.reduce((sum, power) => sum + power, 0),
  };
  if (includeOutcomes) {
    result.outcomes = [...outcomes].sort(([a], [b]) => a - b).map(([power, probability]) => ({
      power,
      probability,
      passes: passes(power, target),
    }));
  }
  return result;
}
