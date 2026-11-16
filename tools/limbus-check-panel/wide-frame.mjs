import { matchWideIdentityPortrait } from './identity-catalog.mjs';

const portraitOffsets = [
  [0, 0, 9], [-3, 0, 9], [3, 0, 9], [0, -4, 9], [0, 4, 9],
  [-3, -4, 9], [3, 4, 9], [0, 0, 10], [0, 0, 8],
];

function pixel(frame, x, y) {
  const offset = y * frame.stride + x * 4;
  return [frame.pixels[offset + 2], frame.pixels[offset + 1], frame.pixels[offset]];
}

function widePixel(frame, x, y) {
  const scale = frame.width / 2560;
  const row = frame.height - frame.top - Math.round((1392 - y) * scale);
  return pixel(frame, Math.round(x * scale), row);
}

function interpolatedPixel(frame, x, y) {
  const scale = frame.width / 2560;
  const sx = (x + 0.5) * scale - 0.5;
  const sy = frame.height - frame.top - (1392 - y - 0.5) * scale - 0.5;
  const left = Math.floor(sx);
  const top = Math.floor(sy);
  const dx = sx - left;
  const dy = sy - top;
  const a = pixel(frame, left, top);
  const b = pixel(frame, left + 1, top);
  const c = pixel(frame, left, top + 1);
  const d = pixel(frame, left + 1, top + 1);
  return a.map((value, i) => Math.round(
    (value * (1 - dx) + b[i] * dx) * (1 - dy) + (c[i] * (1 - dx) + d[i] * dx) * dy
  ));
}

function portraitSamples(frame, center) {
  return portraitOffsets.map(([dx, dy, step]) => {
    const sample = [];
    for (let row = -2; row <= 2; row += 1) {
      for (let column = -2.5; column <= 2.5; column += 1) {
        sample.push(...interpolatedPixel(frame, center + dx + column * step, 1257 + dy + row * step));
      }
    }
    return Buffer.from(sample);
  });
}

function occupied(frame, center) {
  let border = 0;
  for (let y = 1220; y <= 1272; y += 3) {
    for (let x = center - 62; x <= center - 39; x += 3) {
      const [red, green, blue] = widePixel(frame, x, y);
      if (red > 155 && red > blue * 2 && red > green * 1.5) border += 1;
    }
  }
  return border >= 12;
}

function readZeroSanity(frame, center) {
  const lit = [];
  for (let y = 1289; y <= 1327; y += 1) {
    for (let dx = -22; dx <= 22; dx += 1) {
      const [red, green, blue] = widePixel(frame, center + 31 + dx, y);
      if (blue > 110 && blue > red + 30 && blue >= green + 11 && green > red + 12) {
        lit.push([dx, y]);
      }
    }
  }
  if (!lit.length) return null;
  const left = Math.min(...lit.map(([x]) => x));
  const right = Math.max(...lit.map(([x]) => x));
  const top = lit[0][1];
  const bottom = lit.at(-1)[1];
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width < 9 || width > 17 || height < 23 || height > 34) return null;
  const centerX = (left + right) / 2;
  const middle = lit.filter(([, y]) => y >= top + height * 0.25 && y <= bottom - height * 0.25);
  const open = middle.every(([x]) => Math.abs(x - centerX) >= 1.5);
  const closedAt = (y) => lit.some(([x, row]) => Math.abs(x - centerX) <= 1 && Math.abs(row - y) <= 3);
  const leftStroke = middle.filter(([x]) => x < centerX).length;
  const rightStroke = middle.length - leftStroke;
  return open && closedAt(top) && closedAt(bottom) && Math.min(leftStroke, rightStroke) >= height * 0.85 ? 0 : null;
}

// Downsampled light ink from the two-digit badges, with the dark blue badge excluded.
const sanityMasks = [
  [35, [
    '000000000000000000',
    '000111100011111000',
    '000111110011111000',
    '001100110011000000',
    '001000110011000000',
    '000000110011000000',
    '000001110011111000',
    '000001110011111000',
    '000000110000001000',
    '000000110000001000',
    '000000110000001000',
    '000100110001001000',
    '000111110011111000',
    '000111110011111000',
    '000000000000000000',
  ]],
  [40, [
    '000000000000000000',
    '001100000001111000',
    '001100000011111000',
    '001100000011001000',
    '001100010011001000',
    '001100110011001000',
    '001100110011001000',
    '001111110011001000',
    '001111110011001000',
    '000000110011001000',
    '000000110011001000',
    '000000110011001000',
    '000000110011111000',
    '000000110011111000',
    '000000000000000000',
  ]],
  [45, [
    '000000000000000000',
    '001100000011111000',
    '001100000011111000',
    '001100000011000000',
    '001100010011000000',
    '001100110011000000',
    '001100110011111000',
    '001111110011111000',
    '001111110000001000',
    '000000110000001000',
    '000000110000001000',
    '000000110001001000',
    '000000110011111000',
    '000000110011111000',
    '000000000000000000',
  ]],
].map(([value, rows]) => ({ value, mask: Uint8Array.from(rows.join(''), Number) }));

function readTwoDigitSanity(frame, center) {
  const scale = Math.min(frame.width / 2560, 1);
  const scores = sanityMasks.map(({ value }) => ({ value, distance: Infinity }));
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const pixels = [];
      for (let y = 1293; y <= 1322; y += 2) {
        for (let x = -17; x <= 17; x += 2) {
          pixels.push(widePixel(frame, center + 31 + dx + x, y + dy));
        }
      }
      for (const cutoff of scale <= 0.8 ? [0, 8, 16] : [0]) {
        const ink = pixels.map(([r, g, b]) => Number(b > r + 7 && r > 110 - cutoff && g > 136 - cutoff && b > 155 - cutoff));
        for (const [index, { mask }] of sanityMasks.entries()) {
          const distance = ink.reduce((sum, value, pixel) => sum + Math.abs(value - mask[pixel]), 0);
          scores[index].distance = Math.min(scores[index].distance, distance);
        }
      }
    }
  }
  const [first, second] = scores.sort((a, b) => a.distance - b.distance);
  const tolerance = 18 + Math.round((1 - Math.max(scale, 0.5)) * 44);
  const margin = scale <= 0.8 ? 7 : 12;
  return first.distance <= tolerance && second.distance - first.distance >= margin ? first.value : null;
}

export function readWideRoster(frame, legacySanity) {
  return Array.from({ length: 12 }, (_, index) => {
    const slot = index + 1;
    const center = 154 + index * 138.27;
    if (!occupied(frame, center)) return null;
    let identity = matchWideIdentityPortrait(portraitSamples(frame, center));
    if (!identity && frame.width <= 1600) {
      const left = matchWideIdentityPortrait(portraitSamples(frame, center - 1));
      const right = matchWideIdentityPortrait(portraitSamples(frame, center + 1));
      if (left && left === right) identity = left;
    }
    const sanity = readZeroSanity(frame, center) ?? readTwoDigitSanity(frame, center) ?? legacySanity(slot);
    const gameGrade = readVeryHighGrade(frame, center) ? '매우 높음' : undefined;
    return { slot, identity, sanity, gameGrade };
  }).filter(Boolean);
}

function readVeryHighGrade(frame, center) {
  // The wide yellow label spans four syllables. The shorter "높음" label cannot meet this width.
  const columns = [];
  let yellowPixels = 0;
  for (let dx = -61; dx <= 61; dx += 1) {
    let hits = 0;
    for (let y = 1170; y <= 1204; y += 1) {
      const [r, g, b] = widePixel(frame, center + dx, y);
      if (r > 175 && g > 145 && b < 100 && r - g < 100 && g - b > 85) hits += 1;
    }
    if (hits >= 3) columns.push(dx);
    yellowPixels += hits;
  }
  return yellowPixels >= 430 && columns.length >= 55 && columns.at(-1) - columns[0] >= 93;
}

// Each hexadecimal number represents one row of 27 samples from a target label.
const targetMasks = new Map([
  [8, '0 0 1fc00 3fe00 3fe00 38e00 38e00 38e00 38e00 38e00 3ce00 3fe00 1fc00 3fe00 39e00 38e00 38e00 38e00 38e00 38e00 3fe00 3fe00 1fc00 0 0'],
  [11, '0 0 71e00 7cf80 7ef80 7ef80 76e80 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 70e00 0 0'],
  [12, '0 0 fe380 1ff3e0 1ff3e0 1c73e0 1c73a0 1c3380 1c0380 1c0380 1e0380 1f8380 fe380 3f380 f380 7380 7380 7380 7380 7380 1ff380 1ff380 1ff380 0 0'],
  [22, '0 0 7f8ff0 7f9ff0 ffdff0 f3dc70 f3dc70 f0dc10 f01c00 f01c00 f81f00 7e0fc0 3f87f0 f81f0 3c070 3c070 3c070 3c070 3c070 7bcf70 ffdff0 ffdff0 ffdff0 0 0'],
  [24, '0 0 1cff0 1cff0 1dff8 1de78 41de78 71de18 71de00 71de00 71df00 73cfc0 7fc7f0 7fc1f0 7fc078 700078 700078 700078 700078 700078 701ff8 701ff8 701ff8 0 0'],
].map(([value, rows]) => [value, rows.split(' ').map((row) => Number.parseInt(row, 16))]));

export function readTargetInk(rows) {
  if (rows?.length !== 25) return null;
  const scores = [...targetMasks].map(([value, reference]) => {
    let distance = 0;
    for (let row = 0; row < rows.length; row += 1) {
      let difference = rows[row] ^ reference[row];
      while (difference) {
        difference &= difference - 1;
        distance += 1;
      }
    }
    return { value, distance };
  }).sort((a, b) => a.distance - b.distance);
  const [first, second] = scores;
  return first.distance <= 35 && second.distance - first.distance >= 20 ? first.value : null;
}

const hueBands = [
  ['분노', 345, 370], ['색욕', 12, 37], ['나태', 38, 62], ['탐식', 75, 155],
  ['우울', 163, 204], ['오만', 212, 256], ['질투', 264, 324],
];

export function readAffinityColors(pixels) {
  const counts = new Map(hueBands.map(([affinity]) => [affinity, 0]));
  for (let offset = 0; offset + 2 < pixels.length; offset += 3) {
    const [red, green, blue] = pixels.subarray(offset, offset + 3);
    const max = Math.max(red, green, blue);
    const spread = max - Math.min(red, green, blue);
    if (max <= 125 || spread / max <= 0.56) continue;
    const angle = max === red ? (green - blue) / spread
      : max === green ? (blue - red) / spread + 2 : (red - green) / spread + 4;
    const hue = (angle * 60 + 360) % 360;
    const band = hueBands.find(([, min, max]) => (hue >= min && hue <= max) || hue + 360 <= max);
    if (band) counts.set(band[0], counts.get(band[0]) + 1);
  }
  const minimum = Math.max(8, Math.ceil(Math.max(...counts.values()) * 0.23));
  return [...counts].filter(([, count]) => count >= minimum).map(([affinity]) => affinity);
}
