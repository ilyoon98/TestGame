import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("preparation toggles known skills and requires exactly three equipped skills",()=>{
  const run=engine(1,{prep:true});
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("game.distance"),5);
  assert.equal(run("advanceAutoBattle()"),null);
  assert.equal(run("toggleEquippedSkill('crush')"),false);
  run("renderScreen();");
  const prep=run("document.querySelector('#stage').innerHTML");
  assert.match(prep,/전투 준비/);
  assert.match(prep,/수녀 부위별 내구도/);
  assert.match(prep,/class="skill-card-art" src="art\/skills\/emotes\/guard\.webp"/);
  assert.match(prep,/class="skill-card-art" src="art\/skills\/prayer\.webp"/);
  assert.equal((prep.match(/class="part-drawing"/g)||[]).length,6);
  assert.match(prep,/class="formation-member".*data-action="prep-member" data-side="player"/);
  assert.doesNotMatch(prep,/data-formation-side/);
  assert.deepEqual([...prep.matchAll(/class="formation-slot[^"]*" data-rank="(\d)"/g)].map(match=>match[1]),["2","1","0"]);
  assert.match(prep,/class="formation-portrait"><img src="art\/characters\/nun-sd.png"/);
  assert.match(prep,/aria-describedby="prep-tip-guard".*class="skill-term"><svg.*<strong>가드<\/strong>.*id="prep-tip-guard" role="tooltip".*가드로 아군 부위를 보호/s);
  assert.doesNotMatch(prep,/미장착/);
  assert.equal((prep.match(/aria-pressed="true"/g)||[]).length,3);
  run("game.skillLevels.force=1;");
  assert.equal(run("toggleEquippedSkill('force')"),false);
  assert.equal(run("toggleEquippedSkill('heavy')"),true);
  assert.equal(run("beginCombat()"),false);
  assert.equal(run("qaAvailable('win')"),false);
  run("renderScreen();");
  const partial=run("document.querySelector('#stage').innerHTML");
  assert.match(partial,/장착 2\/3/);
  assert.match(partial,/data-action="begin-combat" disabled/);
  assert.match(partial,/data-value="force"[^>]*aria-pressed="false"/);
  assert.equal(run("toggleEquippedSkill('force')"),true);
  assert.equal(run("game.combatTime"),0);
  assert.equal(run("beginCombat()"),true);
  assert.equal(run("beginCombat()"),false);
  assert.equal(run("game.cooldownBattle.skills.map(skill=>skill.id).join(',')"),"guard,force,strike");
  assert.equal(run("toggleEquippedSkill('heavy')"),false);
});

test("an assigned common card can move into a companion's free slot and fires from that companion",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('duct'); game.prepSide='companion';");
  assert.match(run("prepPanel()"),/data-value="strike"[^>]*aria-pressed="false"[^>]*>.*수녀 장착/s);
  assert.equal(run("toggleEquippedSkill('strike','companion')"),false);
  assert.equal(run("equippedBy('strike')"),"player");
  assert.equal(run("toggleEquippedSkill('baton','companion')"),true);
  assert.equal(run("toggleEquippedSkill('strike','companion')"),true);
  assert.equal(run("equippedBy('strike')"),"companion");
  assert.equal(run("sideLoadout('player').includes(null)"),true);
  assert.equal(run("toggleEquippedSkill('prayer')"),true);
  assert.equal(run("beginCombat()"),true);
  assert.equal(run("game.cooldownBattle.skills.find(skill=>skill.id==='strike').side"),"companion");
  run("while(game.phase==='combat' && game.cooldownBattle.elapsed<2000) advanceAutoBattle();");
  assert.equal(run("game.feedback.find(event=>event.card==='strike').from"),"companion");
});

test("the codex lists every playable card once and filters by its actual rarity",()=>{
  const run=engine(1,{prep:true});
  assert.equal(run(`(() => {
    const listed=Object.keys(codexLabels).flatMap(codexCardIds);
    return listed.length===new Set(listed).size && listed.length===Object.keys(skillCharge).length;
  })()`),true);
  assert.equal(run("codexCardIds('archer').includes('aimedShot')"),true);
  assert.equal(run("codexCardIds('common').includes('aimedShot')"),false);
  assert.equal(run("codexCardIds('common').includes('aim')"),false);
  run("codexMember='archer'; codexRarity='rare'; renderCodex();");
  const catalog=run("document.querySelector('#codex-content').innerHTML");
  assert.match(catalog,/감시탑 궁수/);
  assert.match(catalog,/data-card="needleShot"[^>]*data-tier="rare"/);
  assert.match(catalog,/data-rarity="rare">희귀/);
  assert.doesNotMatch(catalog,/data-tier="(?:common|uncommon)"|data-card="aimedShot"/);
});

test("victory offers both a new skill and an upgrade and accepts one choice",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); declineCompanion();");
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("new Set(game.rewards).size"),3);
  assert.equal(run("game.rewards.some(id=>!game.skillLevels[id])"),true);
  assert.equal(run("game.rewards.some(id=>game.skillLevels[id])"),true);
  assert.match(run("rewardPanel()"),/reward-kind learn[^>]*><svg/);
  assert.match(run("rewardPanel()"),/reward-kind upgrade[^>]*><svg/);
  assert.match(run("rewardPanel()"),/class="skill-card-art"/);
  assert.match(run("const rewards=game.rewards; game.rewards=['pierce']; const piercing=rewardPanel(); game.rewards=rewards; piercing;"),/class="skill-term"><svg.*<strong>공격<\/strong>.*class="skill-term"><svg.*<strong>관통<\/strong>.*id="reward-tip-pierce" role="tooltip".*적의 가드를 표시된 수치만큼 무시/s);
  run("moveTo('duct');");
  assert.equal(run("game.area"),"threshold");
  run("globalThis.learned=game.rewards.find(id=>!game.skillLevels[id]); globalThis.other=game.rewards.find(id=>id!==learned);");
  assert.equal(run("chooseReward(learned)"),true);
  assert.equal(run("chooseReward(other)"),false);
  assert.equal(run("game.skillLevels[learned]"),1);
  assert.equal(run("game.loadout.includes(learned)"),false);
  run("declineCompanion(); moveTo('duct');");
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("toggleEquippedSkill('heavy') && toggleEquippedSkill(learned)"),true);
  run("beginCombat();");
  assert.equal(run("game.cooldownBattle.skills[1].id"),run("learned"));
});

test("an upgrade lowers actual cooldown without unequipping a skill",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); declineCompanion(); globalThis.improved=game.rewards.find(id=>game.skillLevels[id]); globalThis.base=skillCooldown(improved);");
  assert.equal(run("chooseReward(improved)"),true);
  assert.equal(run("skillLevel(improved)"),2);
  assert.equal(run("skillCooldown(improved)"),run("base-400"));
  assert.equal(run("game.loadout.join(',')"),"guard,heavy,strike");
  run("declineCompanion(); moveTo('duct'); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.find(skill=>skill.id===improved).cooldown"),run("base-400"));
});

test("new exclusive cards favor active owners and unlock on selection",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); declineCompanion();");
  assert.equal(run("game.rewards.filter(id=>cards[id].character==='nun').length"),2);
  assert.equal(run("game.rewards.filter(id=>!exclusiveSkill(cards[id])).length"),1);
  assert.equal(run(`game.rewards.filter(id=>cards[id].character==="nun")
    .every(id=>rewardPanel().includes('src="'+skillArtSrc(id)+'"'))`),true);
  run("globalThis.unlocked=game.rewards.find(id=>cards[id].character==='nun');");
  assert.equal(run("availableSkills().includes(unlocked)"),false);
  assert.equal(run("chooseReward(unlocked)"),true);
  assert.equal(run("availableSkills().includes(unlocked)"),true);
  run("moveTo('duct'); beginCombat(); game.enemy.hp=0; finishCombat(); recruitCompanion('archer');");
  assert.equal(run("game.rewards.includes(unlocked)"),true);
  run("chooseReward(null); moveTo('lift');");
  assert.equal(run("skillRewardOptions().every(id=>partySides().some(side=>skillFits(cards[id],game[side])))"),true);
  run("game.skillLevels.longShot=1; game.formation[2]=null;");
  assert.equal(run("availableSkills('companion').includes('longShot')"),true);
  assert.equal(run("availableSkills('player').includes('longShot')"),false);
  assert.equal(run("skillRewardOptions().some(id=>cards[id].character==='archer')"),false);
  run("start({seed:'V5-01',widths:[1],training:true});");
  assert.equal(run("partySides().every(side=>availableSkills(side).filter(id=>cards[id].reward && cards[id].character===game[side].kind).length===12)"),true);
});

test("seeded rooms reproduce the ordered rewards after restart and ignore unrelated random draws",()=>{
  function rewardTrace(run){
    return run(`beginCombat(); game.enemy.hp=0; finishCombat(); recruitCompanion("guard");
      globalThis.first=game.rewards.join(",");
      chooseReward(game.rewards[0]);
      moveTo(areas.threshold.next[0]); beginCombat(); game.enemy.hp=0; finishCombat(); while(game.pendingCompanion) declineCompanion();
      [first,game.rewards.join(",")].join("|");`);
  }
  const first=engine(1), second=engine(2);
  const config="{seed:'reward-replay',widths:[1],shops:0,rests:0,elites:0}";
  first(`start(${config});`);
  second(`start(${config}); for(let i=0;i<50;i++) Math.random();`);
  const expected=rewardTrace(first);
  assert.match(expected,/^[^|]+\|[^|]+$/);
  assert.equal(rewardTrace(second),expected);
  first("start()");
  assert.equal(rewardTrace(first),expected);

  const starters=engine();
  assert.equal(starters(`start(null,"classic-replay"); beginCombat(); game.enemy.hp=0; finishCombat(); declineCompanion();
    globalThis.classic=game.rewards.join(",");
    start(); beginCombat(); game.enemy.hp=0; finishCombat(); declineCompanion(); game.rewards.join(",")===classic;`),true);
});

test("rarity is shown separately from levels and empty tiers do not suppress a legal reward",()=>{
  const run=engine();
  assert.equal(run("drawSkillReward(['lanternWash'],()=>0,true)"),"lanternWash");
  assert.equal(run("drawSkillReward(['lanternWash','votiveStrike'],()=>0,true)"),"votiveStrike");
  assert.equal(run("drawSkillReward(['lanternWash','votiveStrike'],()=>.99,true)"),"lanternWash");
  run("game.rewards=['lanternWash']; game.skillLevels.lanternWash=2;");
  assert.match(run("rewardPanel()"),/data-rarity="rare">희귀<.*레벨 2 → 3/s);
  assert.match(run("prepPanel()"),/data-rarity="rare">희귀<.*Lv.2/s);
});

test("every class skill resolves card and battle art, and dedicated assets remain distinct",()=>{
  const run=engine();
  const art=JSON.parse(run(`JSON.stringify(Object.keys(skillCharge).filter(id=>cards[id].character)
    .map(id=>({card:skillArtSrc(id),emote:skillEmoteSrc(id),shared:Boolean(cards[id].artFrom)})))`));
  for(const variant of ["card","emote"]){
    const paths=new Map(art.map(entry=>[entry[variant],readFileSync(new URL(`../${entry[variant]}`,import.meta.url))]));
    const custom=art.filter(entry=>!entry.shared);
    const hashes=custom.map(entry=>createHash("sha256").update(paths.get(entry[variant])).digest("hex"));
    assert.equal(new Set(hashes).size,custom.length,`duplicate dedicated ${variant} files`);
  }
});

test("faction and job badges describe effects and recruitment previews use separate tooltip IDs",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('duct');");
  const prep=run("prepPanel()");
  assert.match(prep,/data-group="faction"[^>]*aria-describedby="trait-tip-companion-guard"/);
  assert.match(prep,/id="trait-tip-companion-guard" role="tooltip".*진영 · 2명 출전.*맨 앞 대원에게 처음 주는 가드 \+2/);
  assert.match(prep,/data-group="job"[^>]*aria-describedby="trait-tip-player-mage"/);
  run("beginCombat(); game.enemy.hp=0; finishCombat();");
  const recruit=run("companionEncounterPanel()");
  assert.match(recruit,/trait-tip-candidate-archer/);
  assert.match(recruit,/trait-tip-preview-join-guard.*간수 1→2/);
  assert.equal(new Set([...recruit.matchAll(/id="(trait-tip-[^"]+)"/g)].map(match=>match[1])).size,3);
});

test("reward selection respects the level cap and restart clears progression",()=>{
  const run=engine();
  run("for(const id of availableSkills()) game.skillLevels[id]=maxSkillLevel; game.enemy.hp=0; finishCombat(); declineCompanion();");
  assert.equal(run("game.rewards.every(id=>!game.skillLevels[id])"),true);
  run("chooseReward(game.rewards[0]); start();");
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("Object.keys(game.skillLevels).length"),3);
  assert.equal(run("availableSkills().every(id=>skillLevel(id)===1)"),true);
  assert.equal(run("game.combatTime"),0);
});

test("a companion adds two moves which fire from that companion and stop on death",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('duct');");
  assert.equal(run("availableSkills('companion').includes('baton')"),true);
  assert.equal(run("availableSkills('player').includes('baton')"),false);
  assert.equal(run("game.companion.loadout.join(',')"),"baton,escort");
  run("beginCombat(); globalThis.baton=game.cooldownBattle.skills.find(skill=>skill.id==='baton'); baton.readyAt=0;");
  assert.equal(run("game.cooldownBattle.skills.length"),5);
  assert.equal(run("advanceAutoBattle().actor"),"companion");
  assert.equal(run("game.feedback.at(-1).from"),"companion");
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.equal(run("partySides().join(',')"),"player");
  assert.equal(run("availableSkills('companion').includes('baton')"),false);
  assert.equal(run("game.loadout.join(',')"),"guard,heavy,strike");
  assert.equal(run("skillBlocked(baton)"),"동료 이탈");
  run("game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null); moveTo('lift'); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.some(skill=>skill.id==='baton')"),false);
});

test("recruiting a second companion preserves the first loadout and adds a third position",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('infirmary');");
  assert.equal(run("game.formation.join(',')"),"companion,,player");
  assert.equal(run("toggleEquippedSkill('prayer','companion')"),false);
  assert.equal(run("toggleEquippedSkill('escort','companion')"),true);
  assert.equal(run("toggleEquippedSkill('guard','companion')"),true);
  assert.equal(run("beginCombat()"),false);
  run("toggleEquippedSkill('prayer'); beginCombat();");
  run("game.enemy.hp=0; finishCombat();");
  assert.equal(run("recruitCompanion('awakened')"),true);
  run("declineCompanion(); chooseReward(null); moveTo('lift');");
  assert.equal(run("game.formation.join(',')"),"companion,companion2,player");
  assert.equal(run("game.companion.loadout.join(',')"),"baton,guard");
  assert.equal(run("game.companion2.loadout.join(',')"),"irons,hook");
  assert.equal(run("placePartyMember('player',1)"),true);
  assert.equal(run("game.formation.join(',')"),"companion,player,companion2");
  assert.equal(run("skillBlocked({id:'irons',side:'companion2'})"),"위치 제한");
  assert.equal(run("availableSkills('companion2').includes('aimedShot')"),false);
  run("game.companion2.weapon='bow'; toggleEquippedSkill('irons','companion2');");
  assert.equal(run("toggleEquippedSkill('aimedShot','companion2')"),true);
  assert.equal(run("skillBlocked({id:'aimedShot',side:'companion2'})"),"");
  run("placePartyMember('companion2',1);");
  assert.equal(run("skillBlocked({id:'aimedShot',side:'companion2'})"),"위치 제한");
  run("placePartyMember('companion2',2); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.length"),7);
  assert.equal(run("enemyAttackSide('strike')"),"companion");
  assert.equal(run("enemyAttackSide('aim')"),"companion2");
  assert.equal(run("placePartyMember('player',0)"),false);
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.equal(run("enemyAttackSide('strike')"),"player");
  assert.equal(run("partySides().join(',')"),"player,companion2");
});

test("a charged heal waits for a wound and takes effect on the injured target",()=>{
  const run=engine(1,{prep:true});
  run("game.skillLevels.dressing=1; toggleEquippedSkill('guard'); toggleEquippedSkill('dressing'); beginCombat(); game.cooldownBattle.skills[0].readyAt=0;");
  assert.equal(run("readyTimedSkill(game.cooldownBattle)"),undefined);
  run("game.player.body.legs.hp=3; game.player.hp=24;");
  assert.equal(run("advanceAutoBattle().id"),"dressing");
  assert.equal(run("game.player.body.legs.hp"),7);
  assert.equal(run("game.player.hp"),28);
});

test("a full party picks a permanent replacement before the reward",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('infirmary'); beginCombat();");
  run("game.enemy.hp=0; finishCombat();");
  assert.match(run("companionEncounterPanel()"),/전사 1→2/);
  run("recruitCompanion('awakened');");
  assert.match(run("companionEncounterPanel()"),/탈출 중인 간수 대신 영입.*수감자 1→2.*마법사 1→2.*전사 2→1/s);
  assert.match(run("companionEncounterPanel()"),/개화한 수감자 대신 영입.*두고 가기/s);
  assert.equal(run("canMoveTo('lift')"),false);
  assert.equal(run("recruitCompanion('shaman')"),false);
  assert.equal(run("recruitCompanion('shaman','player')"),false);
  assert.equal(run("recruitCompanion('shaman','companion3')"),false);
  assert.equal(run("game.pendingCompanion"),"shaman");
  assert.equal(run("recruitCompanion('shaman','companion')"),true);
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("game.companion.kind"),"shaman");
  assert.equal(run("livingRoster().map(side=>game[side].kind).join(',')"),"nun,shaman,awakened");
  assert.equal(run("game.deadCompanions.includes('guard')"),false);
  assert.equal(run("game.rewards.some(id=>cards[id].character==='guard')"),false);
  run("chooseReward(null); moveTo('lift');");
  assert.equal(run("reservePanel()"),"");
  assert.equal(run("placePartyMember('companion',1)"),true);
  assert.doesNotMatch(run("prepPanel()"),/탈출 중인 간수|전사 2\/2/);
  assert.match(run("prepPanel()"),/수감자 2\/2.*마법사 2\/2/s);
  run("beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.length"),7);
  assert.equal(run("game.cooldownBattle.skills.some(skill=>skill.id==='baton')"),false);
  assert.equal(run("game.cooldownBattle.traits.has('warrior')"),false);
});

test("passing on a full-party recruit keeps both companions and advances to the reward",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('infirmary'); beginCombat();");
  run("game.enemy.hp=0; finishCombat(); recruitCompanion('awakened');");
  assert.equal(run("declineCompanion()"),true);
  assert.equal(run("game.pendingCompanion"),null);
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("livingRoster().map(side=>game[side].kind).join(',')"),"nun,guard,awakened");
  assert.equal(run("game.rewards.some(id=>cards[id].character==='shaman')"),false);
});

test("archer recruits to the rear and guard and warrior grant their first eligible bonus",()=>{
  for(const archer of [true,false]){
    const run=engine();
    run(`game.enemy.hp=0; finishCombat(); recruitCompanion('guard'); chooseReward(null); moveTo('${archer?"duct":"infirmary"}'); beginCombat();
      game.enemy.hp=0; finishCombat();`);
    assert.match(run("companionEncounterPanel()"),archer?/간수 1→2/:/전사 1→2/);
    run(archer?"recruitCompanion('archer');":"recruitCompanion('awakened'); declineCompanion();");
    run("enterArea('threshold'); beginCombat();");
    if(archer){
      assert.equal(run("game.formation.join(',')"),"companion,player,companion2");
      assert.equal(run("game.companion2.loadout.join(',')"),"aimedShot,snapShot");
      run("applyCard('guard',game.player,game.enemy,['head'],game,game.companion);");
      assert.equal(run("game.feedback.at(-1).added"),5);
      run("applyCard('guard',game.player,game.enemy,['head'],game,game.companion);");
      assert.equal(run("game.feedback.at(-1).added"),3);
      run("clearDefense(game.companion); game.cooldownBattle.usedTraits.clear(); game.feedback=[]; while(game.phase==='combat' && !game.feedback.some(event=>event.from==='enemy')) advanceAutoBattle();");
      assert.equal(run("game.feedback.at(-1).from"),"enemy");
      assert.equal(run("game.feedback.at(-1).dealt"),0);
    }else{
      run("game.enemy.body.chest.hp=3; game.enemy.body.chest.guard=0; applyCard('strike',game.companion,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),3);
      run("game.enemy.body.chest.hp=3; applyCard('strike',game.companion,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),2);
      run("game.enemy.body.chest.hp=3; applyCard('strike',game.companion2,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),3);
    }
  }
});

test("the same prisoner and mage lineup can battle with or without trait bonuses",()=>{
  for(const enabled of [true,false]){
    const run=engine();
    run(`game.synergiesEnabled=${enabled}; game.enemy.hp=0; finishCombat(); declineCompanion();
      chooseReward(null); moveTo('infirmary'); beginCombat(); game.enemy.hp=0; finishCombat();
      recruitCompanion('awakened'); recruitCompanion('shaman'); chooseReward(null); enterArea('threshold'); beginCombat();`);
    assert.equal(run("game.cooldownBattle.traits.size"),enabled?2:0);
    run("game.enemy.body.chest.guard=2; applyCard('unseal',game.companion2,game.enemy,['chest']);");
    assert.equal(run("game.feedback.at(-1).dealt"),enabled?2:1);
    run("game.enemy.body.chest.guard=2; applyCard('unseal',game.companion2,game.enemy,['chest']);");
    assert.equal(run("game.feedback.at(-1).dealt"),1);
    run("game.player.body.legs.hp=2; applyCard('mending',game.companion2,game.enemy,['legs'],game,game.player);");
    assert.equal(run("game.feedback.at(-1).recovered"),enabled?3:2);
    run("applyCard('mending',game.companion2,game.enemy,['legs'],game,game.player);");
    assert.equal(run("game.feedback.at(-1).recovered"),2);
  }
});

test("the classic route can offer every newly recruited character's new card before the boss",()=>{
  const run=engine();
  const offers=JSON.parse(run(`
    const offers=new Set();
    for(const [area,kinds] of [["duct",["archer"]],["infirmary",["awakened","shaman"]]]){
      for(let seed=1;seed<=80;seed++){
        start(null,String(seed)); beginCombat(); game.enemy.hp=0; finishCombat();
        declineCompanion(); chooseReward(null); moveTo(area); beginCombat();
        game.enemy.hp=0; finishCombat();
        for(const kind of kinds) recruitCompanion(kind);
        for(const id of game.rewards) offers.add(id);
      }
    }
    JSON.stringify([...offers]);`));
  for(const id of ["chainRend","needleShot","runeWard"]) assert.ok(offers.includes(id),id);
});

test("new exclusive cards share guard, penetration and faction damage rules",()=>{
  const run=engine();
  run(`start({seed:"damage",widths:[1],training:true});
    game.formation=["companion","companion2","companion3"]; beginCombat();
    game.enemy.body.arms.guard=4;
    applyCard("needleShot",game.companion3,game.enemy,["arms"]);
    globalThis.arrow=game.feedback.at(-1);
    applyCard("shieldCounter",game.companion,game.enemy,["chest"]);
    globalThis.defend=game.feedback.at(-1);
    applyCard("strike",game.enemy,game.companion,["chest"]);
    globalThis.retaliation=game.feedback.at(-1);
    game.enemy.body.legs.guard=6;
    applyCard("chainRend",game.companion2,game.enemy,["legs"]);
    globalThis.shatter=game.feedback.at(-1);`);
  assert.equal(run("arrow.dealt"),2);
  assert.equal(run("arrow.blocked"),1);
  assert.equal(run("defend.added"),5);
  assert.equal(run("retaliation.card"),"shieldCounter");
  assert.equal(run("retaliation.dealt"),3);
  assert.equal(run("shatter.removed"),4);
  assert.equal(run("shatter.blocked"),2);
  assert.equal(run("shatter.dealt"),1);
});

test("no post-victory reward is offered at the exit fight",()=>{
  const run=engine();
  run("enterArea('lift'); beginCombat(); game.enemy.hp=0; finishCombat();");
  assert.equal(run("game.phase"),"route");
  assert.equal(run("game.rewards.length"),0);
  run("moveTo('exit');");
  assert.equal(run("game.phase"),"won");
});
