# 오프닝 만화


## 수녀 표정·자세 수정

ImageGen 수정 대상은 해당 웹판 컷이고, 캐릭터 참조는 V5 수녀 원화다.

Use case: identity-preserve edit for a story comic. Image 1 is the exact landscape 3:2 panel to edit. Image 2 is the V5 character identity reference, not a new scene. The character is a young adult woman and a reserved, modest, gentle nun. Give her a soft natural feminine presence entirely through the expression and body language, while keeping the original adult SD face identity and body proportions, wavy brown bob, amber irises, short purple cream-edged veil, high cream collar, purple habit, rosary, brass lantern and round seal-shield. No makeover, no cosmetics, no added skin, no redesign, no extra adornment. Preserve the target's camera, blocking, color value, warm amber illumination, medieval cell environment and original fine ink and muted hand-painted cel shading. Only change the nun details specified below. No blood, no overlay icons, no text, no borders. Horizontal full bleed, 3:2.

### 01-descent-v2

Soften the nun's downward gaze into calm attentiveness. Relax the inner brow and lids, and draw a gentle, neutral closed mouth. She is carefully stepping down the stairs to pray: lower her lantern arm closer to her side and tuck the round shield beside her hip, with a relaxed shoulder and less squared stance. Preserve her placement at the left and the full staircase composition for use as the home screen.

### 02-cell-v2

Give the nun a gentle compassionate downward gaze toward the seated man, a slightly bowed head, relaxed natural eyebrows and a soft quiet closed mouth. Stand with her feet naturally closer together and let her shoulders and elbows relax. Hang the lantern close to her body and lower the shield to her side so it reads as carried equipment. Keep the same bars, seated man, distances and framing.

### 05-quake-v2

She is startled by falling stones and recoils into a small protective crouch, shoulders lifted, elbows close. Instead of thrusting the shield overhead at full arm extension, angle it close to the temple and duck her head behind it. Keep the lantern near her body. Show the startled youth of this adult woman's face with raised inner brows, rounded eyes and a small gasp. Remove the drawn sweat-drop mark. Keep the falling stones, lighting, broken floor and empty corridor.

### 07-flight-v2

Make the same woman clearly flee the earthquake, worried and in a hurry. Soften her fierce glare into wide watchful eyes, raised inner brows, and a small parted mouth. Tuck her elbows and hold the brass lantern closer so the flame is sheltered. Keep her round shield low and close against the outside of her arm. A quick light stride, less exaggerated leg spread, narrow shoulder line, soft folds of the same habit. Reduce the extraneous speed lines a little; keep the direction, rubble and completely empty corridor.

### 08-pursuit-v2

Change only the nun's expression and right-foreground posture. She glances back quietly in alarm with soft raised inner brows, round open eyes, and a slightly parted natural mouth. Relax the aggressively angled brow. Her shoulder draws inward and she pulls the same lantern and shield close protectively, still moving away. Remove the drawn sweat-drop marks. Keep the male prisoner far down the passage in the same position, the empty space between them, and the original framing.

Codex 내장 ImageGen으로 컷별 제작했다. 수녀는 `art/characters/nun-sd.png`, 사형수는 `art/concepts/v2/pursuer-concept-v2.png`, 감옥은 `art/arena/prison-backdrop.webp`를 참조했다. 지진과 도주 컷에는 수녀와 감옥 배경만 참조했다.

## 공통 프롬프트

Use case illustration-story. Make exactly one full-bleed landscape comic panel, 3:2 aspect ratio, for the original Korean fantasy auto-battle game 붕괴 통로. No gutters, border, grid, inset panels, words, speech bubbles, logos, writing, or signatures. Match character identity strictly to references. Reference 1 is final V5 adult nun identity and rendered style: short wavy brown bob, amber eyes, dark muted-purple short veil with thick cream edge, cream shoulder collar, purple tunic, rosary, rope belt and brown boots, brass flame lantern and circular wood shield with red wax candle insignia. Use identical stylized SD proportions and colors, recognizable face. Reference 2 is the adult condemned man identity: short buzz-cut brown hair, narrow eyes, sharp jaw, bare neck, long ragged cream prison robe, heavy black metal cuffs and chains. Use the concept for character only, never reproduce its layout or typography. Reference 3 is the underground prison environment and palette: black iron cell bars and aged slate block stone, smoky plum shadows, brass, warm localized amber lamplight. Medium is detailed hand-painted anime graphic novel with clean thin warm ink lines, muted color, cel shading and texture consistent with the source game. Restrained cinematic lighting, readable silhouettes, genuinely episodic compositions. No blood or graphic injury.

## 컷별 프롬프트

### 01-descent

High oblique establishing shot down a steep twisting stone stairway into an underground prison. The young adult nun is alone, distinctly descending from the upper left into the dark lower landing, her warm lantern is the focal point. Her wooden shield hangs on the other arm. The stairs and perspective show her coming down.

### 02-cell

Side-on medium-wide view. The nun stands calmly on the corridor side of a locked black iron-barred cell and faces the condemned man. Her lantern lights the space between them. He is seated on a plain stone bench inside the cell, head lowered, wrists in heavy cuffs. Unbroken bars clearly separate the two.

### 03-prayer

Intimate medium-wide profile view. The nun is unmistakably down on both knees on the corridor floor outside the barred cell, her head bowed, eyes closed, fingers clasped in prayer. Her lit brass lantern and round wax-seal shield are set beside her. The same condemned man sits beyond the closed bars on a low stone bench, quiet, his head slightly lowered, no touch.

### 04-glance

Cinematic reverse angle from just inside the cell, looking past the seated prisoner's shoulder between thick iron bars. The condemned man's close-cropped head turns and his narrow eyes look directly toward the nun rather than the viewer. The nun's back is turned as she walks away down the corridor with her lantern and shield. Emphasize his eye line and her departure.

### 06-chaos

Wide environment shot of the underground prison at the peak of an earthquake. Several bent cell doors hang ajar, one small distant guard reaches toward a dropped lantern, a few distant silhouettes scatter amid smoke and falling dust, broken stone and an overturned bench. The chaos is in the environment, all people are distant, no close-up characters, no visible injuries. Gold and purple-blue light.

### 08-pursuit

Deep one-point perspective. Over the shoulder of the fleeing nun, we see her turn her head back at the edge of the picture, her small lantern and shield recognizable. Far down the ruined corridor under a rear arch, the same close-cropped condemned man emerges from the dark and takes a visible heavy step toward her, chains trailing on the floor. Man is distant, solitary and recognizable, half in dark with lit rim, separated from her by much empty corridor. Quiet ominous ending, no confrontation.

## 지진·도주 최종 프롬프트

Use case illustration-story. One full-bleed 3:2 widescreen comic panel for the underground prison of the game 붕괴 통로. Match the nun reference's exact stylized SD proportions and warm line art, dark purple cream-edged veil, short wavy brown bob, amber eyes, cream collar, purple linen habit, rosary, rope belt, brown boots, glowing brass candle lantern and circular wooden shield with red wax candle seal. Match dark charcoal and warm plum dungeon palette and thick black iron bars of reference 2; fracture this same stone due to the earthquake. Hand-painted muted anime graphic novel, clean thin ink lines and cel shading. Clearly readable. No blood, no other person, no text, borders, grid, stamps, captions or typography.

### 05-quake

A slanted wide composition of a large earthquake hitting a medieval stone prison corridor. One young adult nun from the character reference is the only person in the picture. Alone, she has stopped mid-step under a cracking stone arch, stacks of stones are coming loose, she guards her head with her round wooden shield, her warm brass lantern in other hand swings sideways. Blue-purple shadow in the cracked stone vaults, amber highlights on airborne dust. The corridor behind her is EMPTY from edge to edge, no body or person or face in shadows, no prisoners, all cells entirely dark and empty. Strongly feature cracked masonry and quake. Reference 1 nun; reference 2 architecture.

### 07-flight

Energetic side-tracking full-body shot of one young adult nun from the character reference running alone out of a collapsed prison passage. Her silhouette and boots clearly show her running at full speed rightwards, lantern clasped tightly in her left-side hand and round wooden wax-seal shield rotated on the other arm. Fallen stone blocks, leaning iron bars, an empty path behind her, drifting dust, long diagonal torchlight, background streaks imply movement. Show only the nun as a person in the entire frame. Completely empty background: any dark space in the background is just jagged stone archways and empty cells, no silhouettes of any human or creature, no pursuer. Reference 1 nun; reference 2 architecture.
