import { mkdirSync, writeFileSync } from "node:fs";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

// Capture the web synthesizer's oscillator, noise and envelope settings before baking mono PCM.
const run = engine(1, { prep: true });
const cues = JSON.parse(run(`JSON.stringify((() => {
  const cues = {};
  let layers;
  tone = (_ctx, _out, at, duration, level, start, end, wave) =>
    layers.push({ at, duration, level, start, end, wave });
  collisionNoise = (_ctx, _out, at, duration, level, filter, cutoff) =>
    layers.push({ at, duration, level, filter, cutoff });
  audioContext = { state: "running", currentTime: 0 };
  audioOutput = {};
  const record = (id, cue) => {
    layers = cues[id] = [];
    cue();
  };
  for (const [id, event] of [
    ["hit", { dealt: 1 }], ["block", { blocked: 1 }], ["block-hit", { blocked: 1, dealt: 1 }],
    ["critical", { critical: 1 }], ["defeat", { defeated: true }],
  ]) {
    record(id, () => synthesizeImpact(audioContext, audioOutput, event));
  }
  record("heal", playHealingSound);
  record("bell", playBellboyBell);
  record("pursuit", playPursuitSound);
  record("attack", () => collisionNoise(audioContext, audioOutput, .006, .084, .24, "bandpass", 1420));
  record("guard", () => {
    tone(audioContext, audioOutput, .006, .117, .10, 1120, 1030, "triangle");
    collisionNoise(audioContext, audioOutput, .006, .062, .13, "highpass", 1800);
  });
  return cues;
})())`));

const rate = 22050;
let seed = 0x4f853bc1;
const noise = new Float64Array(Math.ceil(rate * .24)).map(() => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x80000000 - 1;
});

function makeBiquad(mode, cutoff) {
  const angle = 2 * Math.PI * cutoff / rate;
  const cosine = Math.cos(angle);
  const alpha = Math.sin(angle) / (2 * (mode === "bandpass" ? 1 : 10 ** (1 / 20)));
  const base = mode === "lowpass" ? (1 - cosine) / 2 : (1 + cosine) / 2;
  const [b0, b1, b2] = mode === "bandpass" ? [alpha, 0, -alpha] :
    [base, mode === "lowpass" ? 2 * base : -2 * base, base];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return sample => {
    const result = (b0 * sample + b1 * x1 + b2 * x2 + 2 * cosine * y1 - (1 - alpha) * y2) / (1 + alpha);
    x2 = x1;
    x1 = sample;
    y2 = y1;
    y1 = result;
    return result;
  };
}

function bake(layers) {
  const frames = Math.ceil(rate * Math.max(...layers.map(({ at, duration }) => at + duration)));
  const samples = new Float64Array(frames);
  for (const layer of layers) {
    const first = Math.round(layer.at * rate);
    const count = Math.min(Math.round(layer.duration * rate), frames - first);
    const filter = layer.filter ? makeBiquad(layer.filter, layer.cutoff) : null;
    let phase = 0;
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const envelope = layer.level * (.001 / layer.level) ** progress * .5;
      const sine = Math.sin(phase);
      const signal = filter ? filter(noise[i]) : layer.wave === "triangle" ? 2 * Math.asin(sine) / Math.PI : sine;
      samples[first + i] += signal * envelope;
      if (!filter) phase += 2 * Math.PI * layer.start * (layer.end / layer.start) ** progress / rate;
    }
  }
  const wav = Buffer.alloc(44 + 2 * frames);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(2 * frames, 40);
  samples.forEach((sample, i) => wav.writeInt16LE(Math.round(Math.min(1, Math.max(-1, sample)) * 32767), 44 + i * 2));
  return wav;
}

const directory = new URL("../art/audio/", import.meta.url);
mkdirSync(directory, { recursive: true });
for (const [id, layers] of Object.entries(cues)) {
  writeFileSync(new URL(id + ".wav", directory), bake(layers));
}
