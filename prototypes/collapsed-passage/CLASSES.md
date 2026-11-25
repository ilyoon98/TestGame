# 클래스와 역할

웹판의 클래스가 각각 무엇을 맡는지 정리한 목록이다. 계층과 의존 방향은 [ARCHITECTURE.md](ARCHITECTURE.md), 원칙별 판단 기준은 [객체지향 원칙 정리](../../docs/ai/oop-principles.md)를 본다. 클래스를 추가하거나 책임을 옮기면 이 표를 함께 고친다.

"원칙" 열은 그 클래스가 대표로 보여 주는 원칙이다. 줄임말은 다음과 같다.

| 줄임말 | 원칙 |
| --- | --- |
| 캡 | 캡슐화 |
| 추 | 추상화 |
| 상 | 상속 |
| 다 | 다형성 |
| S·O·L·I·D | SOLID 각 원칙 |

## 도메인: 게임 규칙 (`src/domain/`)

DOM, 타이머, `Math.random`을 쓰지 않는다. 판 상태(`game`)는 평범한 객체로 두고, 규칙 객체가 매개변수로 받는다.

### 전투원과 신체

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `BodyPart` | body/BodyPart.js | 부위 하나의 내구도와 가드. 가드는 큰 값으로만 갱신하고, 0 아래로 내려가지 않게 막는다. 부상·결손 판정도 맡는다. | 캡 |
| `Fighter` | actors/Fighter.js | 전투원의 공통 기반. 부위들, 전체 체력, 쓰러짐 판정, 부위 회복, 배 상태에 따른 회복량을 맡는다. | 캡·상 |
| `PartyMember` | actors/PartyMember.js | 아군. 진영·직업 특성과 무기를 가진다. | 상 |
| `Nun` | actors/PartyMember.js | 수녀. 기술 칸이 3개이고, 쓰러지면 판이 끝난다. | 상·L |
| `Companion` | actors/PartyMember.js | 동료. 기술 칸이 2개이고 자기 장착 기술을 가진다. 간수·궁수 등은 데이터로 구분한다. | 상 |
| `Enemy` | actors/Enemy.js | 적. 철문 같은 장치(gate)를 조합으로 가진다. | 상·다 |
| `TrainingDummy` | actors/Enemy.js | QA 훈련장의 적. 쓰러지지 않고, 머리를 잃으면 모든 부위가 회복된다. | L |
| `FighterFactory` | actors/FighterFactory.js | 데이터 표를 전투원 객체로 바꾼다. 어떤 클래스와 장치를 쓸지는 여기서만 정한다. | S |

### 타격

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `NoGate`, `BellboyGate` | combat/gates.js | 공격을 앞에서 가로막는 장치. 벨보이 철문은 닫힘·벨·기절 단계에 따라 관통 공격만 통과시킨다. | 다·O |
| `HitDraft` | combat/HitDraft.js | 아직 적용하지 않은 타격 한 번. 보정들이 값을 채운다. | 캡 |
| `HitModifier`와 구현 8종 | combat/hitModifiers.js | 피해 보정 하나가 클래스 하나다. `preview`는 계산만, `commit`은 보너스 소모만 한다. 8종은 가드 제거 마무리, 부상 보너스, 훈련 배율, 약화, 수감자, 전사, 표식, 기세다. | O·추 |
| `DamageCalculator` | combat/DamageCalculator.js | 보정 목록을 순서대로 적용해 타격 결과를 계산한다. 상태를 바꾸지 않는다. | S |
| `HitResolver` | combat/HitResolver.js | 계산한 타격을 실제로 적용한다. 가드·내구도·체력·표식·반격을 갱신하고 이벤트와 기록을 남긴다. | S |

### 카드 효과

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `CardEffect` | cards/CardEffect.js | 카드 효과의 계약. `apply`(정한 대상에게), `activate`(충전되어 자동 발동), `ready`(지금 쓸 의미가 있는지)로 이뤄진다. | 추 |
| `AttackEffect` | cards/effects/AttackEffect.js | 강타·정밀 타격·가드 깨기 계열. 여러 부위 타격, 조준·회복 뒤 일격 같은 준비 보너스를 처리한다. | 다 |
| `GuardEffect` | cards/effects/GuardEffect.js | 부위 가드 계열. 간수 시너지를 적용한다. | 다 |
| `CounterStanceEffect` | cards/effects/GuardEffect.js | 반격 자세. 가드를 올린 뒤 반격을 예약한다. | 상 |
| `HealEffect` | cards/effects/HealEffect.js | 회복 계열. 마법사 시너지와 회복 가드를 처리한다. | 다 |
| `SetupEffect`와 `SetupTactic` 5종 | cards/effects/SetupEffect.js | 설치형 전술. 5종은 가로막기, 가드 벗기기, 조준, 약화, 기세다. | 다·O |
| `CardRegistry` | cards/CardRegistry.js | 카드의 effect 키를 효과 객체에 연결한다. 새 효과는 `register`로 추가한다. | O·다 |

### 전투 진행

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `EnemyPlanner` | combat/EnemyPlanner.js | 적의 다음 행동을 고르고, 쓸 수 없는 행동은 바꾼다. 화면에 보일 예고도 만든다. | S |
| `TargetSelector` | combat/TargetSelector.js | 기술이 스스로 대상을 고르는 규칙. 공격 표적, 회복 대상, 가드 대상을 정한다. 공격 표적은 실제 타격과 같은 계산으로 비교한다. | S |
| `CooldownBattle` | combat/CooldownBattle.js | 쿨타임 자동 전투 한 걸음. 시간 진행, 기술 발동 순서, 적 차례, 추격을 처리한다. | S |

### 일행과 진행

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `Party` | party/Party.js | 대열과 생존 명단, 진영 판별, 자리 옮기기를 맡는다. | S·I |
| `Loadout` | party/Loadout.js | 장착 기술, 장착 가능 여부, 충전 시간, 기술을 지금 못 쓰는 이유를 맡는다. | S |
| `SynergyBook` | party/SynergyBook.js | 진영·직업 시너지의 활성 여부와 전투당 1회 사용을 관리한다. | 캡 |
| `RunFactory` | run/RunFactory.js | 새 판의 지도와 초기 상태(기본, 시드, QA 훈련장)를 만든다. | S |
| `Journey` | run/Journey.js | 방 진입, 이동과 도망 여유, 전투 종료 판정, ? 방, 정비 계단 치료를 맡는다. | S |
| `Recruitment` | run/Recruitment.js | 전투 뒤 동료 제안, 영입과 교체, 보상 화면 전환을 맡는다. | S |
| `RewardDraft` | run/RewardDraft.js | 시드로 재현되는 기술 보상 추첨과 선택을 맡는다. | S |
| `BlackMarket` | run/BlackMarket.js | 암시장 상품의 대상, 구매 조건, 구매를 맡는다. | S |
| `MapGenerator` | map/MapGenerator.js | 시드 지도의 방 배치와 연결을 만든다. | S |
| `StateEventSink` | events/StateEventSink.js | 도메인 이벤트(`emit`)와 행동 기록(`log`)을 판 상태에 쌓는다. | D·추 |

## 응용·기반 (`src/application/`, `src/infrastructure/`)

| 이름 | 역할 | 원칙 |
| --- | --- | --- |
| `createGameServices` | 규칙 객체를 만들고 연결하는 조립 지점. 밸런스 도구용 교체 지점(`seams`)을 받는다. | D |
| `AutoBattleRunner` | 자동 전투 타이머. 일시정지와 배속을 관리하고 예약은 하나만 유지한다. 언제 멈출지와 한 걸음에 할 일은 host가 정한다. | D·S |
| `TimeoutScheduler` | `setTimeout`을 `Scheduler` 계약(`after`, `cancel`)으로 감싼다. 테스트는 수동 스케줄러를 넣는다. | D |

## 화면 (`src/ui/`)

일반 스크립트라서 같은 전역 범위를 쓴다. 상태를 가진 화면 요소만 클래스로 만들었고, 각 파일 끝에서 인스턴스를 하나 만든다. 상태가 없는 HTML 템플릿 함수는 함수로 남겼다. 해당 파일은 hud, body-panel, skill-cards, map, rooms다.

| 클래스 | 파일 | 역할 | 원칙 |
| --- | --- | --- | --- |
| `GameScreen` | render.js | 상단 표시와 훈련·QA 도구를 갱신한다. `game.phase`에 맞는 `Screen`에 무대를 맡긴다. | 다·O |
| `Screen`과 구현 5종 | render.js | 단계별 무대 화면이다. 5종은 전투, 전투 준비, 보상, 이동(영입·? 방·지도), 종료다. | 추·다 |
| `PursuitHud` | render.js | 직전 도망 여유를 기억해 사형수 접근 연출과 경고를 낸다. | 캡 |
| `QaPanel` | render.js | QA 도구의 열림 상태와 즉시 승리·회복·도망 여유 치트를 맡는다. | 캡 |
| `AutoBattleControls` | render.js | 일시정지·배속 버튼, 자동 전투 한 걸음 뒤의 화면 반영을 맡는다. | S |
| `CombatPresenter` | combat-presenter.js | 쌓인 도메인 이벤트를 순서대로 재생하는 연출 타임라인. 재생 중에는 자동 전투가 멈춘다. | S·캡 |
| `ActorSprites` | combat-presenter.js | 인물 자세, 팔 결손·무릎 꿇기 그림, 상처 표시, 벨보이 철문 그림을 맡는다. | S |
| `HitEffects` | combat-presenter.js | 피해 숫자, 체력·가드 표시, 부상 결과, 날아가는 화살·주문, 기술 이모트를 맡는다. | S |
| `WebAudioSynth` | audio.js | 소리 재료(음, 잡음)를 만든다. | S |
| `CombatAudio` | audio.js | 상황별 효과음을 정하고, 오디오 장치와 켜고 끈 상태를 가진다. | 캡·D |
| `OpeningView` | opening.js | 홈 → 만화 → 안내 → 첫 전투 흐름과 튜토리얼 기록을 맡는다. | 캡 |
| `CodexView` | codex.js | 도감의 대원 탭, 희귀도 필터, 카드 목록을 맡는다. | 캡 |
| `FormationDrag` | input.js | 대원 카드 끌기와 끌기 직후 클릭 무시를 맡는다. | 캡 |
| `MapTravel` | input.js | 지도 이동 연출을 맡는다. 연출 중에는 입력을 막고, 새 판을 시작하면 취소된다. | 캡 |

`src/presentation/hit-fx.js`는 클래스가 아니라 `CPHitFx` 객체다. 타격 단계(일반·치명·부상·결손)별 숫자와 컷인, 연출이 붙잡는 시간을 정한다.

## 예전 전역 이름

테스트, QA 스크립트, Godot 도구는 `render`, `hit`, `game`, `autoPaused` 같은 예전 전역 이름을 문자열 코드로 부르거나 덮어쓴다. 그래서 다음 이름들을 남겨 두었다.

- **함수:** 클래스 메서드를 한 줄로 부르는 위임 함수다. `src/game-api.js`와 각 화면 파일 끝에 있다.
- **값:** 해당 객체의 필드를 읽고 쓰는 접근자다. `autoPaused`, `combatPresentation`, `routeTravel`, `codexMember` 등이 여기에 해당한다.

새 코드는 이 이름 대신 객체를 직접 쓴다.
