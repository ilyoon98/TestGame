"use strict";
// 오프닝 만화와 첫 플레이 안내.

const board=document.querySelector("#game-board");

const opening=document.querySelector("#opening");

const openingPanels=[
  ["01-descent-v2","수녀가 등불을 들고 지하 감옥 계단을 내려간다."],
  ["02-cell-v2","수녀가 철창 너머 사형수 앞에 선다."],
  ["03-prayer","수녀가 무릎을 꿇고 두 손을 모아 기도한다."],
  ["04-glance","수녀가 돌아서 나가자 사형수가 그 뒷모습을 바라본다."],
  ["05-quake-v2","통로가 크게 흔들리고 천장에서 돌이 떨어진다."],
  ["06-chaos","감옥 문이 벌어지고 사람들은 무너지는 통로에서 흩어진다."],
  ["07-flight-v2","수녀가 등불을 쥐고 무너지는 감옥을 달려 나간다."],
  ["08-pursuit-v2","멀리 어둠 속에서 사형수가 쇠사슬을 끌며 다가온다."]
];

const openingLessons=[
  ["대열","defense","대원 카드를 끌어 전위·중위·후위를 바꾸세요. 적의 일반 공격은 맨 앞을 노립니다."],
  ["자동 전투","routeBattle","대원 카드를 눌러 기술을 장착하세요. 충전이 끝나면 자동으로 발동합니다."],
  ["추격","pursuer","전투 3초마다 도망 여유가 1 줄어듭니다. 0이 되면 붙잡힙니다."]
];

const tutorialKey="collapsed-passage:tutorial-v1";

// 홈 → 만화 → (처음 한 번) 안내 → 첫 전투 준비. 안내를 마치거나 건너뛴 기록은 브라우저에 남긴다.
class OpeningView {
  #screen="home";
  #step=0;
  #tutorialSeen=false;
  #root;
  #board;

  constructor(root,gameBoard){
    this.#root=root;
    this.#board=gameBoard;
  }

  get screen(){ return this.#screen; }

  get #pages(){ return this.#screen==="comic"?openingPanels:openingLessons; }

  render(){
    const root=this.#root;
    root.dataset.screen=this.#screen;
    if(this.#screen==="home"){
      root.innerHTML=`<div class="opening-home"><h1>루치아<small>빈콜리의 등불</small></h1>
      <div class="opening-home-actions"><button type="button" class="opening-button primary" data-opening="next">시작하기</button>
      <button type="button" class="opening-button" data-codex-open aria-haspopup="dialog" aria-controls="codex">도감</button></div></div>`;
      return;
    }
    const comic=this.#screen==="comic";
    const step=this.#step, total=this.#pages.length;
    const isLast=step===total-1;
    const controls=`<div class="opening-nav">
    <button type="button" class="opening-button skip" data-opening="skip">건너뛰기</button>
    <span class="steps"><span aria-live="polite">${step+1} / ${total}</span>
      <button type="button" class="opening-button" data-opening="back" ${step?"":"disabled"}>이전</button>
      <button type="button" class="opening-button primary" data-opening="next">${isLast?(comic?"계속":"전투 준비"):"다음"}</button>
    </span></div>`;
    if(comic){
      const [file,alt]=openingPanels[step];
      root.innerHTML=`<section class="opening-strip" aria-label="오프닝 만화">
      <figure><img src="art/opening/${file}.webp" width="1440" height="960" alt="${alt}"></figure>${controls}</section>`;
      if(!isLast) new Image().src=`art/opening/${openingPanels[step+1][0]}.webp`;
    }else{
      const [title,mark,detail]=openingLessons[step];
      root.innerHTML=`<section class="opening-lesson" aria-label="튜토리얼">
      <span class="lesson-icon" aria-hidden="true">${icon(mark)}</span><h1>${title}</h1><p>${detail}</p>${controls}</section>`;
    }
  }

  openFirstBattle(){
    this.#root.hidden=true;
    this.#board.hidden=false;
    start(null);
    document.querySelector('[data-action="begin-combat"]')?.focus({preventScroll:true});
  }

  step(action){
    if(this.#screen==="home"){
      if(action!=="next") return;
      this.#screen="comic";
    }else if(action==="back"){
      if(!this.#step) return;
      this.#step--;
    }else if(action==="next" && this.#step+1<this.#pages.length){
      this.#step++;
    }else if(this.#screen==="comic"){
      try{this.#tutorialSeen ||= localStorage.getItem(tutorialKey)==="1";}catch{}
      if(this.#tutorialSeen){this.openFirstBattle();return;}
      this.#screen="tutorial";
      this.#step=0;
    }else{
      this.#tutorialSeen=true;
      try{localStorage.setItem(tutorialKey,"1");}catch{}
      this.openFirstBattle();
      return;
    }
    this.render();
    this.#root.querySelector('[data-opening="next"]')?.focus({preventScroll:true});
  }
}

const openingView=new OpeningView(opening,board);

function renderOpening(){ openingView.render(); }
function openFirstBattle(){ openingView.openFirstBattle(); }
function stepOpening(action){ openingView.step(action); }

opening.addEventListener("click",event=>{
  const button=event.target.closest("button[data-opening]");
  if(button && !button.disabled) stepOpening(button.dataset.opening);
});
