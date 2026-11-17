import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getIdentity, getPortraitCatalog, matchIdentityPortrait } from './identity-catalog.mjs';
import { mirrorEvents, previewEventChoice } from './mirror-events.mjs';
import { forecastRoster } from './roster-forecast.mjs';
import { readAffinityColors, readTargetInk, readWideRoster } from './wide-frame.mjs';

const calendarCheck = {
  name: '종말 달력 · 수감자를 바친다',
  favoredAffinities: ['나태'],
  favoredTarget: 5,
  ordinaryTarget: 8,
  comparison: '>=',
};

function readFrame({ imagePath = '', mode, windowHandle = 0, windowOwner = 0 }) {
  const command = '& ([scriptblock]::Create([IO.File]::ReadAllText($env:LIMBUS_FRAME_READER))) ' +
    '-ImagePath $env:LIMBUS_FRAME_PATH -Mode $env:LIMBUS_FRAME_MODE ' +
    '-WindowHandle ([long]$env:LIMBUS_FRAME_WINDOW) -WindowOwner ([uint32]$env:LIMBUS_FRAME_OWNER)';
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  const json = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    env: {
      ...process.env,
      LIMBUS_FRAME_READER: fileURLToPath(new URL('./read-game-frame.ps1', import.meta.url)),
      LIMBUS_FRAME_CAPTURE: fileURLToPath(new URL('./GameWindowCapture.cs', import.meta.url)),
      LIMBUS_FRAME_PATH: imagePath && resolve(imagePath),
      LIMBUS_FRAME_MODE: mode,
      LIMBUS_FRAME_WINDOW: String(windowHandle),
      LIMBUS_FRAME_OWNER: String(windowOwner),
    },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 6500,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const frame = JSON.parse(json);
  if (frame.pixels) frame.pixels = Buffer.from(frame.pixels, 'base64');
  return frame;
}

export function readGameFrame(imagePath, mode) {
  return readFrame({ imagePath, mode });
}

function normalize(text) {
  return (text ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
}

function textDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      row.push(Math.min(row[j] + 1, previous[j + 1] + 1, previous[j] + Number(a[i] !== b[j])));
    }
    previous = row;
  }
  return previous[b.length] / Math.max(a.length, b.length, 1);
}

export function readChoices(lines) {
  const matches = lines.map((raw) => {
    const text = normalize(raw);
    if (!text) return null;
    const candidates = Object.entries(mirrorEvents).flatMap(([eventId, event]) => (
      event.choices.map(({ label }, index) => ({
        eventId,
        choiceNumber: index + 1,
        distance: textDistance(text, normalize(label)),
      }))
    ));
    candidates.sort((a, b) => a.distance - b.distance);
    const [first, second] = candidates;
    if (first.distance > 0.27 || second.distance - first.distance < 0.08) return { raw };
    return { raw, eventId: first.eventId, choiceNumber: first.choiceNumber };
  });

  const eventIds = new Set(matches.filter((match) => match?.eventId).map((match) => match.eventId));
  const [eventId] = eventIds;
  if (eventIds.size !== 1) return { event: null, choices: matches.filter(Boolean) };
  return {
    eventId,
    event: mirrorEvents[eventId].name,
    choices: matches.flatMap((match, index) => {
      if (!match) return [];
      if (!match.choiceNumber) return [{ position: index + 1, text: match.raw, status: 'unread-choice' }];
      const { label, kind, condition, favoredAffinities, comparison, ruleVariants } =
        previewEventChoice(eventId, match.choiceNumber);
      return [{ position: index + 1, choiceNumber: match.choiceNumber, label, kind, condition,
        favoredAffinities, comparison, ruleVariants }];
    }),
  };
}

function pixel(frame, x, y) {
  const row = Math.floor(y * frame.height / 392) - (frame.top ?? 0);
  const offset = row * frame.stride + Math.floor(x * frame.width / 850) * 4;
  return [frame.pixels[offset + 2], frame.pixels[offset + 1], frame.pixels[offset]];
}

// These coordinates describe the compact portrait row in the attached check samples.
export function sampleSlot(frame, slot) {
  const center = Math.round(51 + (slot - 1) * 46.5);
  const portrait = [];
  const sanity = [];
  let borderPixels = 0;
  for (let y = 341; y <= 358; y += 1) {
    for (let x = center - 21; x <= center - 11; x += 1) {
      const [red, green, blue] = pixel(frame, x, y);
      if (red > 155 && red > blue * 2 && red > green) borderPixels += 1;
    }
  }
  for (let y = 342; y <= 356; y += 3) {
    for (let x = center - 10; x <= center + 10; x += 4) {
      portrait.push(...pixel(frame, x, y));
    }
  }
  for (let y = 360; y <= 369; y += 1) {
    for (let x = center + 2; x <= center + 15; x += 1) {
      const [red, green, blue] = pixel(frame, x, y);
      sanity.push(Math.max(0, Math.min(red, green, blue) - 75));
    }
  }
  return { occupied: borderPixels >= 30, portrait: Buffer.from(portrait), sanity: Buffer.from(sanity) };
}

function closestMatch(sample, references, maxDistance, minMargin) {
  const matches = references.map((entry) => {
    const reference = Buffer.from(entry.signature, 'base64');
    const distance = sample.reduce((sum, value, i) => sum + Math.abs(value - reference[i]), 0) / sample.length;
    return { entry, distance };
  }).sort((a, b) => a.distance - b.distance);
  const [best, next] = matches;
  if (!best || best.distance > maxDistance || (next && next.distance - best.distance < minMargin)) return null;
  return best.entry.value;
}

export function readCalendarSample(frame, profile) {
  if (!normalize(frame.start).includes('판정시작') || !normalize(frame.heading).includes('목소리를가진사람이')) {
    throw new Error('The screenshot does not match the calibrated pre-roll check.');
  }
  return forecastFrame(frame, profile, calendarCheck, false);
}

function forecastFrame(frame, profile, check, live = true) {
  if (frame.layout === 'wide') {
    const roster = readWideRoster(frame, (slot) => closestMatch(sampleSlot(frame, slot).sanity, profile.sanity, 11, 6));
    return { event: check?.name, roster: forecastRoster(roster, check) };
  }
  const catalog = live ? getPortraitCatalog() : [];
  const identities = new Map(catalog.map(({ identity }) => [identity.id, identity]));
  const roster = Array.from({ length: 12 }, (_, i) => {
    const slot = i + 1;
    const sample = sampleSlot(frame, slot);
    if (!sample.occupied) return null;
    const match = closestMatch(sample.portrait, profile.portraits, live ? 14 : 24, 12);
    const identity = !live
      ? (match ? getIdentity(match.identityId, match.profile) : null)
      : (identities.get(match?.identityId) ?? matchIdentityPortrait(sample.portrait, catalog));
    const sanity = closestMatch(sample.sanity, profile.sanity, 11, 6);
    return { slot, identity, sanity };
  }).filter(Boolean);
  return { event: check?.name, roster: forecastRoster(roster, check) };
}

export function readLiveFrame(frame, profile, eventId) {
  if (frame.captureStatus) return { state: frame.captureStatus };
  if (frame.checkOutcome) return { state: 'resolved', outcome: frame.checkOutcome };
  if (frame.lines) {
    const choice = readChoices(frame.lines);
    return choice.eventId
      ? { state: 'choices', eventId: choice.eventId, event: choice.event }
      : { state: 'waiting' };
  }
  if (normalize(frame.heading).includes('목소리를가진사람이')) {
    return { state: 'check', ...forecastFrame(frame, profile, calendarCheck) };
  }
  const affinityText = normalize(frame.affinity);
  const readAffinities = ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투']
    .filter((affinity) => affinityText.includes(affinity));
  const colors = frame.affinityPixels ? readAffinityColors(Buffer.from(frame.affinityPixels, 'base64')) : [];
  const affinities = colors.length > readAffinities.length && readAffinities.every((value) => colors.includes(value))
    ? colors : readAffinities;
  const targetMatch = frame.target?.match(/\d+/g);
  const target = readTargetInk(frame.targetInk) ?? (targetMatch?.length === 1 ? Number(targetMatch[0]) : null);
  const event = Object.hasOwn(mirrorEvents, eventId) ? mirrorEvents[eventId] : null;
  const observed = { phase: frame.phase, favoredAffinities: affinities, displayedTarget: target };
  const findCandidates = (events) => events.flatMap(({ name, choices }) => choices.flatMap(({ kind, favoredAffinities, comparison, ruleVariants }) => {
    if (kind !== 'check' || favoredAffinities.length !== affinities.length ||
        !favoredAffinities.every((affinity) => affinities.includes(affinity))) return [];
    return ruleVariants
      .filter(({ favoredTarget, ordinaryTarget }) => target === favoredTarget ||
        (frame.phase !== 'select-identity' && target === ordinaryTarget))
      .map(({ favoredTarget, ordinaryTarget, scoreModifiers }) => ({
        name, rule: { favoredAffinities: affinities, comparison, favoredTarget, ordinaryTarget, scoreModifiers },
      }));
  }));
  const eventCandidates = event ? findCandidates([event]) : [];
  const candidates = eventCandidates.length || frame.layout !== 'wide'
    ? eventCandidates : findCandidates(Object.values(mirrorEvents));
  const distinct = new Map(candidates.map(({ rule }) => [JSON.stringify(rule), rule]));
  if (distinct.size !== 1) {
    return { state: 'unknown-check', ...observed, ...forecastFrame(frame, profile, null), event: event?.name };
  }
  const [rule] = distinct.values();
  const matchingNames = new Set(candidates.map(({ name }) => name));
  const name = matchingNames.size === 1 ? candidates[0].name : undefined;
  const usesEventContext = eventCandidates.length > 0;
  return {
    state: 'check', eventId: usesEventContext ? eventId : undefined, ...observed,
    checkSource: usesEventContext ? 'event' : 'condition-match',
    comparison: rule.comparison, favoredTarget: rule.favoredTarget, ordinaryTarget: rule.ordinaryTarget,
    ...forecastFrame(frame, profile, { name, ...rule }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, windowOwner, eventId] = process.argv.slice(2);
  try {
    if (!input || !['choices', 'calendar-sample', 'screenshot', 'live-frame'].includes(mode)) {
      throw new Error('Usage: node analyze-screenshot.mjs <choices|calendar-sample|screenshot> <screenshot.png> [eventId] or live-frame <HWND> [PID] [eventId]');
    }
    let result;
    if (mode === 'choices') {
      result = readChoices(readGameFrame(input, mode).lines);
    } else {
      const profile = JSON.parse(readFileSync(new URL('./calendar-sample.json', import.meta.url), 'utf8'));
      const frame = mode === 'live-frame'
        ? readFrame({ mode, windowHandle: input, windowOwner })
        : readGameFrame(input, mode);
      if (mode === 'calendar-sample') {
        result = readCalendarSample(frame, profile);
      } else if (mode === 'screenshot' && !frame.layout && normalize(frame.heading).includes('목소리를가진사람이')) {
        result = readCalendarSample(frame, profile);
      } else {
        result = readLiveFrame(frame, profile, mode === 'screenshot' ? windowOwner : eventId);
      }
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
