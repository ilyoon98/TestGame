"use strict";

const crewBySheetId = new Map(crewCatalog.map((unit) => [unit.sheetId, unit]));
const displayedCrew = [];

for (const card of document.querySelectorAll(".character[data-crew-id]")) {
  const unit = crewBySheetId.get(Number(card.dataset.crewId));
  if (!unit) continue;
  displayedCrew.push(unit);

  const nameRow = card.querySelector(".name-row");
  nameRow.querySelector("h3").textContent = unit.name;
  nameRow.querySelector(".cost").textContent = `${unit.cost} 코스트`;
  const figure = card.querySelector(".figure");
  const portrait = crewPortrait(unit);
  if (portrait) {
    const source = new URL(portrait[0], new URL("../", location.href)).href;
    figure.href = source;
    figure.querySelector("img").src = source;
  }
  figure.setAttribute("aria-label", `${unit.name} 원본 이미지 열기`);
  const skillList = card.querySelector("ol");
  skillList.setAttribute("aria-label", `${unit.name} 스킬`);
  skillList.replaceChildren(...unit.skills.map(({ name }) => {
    const item = document.createElement("li");
    item.textContent = name;
    return item;
  }));

  const profile = document.createElement("p");
  profile.className = "profile";
  const species = unit.animal ? `${unit.animal} 수인` : "인간";
  profile.textContent = `${species} · ${unit.gender} · ${unit.age}세`;
  nameRow.after(profile);
}

const beastCount = displayedCrew.filter(({ animal }) => animal).length;
const menCount = displayedCrew.filter(({ gender }) => gender === "남성").length;
const teenCount = displayedCrew.filter(({ age }) => age >= 13 && age < 20).length;
const total = displayedCrew.length;
const counts = document.getElementById("roster-counts");
counts.textContent = `수인 ${beastCount}명 · 인간 ${total - beastCount}명 / 남성 ${menCount}명 · 여성 ${total - menCount}명 / 10대 ${teenCount}명 · 20~30대 ${total - teenCount}명`;
counts.hidden = total === 0;
