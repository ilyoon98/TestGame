# TestGame

게임 프로토타입, 인터랙션 실험, 개발 도구를 모아 두는 저장소입니다. 각 실험은 `prototypes/` 아래에 있으며 개별 폴더에서 실행합니다.

## 브라우저에서 실행

표에 있는 HTML을 로컬 브라우저에서 엽니다. HTTP가 필요한 브라우저에서는 저장소 루트에서 `python -m http.server 8000 --bind 127.0.0.1`을 실행한 뒤 `http://127.0.0.1:8000/` 아래에서 같은 경로를 엽니다. 일부 실험은 CDN의 폰트나 라이브러리를 사용합니다.

| 실험 | 열 파일 | 내용 |
| --- | --- | --- |
| Coin Flip | [coin.html](prototypes/coin-flip/coin.html) | 동전 뒤집기 |
| Dice | [dice2d.html](prototypes/dice/dice2d.html), [dice_land_phase7.html](prototypes/dice/dice_land_phase7.html) | 2D 주사위와 주사위 땅따먹기 |
| Emotion Buttons | [index.html](prototypes/emotion-buttons/index.html) | 버튼으로 바꾸는 감정 표현 |
| Envy Movement | [stamina-demo.html](prototypes/envy-movement/envy-v3/stamina-demo.html) | 캐릭터 이동과 스태미나 애니메이션. 초기 에셋은 같은 폴더의 `envy/`, `envy-v2/`에 있습니다. |
| Mood Slider | [mood-slider.html](prototypes/mood-slider/mood-slider.html) | 기분 슬라이더 |
| Parry Prototype | [parry-prototype.html](prototypes/parry-prototype/parry-prototype.html) | 패링 타이밍 실험 |
| Project Z | [project-z.html](prototypes/project-z/project-z.html) | Three.js를 사용하는 게임 프로토타입 |
| Seedring Gacha | [seedring-gacha.html](prototypes/seedring-gacha/seedring-gacha.html) | 시드링 뽑기 시뮬레이터 |
| 지구 | [index.html](prototypes/지구/index.html) | 태양계 장거리 포격 시뮬레이션 |

## 별도 실행 환경

| 실험 | 실행 방법 |
| --- | --- |
| [HEX War Lobby](prototypes/hex-war-lobby/README.md) | `cd prototypes/hex-war-lobby` 후 `npm ci`, `npm start`. 브라우저에서 `http://localhost:4173`을 엽니다. |
| [Dungeon Chronicle](prototypes/dungeon-chronicle/README.md) | Node.js 18 이상에서 `cd prototypes/dungeon-chronicle` 후 `npm start`. `http://127.0.0.1:4173`에서 플레이하고 `npm test`로 검증합니다. |
| [Limbus Check Panel](prototypes/limbus-check-panel/사용법.txt) | Windows x64와 Node.js가 필요합니다. 한국어 OCR을 설치하고 폴더의 `Start.cmd`를 실행합니다. |

HEX War Lobby와 Dungeon Chronicle은 기본 포트가 모두 `4173`입니다. 동시에 실행하려면 하나의 포트를 환경 변수 `PORT`(HEX) 또는 `DUNGEON_PORT`(Dungeon)로 바꿉니다.

## 새 실험 추가

`prototypes/<이름>/`에 실행 파일과 전용 에셋을 함께 넣고, 위 표에 실행 방법을 한 줄 추가합니다. Codex로 작업할 때는 채팅을 실험별로 열고 대상 폴더를 지정합니다.
