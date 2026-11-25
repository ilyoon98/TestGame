// 화면과 전역 API를 이루는 일반 스크립트. 이 순서대로 불러온다(불러올 때 바로 실행되는 코드가 앞 파일에 기대므로).
// 브라우저는 main.js가, 테스트는 tests/helpers/game-engine.mjs가 이 목록을 쓴다.
export const scriptOrder = [
  "game-api.js",
  "ui/art.js",
  "ui/hud.js",
  "ui/body-panel.js",
  "ui/skill-cards.js",
  "ui/map.js",
  "ui/rooms.js",
  "ui/render.js",
  "ui/audio.js",
  "ui/combat-presenter.js",
  "ui/opening.js",
  "ui/codex.js",
  "ui/input.js"
];
