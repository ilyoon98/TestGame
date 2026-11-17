# Visual Design: PROJECT Z (prototype)

**Concept-Derived Visual Tags**: #geometry-chunky-toy-primitives, #render-flat-matte-shading, #motionviz-toy-bob

## 1. Visual Concept

**손으로 깎은 나무 장난감 동물원** — 육각 타일 보드 위에 둥글고 뭉툭한 저폴리 장난감들이 놓여 있고, 상태 변화는 글자보다 자세·움직임·색 한 가지로 전달한다.

## 2. Color Palette (색 = 역할 하나)

| Role | Hex | Usage |
|:---|:---|:---|
| Field / 바탕 | `#e3ebe5` (UI) · `#7fb951` (잔디) | 배경, 패널, 타일. 채도 낮게 유지 |
| Ink / 정보 | `#1f2a24` | 본문, 숫자, 일반 상태 |
| Action / 조작 | `#2f6b4f` | 선택된 탭·도구, 주 버튼, 특화 관리(좋은 상태) |
| Reward / 보상 | `#c98d1c` | 골드, 수익, 동전 연출, 포획 성공 — **돈과 관련된 것만** |
| Danger / 위험 | `#c4513b` | 관리 공백, 탈출 경고, 끈 끊김, 사직 예정 — **문제만** |
| Calm / 시간 | `#4f91b8` | 기절 시간, 보호소 체류 시간, 직접 돌봄 |

서식지 색(초원·숲·수변)은 작은 사각 견본으로만 쓴다(칩·테두리 금지).

## 3. Object Rendering

- 동물: 구(icosahedron 1단계) + 원기둥 + 원뿔 조합, 플랫 셰이딩, 큰 머리 비율. 종별 실루엣이 먼저 읽히도록 특징 1개를 과장(토끼 귀, 양 털뭉치·뿔, 여우 꼬리, 곰 이끼, 버섯 갓, 수달 물방울, 크라켄 다리, 드래곤 날개·불꼬리).
- 사육사: 같은 문법의 인형. 사파리 모자 + 특화 서식지 색 셔츠. 근무 중에는 양동이를 든다.
- 초상 이미지: 같은 3D 모델을 별도 렌더러로 찍어 카드·목록에 사용 → 화면과 UI가 같은 세계.

## 4. Background & Environment

배경(채도 낮은 세이지) → 보드(타일·나무·건물) → 오버레이(게이지·숫자) 3층. 나무와 장식은 가장자리에 몰고 중앙은 비운다.

**빛과 색 관리** (`setupLook()` 한 곳에서 두 장면 공통)
- 코드의 hex 색은 sRGB → 선형으로 변환해 계산, 출력은 sRGB 인코딩. 톤매핑은 끔(팔레트 채도 유지).
- 하늘빛 Hemisphere `#dceeff`/`#6e7d52` 0.62 + 햇빛 Directional `#fff0d4` 0.62 (그림자). 해를 받는 윗면 ≈ 지정 색 그대로, 옆면은 약 60% 밝기로 입체감.
- 그림자 bias −0.0004 / normalBias 0.03, 그림자 카메라는 보드 크기에 맞춤.

## 5. Feedback Effects

| Event | Visual Response |
|:---|:---|
| 마취 명중 | 개체가 옆으로 쓰러짐 + 파란 원형 타이머 |
| 깨어남 임박 | 타이머가 빨강으로 깜빡임 |
| 묶인 채 몸부림 | 모델이 좌우로 떨림, 끈 내구도 바 감소 |
| 도주 | 개체가 빨리 뛰고(통통) 탈출 지점 링이 빨갛게 맥동 |
| 포획 | 개체 사라짐 + 금색 숫자 |
| 수익 | 사육장 위로 금색 `+N G` 상승 (공백이면 흐린 붉은색) |
| 관리 공백 | 사육장 바닥 테두리가 빨강으로 맥동 |
| 침상 부족 | 사육사가 휴게실 앞 벤치에 앉아 대기 (침상이 있으면 건물 안으로 사라짐) |

## 7. AI-Generated Look Suppression Rules

### 7.1 Visual Hierarchy Rules

- Protagonist: 탐험 — 끈에 묶인 대상 개체(가장 큰 움직임 + 끈 선). 동물원 — 동물이 든 사육장.
- Threat: 탈출 지점(동굴·깊은 물)의 빨간 맥동 링, 공백 사육장의 빨간 테두리.
- Reward: 금색 숫자(동전 상승, 골드 잔고). 금색은 다른 곳에 쓰지 않는다.
- 2-second recognition check: HUD를 가려도 "쓰러진 동물=기회, 빨간 링=위험, 금색=돈"이 읽혀야 한다.

### 7.2 Limits on Familiar Template Symbols

- Adopted familiar elements (max 2): HP 바, 원형 타이머.
- Replaced unique element: 이모지 아이콘 전부 → 3D 모델과 그 초상 이미지, 서식지 이모지 → 색 견본, 상태 알약 칩 → 색 글자 한 줄.

### 7.3 UI-Independent Feedback

| Event | Non-UI visual response | Intensity |
| :---- | :--------------------- | :-------- |
| Score (수익·포획) | 금색 숫자 상승, 포획 시 개체 소멸 | Med |
| Damage (끈 손상·도주) | 모델 떨림, 탈출 링 맥동 | High |
| Near miss (깨어남 임박) | 기절 타이머 빨강 깜빡임 | Med |

### 7.4 Composition and Gaze Guidance

- Initial focal point: 보드 중앙의 사육장 줄(동물원) / 끈이 걸린 개체(탐험).
- Visual flow: 상단 골드 → 3D 보드 → 아래 카드(세부 조작).
- Anti-center-clutter implementation: 장식 나무는 보드 가장자리, 라벨은 짧게(번호+상태), 설명 문장은 카드 영역으로.

## UI 규칙 (화면 크롬)

- 이모지 금지(로그·버튼·탭·라벨). 아이콘이 필요하면 3D 초상 또는 색 견본.
- 알약형 칩 대신 색 글자 한 줄. 상태 색은 위 역할표에서만 고른다.
- 숫자는 tabular-nums, 큰 숫자는 굵게 — 꾸밈보다 위계로 구분.
- 모서리 6~8px, 그림자 없음, 1px 선.
