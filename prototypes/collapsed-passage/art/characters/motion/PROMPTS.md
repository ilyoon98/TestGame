# 한 장씩 교체하는 공격·피격 키포즈

사용자 요청: Darkest Dungeon 1처럼 공격과 피격 때 각각 이미지 한 장을 잠시 보여준 뒤 기본 자세로 돌아온다. 부드러운 연속 프레임은 만들지 않는다. `2dimg2motion`의 원화 참조·전체 캐릭터 키포즈 재생성·손/무기 소유권 고정 원칙을 사용한다. 사용자 요청에 따라 기본 14프레임 대신 공격 1장과 피격 1장만 만든다.

도구: built-in `image_gen`. 각 인물의 두 자세를 같은 참조·같은 생성 시트에서 제작하고, 이후 기계적으로 좌우 셀을 분리해 공통 캔버스에 정리한다. 로컬 처리는 복사·분리·공통 크기 정규화만 수행하며 포즈나 팔다리를 그리지 않는다. 수녀·여성 동료의 기준 PNG는 256×384 참조로 축소했고 적은 기존 360×344/376 내장 WebP를 그대로 참조한다. 원본 캐릭터의 스타일·장비는 유지한다.

## nun

기준: art/characters/nun-sd.png. 최종 캔버스 1024×1536. Facing: right. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The SAME modest non-sexual SD nun, short black bob and amber eyes, SMALL nape-length black veil with thin ivory brow band, white covered neck and broad white shoulder cloth, dark long-sleeved tunic, rope belt/rosary, front-back dark loincloth panels OVER opaque dark SHORTS, bare knees, flat brown boots, round candle-seal shield and candle lantern. Preserve the exact clean cel-shaded SD style, proportions, face, symbols, and colors. No long veil, added weapon, skin exposure, or redesign.
TOPOLOGY LOCK (screen space): screen-RIGHT hand/forearm ALWAYS owns the ROUND shield; screen-LEFT hand ALWAYS owns the candle lantern. Never swap the two hands. The lantern handle stays gripped, never thrown. The shield remains attached to the original screen-right forearm.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 4:3 sheet, ideally 1536x1152, with each column a 2:3 portrait cell. Same 3.5-head SD body and head size as the reference, head top near 7% and boot soles near 94% of each cell's height.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One decisive SHIELD-BASH CONTACT key pose aimed screen RIGHT: screen-right shoulder and forearm push the round shield forward, torso leans slightly right, rear boot braces. Screen-left arm keeps the lantern close and clear of the shield. Determined expression. No projectile.
RIGHT / HIT: One brief RECOIL key pose from a blow arriving from SCREEN RIGHT: shoulders lean back toward screen left, knees flex, eyes squeeze shut and brows tighten. Keep screen-right shield and screen-left lantern visibly held in their original hands. No gore, torn clothing, or fall.
Direction: this character faces SCREEN RIGHT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## guard

기준: art/characters/guard-sd.png. 최종 캔버스 1024×1536. Facing: right. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The SAME non-sexual SD FEMALE guard, wine-red high ponytail, amber/honey eyes, CLOSED high-collar dark uniform, compact shoulder armor, waist belt and front/back dark panels over opaque shorts, bare knees, sturdy boots, wooden baton and rectangular iron-bound wooden shield. Exact same clean SD style, adult-character identity, equipment size and emblems. No revealing costume or redesign.
TOPOLOGY LOCK (screen space): screen-LEFT hand ALWAYS owns the WOODEN BATON, connected to the same screen-left shoulder; screen-RIGHT hand/forearm ALWAYS owns the RECTANGULAR SHIELD. The baton hand may cross the chest while staying connected to its original shoulder. Do not mirror or swap equipment.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 4:3 sheet, ideally 1536x1152, with each column a 2:3 portrait cell. Same 3.5-head SD body and head size as the reference, head top near 7% and boot soles near 94% of each cell's height.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One decisive BATON-STRIKE CONTACT key pose aimed screen RIGHT: the screen-left baton arm crosses forward in a clear diagonal strike toward the right, torso rotates slightly, shield stays in screen-right hand close to torso. One boot braces. Preserve weapon length. No second baton or detached weapon.
RIGHT / HIT: One readable standing RECOIL key pose from an incoming hit from SCREEN RIGHT: torso tilts back left, eyes squint, ponytail follows the head, knees bend, shield and baton stay in their locked hands. Keep the face recognizable. No injury gore or fall.
Direction: this character faces SCREEN RIGHT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## awakened

기준: art/characters/awakened-sd.png. 최종 캔버스 1024×1536. Facing: right. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The SAME non-sexual SD silver-haired female awakened inmate, wavy silver bob, lilac eyes, CLOSED-CHEST ivory tunic, dark scarf, belt/pouch, wrapped screen-left forearm, short broken wrist chain, worn ivory front/back panels over opaque shorts, bare knees and flat boots. Exact same modest costume, face, SD proportions, colors, chain length and wrist shackle. No horns, magic transformation, new weapon, or redesign.
TOPOLOGY LOCK (screen space): screen-RIGHT hand/wrist ALWAYS owns the SHORT broken chain and shackle. screen-LEFT hand remains an EMPTY fist/counterbalance with its forearm bandage. Do not transfer the chain or bandage to the opposite arm; do not lengthen it into a whip.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 4:3 sheet, ideally 1536x1152, with each column a 2:3 portrait cell. Same 3.5-head SD body and head size as the reference, head top near 7% and boot soles near 94% of each cell's height.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One clear CHAIN-HOOK CONTACT key pose toward SCREEN RIGHT: screen-right fist/short chain thrusts outward, shoulder and torso lean right, left empty fist anchors near the chest. Keep the short chain connected to its original wrist. Feet grounded.
RIGHT / HIT: One standing RECOIL key pose from SCREEN RIGHT: head and shoulders rock left, concerned clenched expression, knees bend; screen-right chain remains visible attached to the wrist, screen-left bandaged fist stays empty. No gore, fall or exposure.
Direction: this character faces SCREEN RIGHT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## janitor

기준: index.html#--art-janitor. 최종 캔버스 360×344. Facing: left. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The EXACT same adult stocky ragged prisoner from the baseline: grim gas-mask face, rough muscular gray skin, dirty dark worn shirt, yellow-brown apron with same tears, heavy boots, short dark bent metal pipe. Keep the existing gritty painted dark-fantasy style, NOT SD. Same body and costume, no redesign or new armor.
TOPOLOGY LOCK (screen space): screen-LEFT hand ALWAYS holds the SHORT BENT PIPE. screen-RIGHT hand remains EMPTY. Keep original shoulders and grip, never mirror the character or exchange the pipe.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 2:1 sheet, ideally 2048x1024, with each column a SQUARE cell. The entire existing adult body fills about 94% of the cell's height: top around 3%, soles around 97%, same apparent head size between both poses.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One PIPE-STRIKE CONTACT pose toward SCREEN LEFT: pipe-hand extends diagonally left/down, torso leans left, opposite empty arm braces. Preserve the pipe shape and length. Feet grounded.
RIGHT / HIT: One standing RECOIL pose from a strike arriving from SCREEN LEFT: shoulders recoil right, knees flex; pipe stays screen-left, empty hand screen-right. No new gore or wounds.
Direction: this character faces SCREEN LEFT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## crawler

기준: index.html#--art-crawler. 최종 캔버스 360×344. Facing: left. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The EXACT same thin adult crouching prisoner, messy dark hair, wrapped lower face, torn brick-red layered prison tunic, pale weathered skin, clawlike bare hands, brown boots. Keep hunched silhouette, existing gritty painted style, costume and proportions. Do not turn into a different creature or SD character.
TOPOLOGY LOCK (screen space): Both hands remain EMPTY and attached to their original shoulders. The screen-LEFT reaching arm is active; the other remains the anchored counterbalance. No new blade or weapon.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 2:1 sheet, ideally 2048x1024, with each column a SQUARE cell. The entire existing adult body fills about 94% of the cell's height: top around 3%, soles around 97%, same apparent head size between both poses.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One low CLAW-SWIPE CONTACT pose toward SCREEN LEFT: screen-left hand reaches to slash left at shoulder height while torso lunges low, opposite arm balances. Keep two arms/two legs and bent posture.
RIGHT / HIT: One crouched RECOIL pose from SCREEN LEFT: head jerks right, upper torso twists away, knees stay bent, hands empty and still attached correctly. No gore or falling.
Direction: this character faces SCREEN LEFT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## medic

기준: index.html#--art-medic. 최종 캔버스 360×376. Facing: left. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The EXACT same adult medical-clothed prisoner, pale serious face under wrapped white cap with goggles, dirty long ivory coat with worn RED CROSSES, dark neck scarf, brown straps, glass vials at screen-left belt and medical satchel at screen-right hip, dark gloves and boots. Preserve existing gritty painted style, all accessories and adult proportions; no new character or SD redesign.
TOPOLOGY LOCK (screen space): The screen-LEFT arm is the active empty gloved fist. screen-RIGHT arm stays near the satchel and its strap. Vials remain at the SAME screen-left waist; satchel remains at the SAME screen-right hip. Do not swap accessories or invent a syringe weapon.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 2:1 sheet, ideally 2048x1024, with each column a SQUARE cell. The entire existing adult body fills about 94% of the cell's height: top around 3%, soles around 97%, same apparent head size between both poses.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One guarded FIST-STRIKE CONTACT pose toward SCREEN LEFT: screen-left arm thrusts out in a short punch, torso rotates left, right hand anchors by the satchel. Keep goggles, cap, coat and vial ownership intact.
RIGHT / HIT: One standing RECOIL pose from SCREEN LEFT: upper body folds back right, expression tightens, coat shifts, original gloves/vials/satchel stay attached on their original sides. No gore or fallen vial props.
Direction: this character faces SCREEN LEFT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## sentinel

기준: index.html#--art-sentinel. 최종 캔버스 360×376. Facing: left. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The EXACT same bulky adult armored prisoner: closed slotted iron helmet, dark plate armor with faded yellow diagonal hazard paint, dark belt and short yellow-brown hanging cloth, heavy gauntlets/boots, tall dark rectangular yellow-striped shield. Exact gritty painted style, same armor silhouettes and markings. No SD redesign or new sword.
TOPOLOGY LOCK (screen space): screen-RIGHT forearm ALWAYS owns the RECTANGULAR armored shield. screen-LEFT gauntlet remains EMPTY and active for a punch. Keep original shield attachment, never swap sides or add a weapon.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 2:1 sheet, ideally 2048x1024, with each column a SQUARE cell. The entire existing adult body fills about 94% of the cell's height: top around 3%, soles around 97%, same apparent head size between both poses.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One heavy GAUNTLET-PUNCH CONTACT key pose aimed SCREEN LEFT: screen-left gauntlet drives left, torso leans left, shield remains screen-right as a counterweight. Clear unambiguous silhouette, grounded heavy boots.
RIGHT / HIT: One planted RECOIL pose from SCREEN LEFT: helmet and torso tip back right, shield stays screen-right and empty fist left. Armor plates remain coherent. No gore or flying body pieces.
Direction: this character faces SCREEN LEFT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## warden

기준: index.html#--art-warden. 최종 캔버스 360×376. Facing: left. Attack 1장 / hit 1장.

Use case: stylized-concept / whole-character action-key-pose redraw.
Purpose: TWO single-pose animation images for one existing character in the game "붕괴 통로". The user explicitly wants ONLY ONE attack pose and ONE hit pose, held briefly before returning to the existing idle. DO NOT generate a smooth multi-frame animation or add intermediate poses.
Use the supplied baseline image as the EXACT visual identity source, not loose inspiration. Only change pose, weight, limb angles and expression; preserve face, proportions, colors, outfit, weapon dimensions, outline weight, body-part count and rendering style. No redesign, beautification, simplification, extra effects or new costume details.
IDENTITY: The EXACT same huge adult jail-prisoner boss, tall barred iron cage helmet, red-brown torn padded leather coat, enormous heavy dark gauntlets, large neck/chest iron ring, strapped bulky shoulder/back armor and heavy boots. Preserve huge silhouette, original gritty painted style, colors and armor details. No SD redesign, new crown, new weapon, or body changes.
TOPOLOGY LOCK (screen space): Both gauntlets remain EMPTY, attached to their original shoulders. screen-LEFT fist is the active striking limb. screen-RIGHT fist braces/counterbalances. The iron ring remains centered on its original harness.
Layout: EXACTLY TWO equal columns in ONE transparent sheet, LEFT column=ATTACK and RIGHT column=HIT. Exactly ONE complete full-body sprite per column, exactly TWO sprites total, same character, not a character lineup. NO labels, letters, borders, UI, floor, debris, shadow, reference identity cell, spare tools or additional poses. True ALPHA TRANSPARENCY.
Landscape 2:1 sheet, ideally 2048x1024, with each column a SQUARE cell. The entire existing adult body fills about 94% of the cell's height: top around 3%, soles around 97%, same apparent head size between both poses.
Make large TRANSPARENT side gutters in EACH column (minimum 12% each side); no sprite or held equipment may enter another column or touch a frame edge. Character remains centered, feet share ONE floor baseline, body size identical in both columns; allow posture to widen but never shrink the character to fit. Complete hands, feet, helmet/hair, shield and weapon inside every cell.
LEFT / ATTACK: One crushing GAUNTLET-SMASH CONTACT key pose toward SCREEN LEFT: left heavy fist drives down and outward to the left with a deep torso lean, right fist braces. All armor and ring stay attached; both boots remain at floor.
RIGHT / HIT: One heavy standing RECOIL pose from SCREEN LEFT: helmet/shoulders wrench right, torso stiffens and knees flex, both gauntlets keep their roles and the big ring stays centered. No gore or dismemberment.
Direction: this character faces SCREEN LEFT in BOTH poses. The hit is a reaction to the opposite direction of their attack. Do not mirror.
This is the still-pose impact technique of 2D combat games: a highly readable attack CONTACT image, a highly readable hurt RECOIL image. Each full character must be freshly drawn by the image model in that pose; do not fake movement by only rotating the idle cutout.
Keep SD characters non-sexual and fully clothed; no nudity or erotic posing. Keep enemy portraits faithful to the provided original. No blood or added injury gore.

## 사망 컷

내장 ImageGen으로 인물별 `*-hit.png`를 참조하고 투명 배경을 요청했다. 결과물은 인물별 `*-defeat.webp`다.

### 수녀와 동료

> Game sprite, a new defeated pose for the same original game character as the supplied identity reference. Preserve exactly the face/helmet, colors, clothing coverage, hairstyle, rendering style, anatomy proportions and recognizable equipment. Draw a full-body isolated sprite slumped motionless on one side or on staggered collapsed knees with upper body and head bowed almost to ground, all props and limbs readable and contained inside the image. Weight is supported by the ground, clearly distinct from the standing hit pose. Face relaxed, eyes closed if visible. Non-graphic, no wounds or blood. Preserve the front three-quarter side-view perspective of the original side-view battle camera. Use a compact, low posture and a transparent surrounding canvas with clean alpha. Show the character and their own items, with no frame, background, text or glow.

수녀는 짧은 베일과 상아색 어깨천, 꺼진 등불과 둥근 방패를 사용했다. 간수는 붉은 포니테일과 검보라 제복, 사각 방패와 진압봉을 사용했다. 개화 수감자는 은발과 자두색 스카프, 붕대와 끊어진 사슬을 사용했다.

### 적

> Create a new terminal corpse sprite for this original gothic industrial prison dungeon game, using the provided image as the identity, equipment, and hand-painted style reference. Draw the aftermath of a devastating fantasy-game finishing blow, with an inert body that has fully collapsed and crumpled all the way down into a broad low irregular heap lying flat against the ground. The torso is horizontal, head at ground level, limbs slack and folded low with no propping on hands or knees, no sitting or rising. Make the silhouette read as a crushed dead body, with visibly crushed armor/fabric and a few scattered fragments of their own gear. Irregular black-burgundy staining and a small dark red smear beneath and to the side break up the edge of the heap. Keep the body itself recognizable as this specific enemy from costume, face or helmet, and signature prop. Use a side-on three-quarter camera perspective aligned to a 2D side-view battlefield, a wide low landscape composition, and actual transparent alpha around the body and debris. Keep the whole figure in frame with no scenery, extra figures, symbols or text.

탈옥한 죄수는 방독면과 황토색 앞치마, 녹슨 파이프를 사용했다. 기어오는 탈옥수는 헝클어진 머리와 적갈색 수감복을 사용했다. 의무실의 탈옥수는 고글과 흰 코트, 가죽 의료 가방을 사용했다. 방패 든 탈옥수는 좁은 눈구멍의 투구와 노란 사선 방패를 사용했다. 승강기실의 탈옥수는 철창 투구와 두꺼운 건틀릿, 붉은 수감복과 가슴의 철제 고리를 사용했다.
