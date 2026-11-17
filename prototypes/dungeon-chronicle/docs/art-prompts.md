# 캐릭터 아트 제작 기록

방식: 내장 imagegen 도구, 투명 배경 편집.

최종 자산: `dist/assets/race-bases-simple.png`.

종족 기본 몸체는 3열 × 2행의 단순한 픽셀 스프라이트 시트다. 첫 행은 인간·엘프·드워프, 두 번째 행은 고블린·언데드·빈 칸이다. 처음 생성한 세밀한 그림은 사용자의 수정 요청에 따라 단순한 점 눈과 큰 색 블록으로 다시 만들었다. 게임에는 단순한 최종 자산을 사용한다.

## 최종 프롬프트

Use case: style-transfer. Edit target: attached fantasy race atlas. The user explicitly rejected the current excessive detail. RADICALLY SIMPLIFY all five sprites to extremely tiny minimalist 16x24-pixel retro characters like an early 8-bit game. This must be a complete stylistic redraw, not just pixelating detailed portraits. Keep species order, 3 columns x 2 rows with empty last cell, actual transparent background. Each character constructed from ONLY around 100 large square blocks, roughly 16 pixels wide and 24 pixels tall, MAXIMUM 6 flat colors per character, exactly one black square per eye, no mouth details, no fingers, no hair strands, no clothing texture, no gradients, no antialiasing, no realism, no soft shading. Heads are simple 8x8 block shapes, torso simple rectangle, arms simple two-pixel-wide strips, feet simple rectangular boots. Same centered coordinate system and same feet baseline in every cell so clothes can be overlaid programmatically. Visual distinction ONLY: human tan face and solid brown hair cap, elf pale face with two tiny pointed ear extensions and solid blonde hair cap, dwarf tan face with a single solid copper beard block, goblin plain green face with small triangular ears, undead cream skull with two simple black eyes. All bodies in identical plain slate tunic and boots; no hats, weapons, backpacks. They should look like simple tiny board-game tokens, NOT large illustrated chibi people. Strong hard square edges, uniformly chunky pixels, huge reduction of detail. Atlas layout exact 3x2, each cell has a 32x48 logical pixel canvas, base sprite positioned around x=8..24, y=12..40, all five align equally. Render at large size via NEAREST NEIGHBOR scaling only, preserve transparency, no text or decorations.

## 조합 방식

기본 몸체는 PNG 알파를 유지한 채 시트의 종족 프레임을 보여준다. 짐꾼 배낭은 뒤 레이어, 직업별 옷·모자·무기는 앞 레이어로 겹친다. 장비와 UI 아이콘은 게임 코드에 맞춰 고정 픽셀 좌표의 SVG로 작성했으며 브라우저에서 crispEdges와 pixelated로 렌더링한다.

## 이전 언데드 개정 몸체 — 현재 사용하지 않음

내장 imagegen 도구로 `dist/assets/undead-base-v2.png`를 생성했다. 이 개정 몸체는 v10부터 게임에서 사용하지 않는다. 당시 프롬프트:

A SINGLE minimalist early 8-bit skeleton game token, NOT an illustration. Plain bitmap pixel sprite made of big flat square blocks as if drawn in MS Paint at32x48 resolution. Fully transparent empty background. Ivory skull, two BIG PURE BLACK SQUARE HOLES for eyes with ONE flat turquoise square pixel in each, square black nose hole, exposed separate ivory jaw with three black tooth gaps, one dark angular skull crack. Gray ragged shirt, brown shorts and boots, very thin ivory bone arms and shins. Front facing, standing arms down. Maximum6 plain flat colors. No flesh and no ears and no hair. DO NOT ADD LIGHT, GLOW, HALOS OR AURA: bone and turquoise squares are ordinary opaque paint. No gradients, shading, lighting, soft edges, ground, shadow, texture, scenery, outline glow, atmosphere, weapons, hats, bags or text. Shape edges are coarse staircase right angles. Canvas aspect2:3. Head top begins25% down the canvas. Soles end at91.67% of canvas height. Figure centered x50%, head width31.25% of canvas, body with arms width50% of canvas. Large empty transparent area above for equipment layers. Output exactly one small plain SKELETON bitmap sprite, not a sprite sheet and not a shiny detailed artwork.

## 원본 얼굴만 해골로 — v10

방식: 내장 imagegen 도구의 투명 배경 편집. 원본 `race-bases-simple.png`를 참조해 편집하고, 출력 전체의 픽셀을 수정하지 않고 `race-bases-undead-face-v3.png`로 저장했다. 게임은 편집본 중 언데드 얼굴만 CSS 마스크로 보여준다. 다른 종족과 몸·팔·다리는 원본 PNG를 사용한다.

편집 프롬프트의 핵심: Use case: precise-object-edit. Edit the existing five-character pixel sprite sheet. Keep square transparency and 3×2 layout, simple chunky style. ONLY bottom-middle undead FACE: slightly enlarged square eye sockets, tiny nasal hole, simple teeth/jawline. Preserve head size/position/silhouette, original stout gray-shirted body, belt, arms, hands, trousers, boots. No skinny bones, ribs, glow, horns, extra props, details, or other character changes.

마지막 정리 프롬프트의 핵심: Precise cleanup of the exact 1254 RGBA sheet. Preserve character designs, silhouettes, scale, size, pose, clothes, centers/layout and skull. ONLY remove stray red/yellow/green/white fringe specks, halos/floating artifacts outside silhouettes; clean hard pixel edges and actual transparency. No redraw, smoothing, resize, or movement.
