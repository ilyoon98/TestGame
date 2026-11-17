"use strict";

const moods = [
  { file: "Entertaining", name: "기쁨", note: "좋은 기분이 꽃잎처럼 퍼져요.", tint: "#fff2ca", effect: "flowers", anchors: [161, 141, 285, 128, 238, 227] },
  { file: "Relaxed", name: "편안함", note: "가만히 숨을 고르는 기분이에요.", tint: "#fbe6e6", effect: "air", anchors: [193, 138, 316, 140, 253, 223] },
  { file: "Lazy", name: "무기력", note: "잠깐 쉬어 가고 싶은 표정이에요.", tint: "#eeeae7", effect: "signs", sign: "…", anchors: [184, 293, 338, 294, 249, 351] },
  { file: "Ridiculous", name: "당황", note: "예상치 못한 순간, 땀방울이 맺혀요.", tint: "#e4f1dd", effect: "sweat", anchors: [189, 192, 310, 191, 255, 255] },
  { file: "Sad", name: "슬픔", note: "눈물이 한 방울씩 떨어져요.", tint: "#e1eef8", effect: "tears", anchors: [194, 165, 310, 165, 237, 232] },
  { file: "Tired", name: "피곤함", note: "눈꺼풀이 무거운 날이에요.", tint: "#e6edfb", effect: "signs", sign: "z", anchors: [181, 151, 314, 151, 242, 271] },
  { file: "Unknown", name: "어리둥절", note: "머리 위로 물음표가 떠올라요.", tint: "#fff0d4", effect: "signs", sign: "?", anchors: [202, 156, 306, 149, 255, 220] },
  { file: "Worried", name: "걱정", note: "생각이 자꾸 꼬리를 물어요.", tint: "#f4e7fa", effect: "signs", sign: "…", anchors: [207, 157, 309, 155, 255, 231] },
  { file: "Anowing", name: "짜증", note: "작은 일에도 울컥하는 순간이에요.", tint: "#fce3db", effect: "signs", sign: "!", anchors: [211, 181, 315, 179, 261, 245] },
  { file: "Anxiety", name: "불안", note: "마음이 조금 조마조마해요.", tint: "#f1e4de", effect: "sweat", anchors: [176, 170, 339, 159, 255, 219] },
  { file: "Distressed", name: "괴로움", note: "마음에 힘이 잔뜩 들어간 표정이에요.", tint: "#fbe3da", effect: "signs", sign: "!", anchors: [166, 136, 340, 143, 249, 204] }
];

const size = 512;
const canvas = document.querySelector("#face");
const context = canvas.getContext("2d");
const stage = document.querySelector("#stage");
const buttons = document.querySelector("#buttons");
const moodName = document.querySelector("#mood-name");
const moodNote = document.querySelector("#mood-note");
const message = document.querySelector("#message");
const sign = document.querySelector("#sign");
const motionLabel = document.querySelector("#motion-label");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function createBuffer() {
  const buffer = document.createElement("canvas");
  buffer.width = size;
  buffer.height = size;
  return buffer.getContext("2d");
}

const sourceLayer = createBuffer();
const targetLayer = createBuffer();
const snapshot = createBuffer();

function faceMesh([leftX, leftY, rightX, rightY, mouthX, mouthY]) {
  return [
    [0, 0], [128, 0], [256, 0], [384, 0], [512, 0],
    [0, 167], [leftX, leftY], [(leftX + rightX) / 2, (leftY + rightY) / 2],
    [rightX, rightY], [512, 167],
    [0, 275], [mouthX - 64, mouthY], [mouthX, mouthY], [mouthX + 64, mouthY], [512, 275],
    [0, 512], [128, 512], [256, 512], [384, 512], [512, 512]
  ];
}

const triangles = [];
for (let row = 0; row < 3; row++) {
  for (let column = 0; column < 4; column++) {
    const top = row * 5 + column;
    triangles.push([top, top + 1, top + 6], [top, top + 6, top + 5]);
  }
}

function warp(layer, image, from, to) {
  layer.clearRect(0, 0, size, size);
  for (const [a, b, c] of triangles) {
    const [sx, sy] = from[a];
    const [tx, ty] = to[a];
    const sx1 = from[b][0] - sx;
    const sy1 = from[b][1] - sy;
    const sx2 = from[c][0] - sx;
    const sy2 = from[c][1] - sy;
    const tx1 = to[b][0] - tx;
    const ty1 = to[b][1] - ty;
    const tx2 = to[c][0] - tx;
    const ty2 = to[c][1] - ty;
    const determinant = sx1 * sy2 - sx2 * sy1;
    const m11 = (tx1 * sy2 - tx2 * sy1) / determinant;
    const m12 = (ty1 * sy2 - ty2 * sy1) / determinant;
    const m21 = (tx2 * sx1 - tx1 * sx2) / determinant;
    const m22 = (ty2 * sx1 - ty1 * sx2) / determinant;

    // A slight overlap covers antialiasing gaps between adjacent triangles.
    const centerX = (to[a][0] + to[b][0] + to[c][0]) / 3;
    const centerY = (to[a][1] + to[b][1] + to[c][1]) / 3;
    layer.save();
    layer.beginPath();
    for (const index of [a, b, c]) {
      const [x, y] = to[index];
      layer.lineTo(centerX + (x - centerX) * 1.015, centerY + (y - centerY) * 1.015);
    }
    layer.closePath();
    layer.clip();
    layer.setTransform(m11, m12, m21, m22, tx - m11 * sx - m21 * sy, ty - m12 * sx - m22 * sy);
    layer.drawImage(image, 0, 0, size, size);
    layer.restore();
  }
}

let selected = null;
let currentMesh = null;
let animationFrame = 0;

function drawOriginal(mood) {
  context.clearRect(0, 0, size, size);
  context.drawImage(mood.image, 0, 0, size, size);
  currentMesh = mood.mesh;
}

function drawTransition(fromImage, fromMesh, mood, mix) {
  currentMesh = fromMesh.map(([x, y], index) => [
    x + (mood.mesh[index][0] - x) * mix,
    y + (mood.mesh[index][1] - y) * mix
  ]);
  warp(sourceLayer, fromImage, fromMesh, currentMesh);
  warp(targetLayer, mood.image, mood.mesh, currentMesh);
  context.clearRect(0, 0, size, size);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 1 - mix;
  context.drawImage(sourceLayer.canvas, 0, 0);
  context.globalAlpha = mix;
  context.drawImage(targetLayer.canvas, 0, 0);
  context.restore();
}

function chooseMood(mood) {
  if (mood === selected) return;
  let fromImage = selected?.image;
  const fromMesh = currentMesh;
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    snapshot.clearRect(0, 0, size, size);
    snapshot.drawImage(canvas, 0, 0);
    fromImage = snapshot.canvas;
  }

  selected?.button.setAttribute("aria-pressed", "false");
  selected = mood;
  mood.button.setAttribute("aria-pressed", "true");
  moodName.textContent = mood.name;
  moodNote.textContent = mood.note;
  canvas.setAttribute("aria-label", mood.name + " 표정");
  stage.style.setProperty("--tint", mood.tint);
  sign.textContent = mood.sign ?? "";
  stage.dataset.effect = mood.effect;

  if (!fromImage || reducedMotion.matches) {
    drawOriginal(mood);
    return;
  }

  const startedAt = performance.now();
  function animate(now) {
    const progress = Math.max(0, (now - startedAt) / 520);
    if (progress >= 1 || reducedMotion.matches) {
      animationFrame = 0;
      drawOriginal(mood);
      return;
    }
    const mix = progress * progress * (3 - 2 * progress);
    drawTransition(fromImage, fromMesh, mood, mix);
    animationFrame = requestAnimationFrame(animate);
  }
  animationFrame = requestAnimationFrame(animate);
}

document.querySelector("#motion-toggle").addEventListener("click", () => {
  const paused = stage.classList.toggle("is-paused");
  motionLabel.textContent = paused ? "반복 효과 재생" : "반복 효과 일시정지";
});

async function loadMood(mood) {
  const button = document.createElement("button");
  button.className = "mood-button";
  button.type = "button";
  button.disabled = true;
  button.setAttribute("aria-pressed", "false");
  button.style.setProperty("--button-tint", mood.tint);
  const image = document.createElement("img");
  image.alt = "";
  image.src = "assets/" + mood.file + ".png";
  button.append(image, mood.name);
  buttons.append(button);

  try {
    await image.decode();
    mood.image = image;
    mood.mesh = faceMesh(mood.anchors);
    mood.button = button;
    button.addEventListener("click", () => chooseMood(mood));
    button.disabled = false;
    return mood;
  } catch {
    message.hidden = false;
    message.textContent = "일부 표정을 불러오지 못했어요.";
    return null;
  }
}

Promise.all(moods.map(loadMood)).then(loaded => {
  const first = loaded.find(Boolean);
  if (first && !selected) chooseMood(first);
});
