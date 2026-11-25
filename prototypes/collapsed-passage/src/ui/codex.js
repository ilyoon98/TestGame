"use strict";
// 도감.

const codexDialog=document.querySelector("#codex");

const codexMembers={nun:nunType,...companionTypes};

const codexLabels={nun:"수녀",guard:"간수",awakened:"개화 수감자",archer:"궁수",shaman:"주술사",common:"공용"};

const codexRoles={nun:"단일 치유 · 회복 연계",guard:"전위 방어 · 반격",awakened:"가드 제거 · 부상 추가 피해",
  archer:"중위 연타 · 후위 일격",shaman:"여러 아군 치유 · 강화와 약화"};

const codexWeapons={mace:"등불 · 방패",baton:"진압봉",chains:"사슬",bow:"활",staff:"지팡이"};

// 대원별 프로필과 카드 목록. 고른 대원(member)과 희귀도 필터(rarity)를 가진다.
class CodexView {
  member="nun";
  rarity="all";
  #dialog;

  constructor(dialog){ this.#dialog=dialog; }

  // 그 대원의 전용 카드, 또는 공용 카드. 충전 시간이 있는 카드만 싣는다.
  cardIds(kind){
    const member=codexMembers[kind];
    return Object.keys(cards).filter(id=>Number.isFinite(skillCharge[id]) &&
      (member?exclusiveSkill(cards[id]) && skillFits(cards[id],{kind,weapon:member.weapon}):!exclusiveSkill(cards[id])));
  }

  profile(kind){
    const profile=codexMembers[kind];
    if(!profile) return "";
    const portrait=partyArt[kind==="nun"?"player":kind];
    const durability=Object.values(parts).map((label,index)=>`${label} ${profile.health[index]}`).join(" · ");
    return `<div class="codex-profile">
    <div class="codex-portrait"><img src="${portrait.src}" alt="" width="1024" height="1536"></div>
    <div class="codex-profile-copy"><h3>${profile.name}</h3><p class="role">${codexRoles[kind]}</p>
      ${traitTags(profile,`codex-${kind}`)}
      <p class="codex-facts"><span>최대 체력 <b>${profile.vitality}</b></span>
      <span>${codexWeapons[profile.weapon]}</span>
      <span>기술 슬롯 <b>${kind==="nun"?starterSkills.length:companionSkillSlots}</b></span></p>
      <details class="codex-parts"><summary>부위 내구도</summary><p>${durability}</p></details>
    </div></div>`;
  }

  render(){
    const {member,rarity}=this;
    const choice=(value,label,group,active)=>`<button type="button" class="codex-choice" data-codex-${group}="${value}" aria-pressed="${active===value}">${label}</button>`;
    const tabs=Object.entries(codexLabels).map(([id,label])=>choice(id,label,"member",member)).join("");
    const rarities=choice("all","전체","rarity",rarity)+Object.entries(skillRarities).map(([id,{name}])=>choice(id,name,"rarity",rarity)).join("");
    const profile=codexMembers[member] || nunType;
    const actor=fighter(profile.name,profile.health,profile.vitality);
    const entries=this.cardIds(member).filter(id=>rarity==="all" || skillRarity(id)===rarity);
    const list=entries.map(id=>{
      const skill=cards[id], skillClass=skill.character || skill.weapon || "common";
      return `<article class="codex-card skill-class-card" data-card="${id}" data-skill-class="${skillClass}" data-tier="${skillRarity(id)}">
      <div class="prep-choice-top"><b>${combatSeconds(skillCooldown(id,1))}</b>${skill.reward?"":'<small class="basic-mark">기본</small>'}${skillRarityMark(id)}</div>
      ${skillCardArt(id)}<strong>${skill.name}</strong>
      <div class="prep-choice-meta">${skillOwnerMark(skillClass)}</div>
      ${skillRankMark(id)}${skillEffects(skillCardText(id,actor).lines)}
    </article>`;
    }).join("");
    document.querySelector("#codex-content").innerHTML=`
    <div class="codex-tabs" role="group" aria-label="대원과 공용 카드">${tabs}</div>
    ${this.profile(member)}
    <div class="codex-filter" role="group" aria-label="카드 희귀도">${rarities}</div>
    ${entries.length?`<div class="codex-card-grid" aria-label="카드 목록">${list}</div>`:'<p class="muted">해당 카드 없음</p>'}`;
  }

  open(){
    cancelAutoBattleTimer();
    this.render();
    this.#dialog.showModal();
    this.#dialog.scrollTop=0;
  }

  // 닫기 버튼, 대원 탭, 희귀도 필터.
  handleClick(button){
    const dialog=this.#dialog;
    if(button.hasAttribute("data-codex-close")){dialog.close();return;}
    const {codexMember:member,codexRarity:rarity}=button.dataset;
    if(!member && !rarity) return;
    if(member) this.member=member;
    else this.rarity=rarity;
    this.render();
    dialog.querySelector(member?`[data-codex-member="${member}"]`:`[data-codex-rarity="${rarity}"]`)?.focus({preventScroll:true});
  }
}

const codexView=new CodexView(codexDialog);
// 예전 전역 이름. 값은 codexView가 가진다.
Object.defineProperty(globalThis,"codexMember",{get:()=>codexView.member,set:value=>{codexView.member=value;},configurable:true});
Object.defineProperty(globalThis,"codexRarity",{get:()=>codexView.rarity,set:value=>{codexView.rarity=value;},configurable:true});

function codexCardIds(kind){ return codexView.cardIds(kind); }
function codexProfile(kind){ return codexView.profile(kind); }
function renderCodex(){ codexView.render(); }

document.addEventListener("click",event=>{
  if(event.target.closest("[data-codex-open]")) codexView.open();
});

codexDialog.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(button) codexView.handleClick(button);
});

codexDialog.addEventListener("close",scheduleAutoBattle);
