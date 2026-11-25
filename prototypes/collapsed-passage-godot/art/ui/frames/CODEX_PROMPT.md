이 저장소의 Godot 게임 `prototypes/collapsed-passage-godot`(루치아: 빈콜리의 등불, 어두운 감옥 탈출 덱빌딩 오토배틀러)에 쓸 UI 프레임 이미지 5장을 이미지 생성 기능으로 만들어 줘. 지금 UI는 단색 상자에 얇은 선만 있어서 웹 폼처럼 딱딱해 보여. 손으로 칠한 배경·캐릭터와 어울리는 낡은 철판·황동 질감으로 바꾸려는 거야.

## 규칙

- 코드는 한 줄도 고치지 마. 이미지 파일만 만들어.
- 저장 위치: `prototypes/collapsed-passage-godot/art/ui/frames/raw/`. 아래 표의 파일 이름을 그대로 써.
- 배경은 투명 PNG로 만들어. 투명이 안 되면 물체 바깥을 완전히 균일한 `#FF00FF` 마젠타로 채워. 그림자나 번짐 없이 경계가 딱 떨어져야 해.
- 다섯 장이 한 세트로 보여야 해. `panel.png`를 먼저 만들고, 나머지는 그 이미지를 참고 이미지로 붙여서 같은 재질, 같은 조명, 같은 붓질로 맞춰 줘.
- 9-slice로 늘려 쓸 거야. 그래서 모서리 장식은 네 귀퉁이에만 두고, 귀퉁이 사이 변은 처음부터 끝까지 같은 무늬여야 해. 리벳, 금, 흠집이 변 가운데에 하나만 있으면 안 돼.
- 글자, 아이콘, 캐릭터, 발광, 원근, 바깥 그림자는 넣지 마. 정면 직교 시점이고 가장자리는 완전히 수평·수직이어야 해.
- 마음에 안 들면 다시 생성해도 돼. 다 만들면 파일 목록, 각 이미지 크기, 투명인지 마젠타인지 알려줘.

## 공통 스타일

모든 프롬프트 앞에 이 문단을 붙여:

> Game UI asset for a dark, gritty prison-escape deckbuilding game with hand-painted dungeon backgrounds and chibi characters. Hand-painted matte metal, slightly worn and scratched, painterly but clean, readable at small size. Strictly front-facing orthographic view, perfectly straight horizontal and vertical edges, no perspective, no drop shadow, no glow, no text, no letters, no icons, no characters. Decoration only in the four corners; the edges between corners are uniform along their whole length so the image can be 9-slice stretched. Transparent background outside the object.

## 만들 이미지

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `panel.png` | 1024×1024 | 상태 줄, 정보 패널, 대화 상자 |
| `button.png` | 1536×1024 | 일반 버튼(호버·누름은 색조로 처리) |
| `primary.png` | 1536×1024 | 출발, 확인 같은 주 버튼 |
| `frame.png` | 1024×1024 | 전투 무대를 두르는 테두리, 안쪽은 비어 있음 |
| `slot.png` | 1024×1024 | 기술 칸처럼 안으로 파인 홈 |

### panel.png
> Object: one rectangular UI panel filling almost the whole square canvas, with a margin of about 3% of transparent space around it. Blackened wrought-iron plate with a faint hammered texture. A thin worn dull-brass trim (#604c47 to #8a6b4f) runs along all four edges, with one small brass rivet in each corner only. The interior is a flat, even, very dark charcoal-plum iron (#201c20) with only very faint texture, so light cream text (#f6e6ce) placed on it stays clearly readable.

### button.png
> Object: one wide horizontal button plate, about 4 times wider than tall, centered on the canvas with transparent space around it. Dark iron face (#2a2327) with a thin bevelled rim of dull worn brass (#604c47 to #8a6b4f) and small chamfered corners. The face is flat and even so a short label fits on it. Match the material and lighting of the reference panel.

### primary.png
> Object: one wide horizontal primary-action button plate, about 4 times wider than tall, centered on the canvas with transparent space around it. Deep bronze-brown enamel face (#4c3328) with a thicker, brighter polished brass rim (highlights near #edc78e), slightly embossed, small chamfered corners with a tiny brass rivet in each. The face is flat and even so a short label fits on it. It must clearly look more important than a normal button. Match the material and lighting of the reference panel.

### frame.png
> Object: a heavy rectangular border frame that fills the whole square canvas, like the iron surround of a cell window. Riveted blackened iron bars about one tenth of the canvas thick, with worn brass corner brackets. Rivets only in the corner brackets, not along the bars. The whole inside of the frame is completely empty and transparent. Match the material and lighting of the reference panel.

### slot.png
> Object: one square recessed socket filling almost the whole canvas, as if pressed into an iron plate. A thin worn brass lip around the edge, then an inner bevel going down into a flat, very dark, almost black floor (#141214). No rivets on the edges. The floor is flat and even, because a card picture will sit on top of it. Match the material and lighting of the reference panel.
