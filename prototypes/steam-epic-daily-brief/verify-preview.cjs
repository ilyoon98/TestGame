const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const template = fs.readFileSync(path.join(process.env.STEAM_BRIEF_SKILL_ROOT || path.join(__dirname, 'steam-epic-daily-brief'), 'assets/report-preview.html'), 'utf8');
const game = {
  title: 'Example <script>', url: 'https://store.steampowered.com/app/123/',
  thumbnailUrl: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/capsule.jpg',
  thumbnailAlternates: [
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/999/wrong.jpg',
    'https://example.com/apps/123/image.jpg',
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/header.jpg',
  ],
  description: '설명 유지', price: '10,000원', originalPrice: '20,000원', discount: '−50%',
};
const data = { asOf:'2026-11-18 13:38', genres:['덱빌딩'], includeMature:true,
  highlights:[], free:[], new:[game], deals:[], emptyMessages:{}, sources:[], limits:'' };
const { document, window } = parseHTML(template.replace('__REPORT_DATA__', JSON.stringify(data).replaceAll('<','\\u003c')));
const script = [...document.querySelectorAll('script')].find(el => el.type !== 'application/json').textContent;
vm.runInNewContext(script, { document, URL, Set });
const image = document.querySelector('.cover img');
const emit = type => image.dispatchEvent(new window.Event(type));
assert.equal(image.getAttribute('src'), game.thumbnailUrl);
emit('error');
assert.equal(image.getAttribute('src'), game.thumbnailAlternates[2], 'Skip other apps and unofficial hosts');
emit('error');
assert.equal(image.hidden, true);
assert.equal(document.querySelector('.cover-failed').hidden, false);
assert.equal(document.querySelector('.cover button').hidden, false);
for (const value of [game.title, game.description, game.price, '50%']) {
  assert.ok(document.querySelector('.game').textContent.includes(value), 'Metadata survives failed images');
}
assert.equal(document.querySelector('.copy script'), null, 'Titles render as text');
document.querySelector('.cover button').click();
assert.equal(image.hidden, false);
assert.equal(image.getAttribute('src'), game.thumbnailUrl);
Object.defineProperties(image, { complete:{value:true}, naturalWidth:{value:231} });
emit('load');
assert.equal(document.querySelector('#image-state').textContent, '썸네일 1/1개 표시');
console.log('PASS: official app images, fallback, retry, preserved metadata, safe text, loaded-image count');

const groupedData = {...data, groups:[
  {name:'RPG', free:[], new:[game], deals:[], emptyMessages:{free:'확인 범위에서 해당 없음'}},
  {name:'전략', free:[], new:[], deals:[{...game,url:game.url+'?l=koreana'}], emptyMessages:{new:'접근 실패로 확인 불가'}},
]};
const groupedDOM = parseHTML(template.replace('__REPORT_DATA__', JSON.stringify(groupedData).replaceAll('<','\\u003c')));
vm.runInNewContext(script,{document:groupedDOM.document,URL,Set});
assert.deepEqual([...groupedDOM.document.querySelectorAll('#sections > section > h2')].map(el=>el.textContent), ['RPG','전략']);
assert.equal(groupedDOM.document.querySelectorAll('.game').length,1,'Same app appears only once across genres and URL variants');
console.log('PASS: genre sections, app deduplication and legacy data support');

const genreTabs=[...groupedDOM.document.querySelectorAll('[role="tab"]')];
const genrePanels=[...groupedDOM.document.querySelectorAll('#sections > section')];
assert.equal(genreTabs.length,4);
assert.equal(genreTabs[0].getAttribute('aria-selected'),'true');
assert.equal(genrePanels[0].hidden,false);
assert.equal(genrePanels[1].hidden,true,'Empty genres do not repeat empty notices');
genreTabs[2].click();
assert.equal(genrePanels[0].hidden,true);
assert.equal(genrePanels[1].hidden,true);
assert.equal(groupedDOM.document.querySelector('#empty-state').hidden,false);
assert.equal(groupedDOM.document.querySelector('#view-title').textContent,'전략');
assert.equal(groupedDOM.document.querySelector('#view-count').textContent,'0개 게임');
assert.equal(genreTabs[2].getAttribute('aria-selected'),'true');
assert.equal(genreTabs[0].tabIndex,-1);
genreTabs[0].click();
assert.equal(genrePanels[0].hidden,false);
let focused=-1;
genreTabs.forEach((tab,index)=>{tab.focus=()=>{focused=index;};});
const key=new groupedDOM.window.Event('keydown');key.key='ArrowLeft';
genreTabs[0].dispatchEvent(key);
assert.equal(focused,3,'Arrow keys wrap and focus the last tab');
assert.equal(genreTabs.filter(tab=>tab.getAttribute('aria-selected')==='true').length,1);
console.log('PASS: genre tabs, counts, show/hide, all view, keyboard navigation and focus');

genreTabs[2].click();
groupedDOM.document.querySelector('[data-type="new"]').click();
assert.equal(groupedDOM.document.querySelector('#empty-state').textContent,'이 조건의 정보를 확인하지 못했습니다.');

const makeGame=(id,discount='')=>({...game,url:`https://store.steampowered.com/app/${id}/`,title:`Game ${id}`,discount});
const intersectionData={...data,highlights:['큰 할인: 삭제할 요약'],groups:[
  {name:'RPG',new:[makeGame(1,'−10%')],deals:[makeGame(2,'−50%')],free:[makeGame(3)],emptyMessages:{}},
  {name:'전략',new:[makeGame(4)],deals:[],free:[],emptyMessages:{free:'확인 범위에서 해당 없음'}},
]};
const intersectionDOM=parseHTML(template.replace('__REPORT_DATA__',JSON.stringify(intersectionData).replaceAll('<','\\u003c')));
vm.runInNewContext(script,{document:intersectionDOM.document,URL,Set});
const doc=intersectionDOM.document;
const tabs=[...doc.querySelectorAll('[role="tab"]')];
const choose=type=>doc.querySelector(`[data-type="${type}"]`).click();
const count=()=>doc.querySelector('#view-count').textContent;
assert.equal(count(),'4개 게임');
assert.equal(doc.querySelector('#highlights'),null,'Summary bullets are removed');
assert.equal(doc.querySelector('#free-notice'),null,'No persistent empty banner');
tabs[1].click(); choose('new'); assert.equal(count(),'1개 게임');
choose('deals'); assert.equal(count(),'2개 게임','Discounted new releases also match discount view');
choose('free'); assert.equal(count(),'1개 게임');
tabs[2].click(); assert.equal(count(),'0개 게임','Type selection stays active when genre changes');
assert.equal(doc.querySelector('#empty-state').textContent,'현재 확인된 무료 배포가 없습니다.');
choose('new'); assert.equal(count(),'1개 게임');
choose('deals'); assert.equal(count(),'0개 게임','Full-price releases do not match discount view');
tabs[0].click(); assert.equal(count(),'2개 게임');
choose('all'); assert.equal(count(),'4개 게임');
assert.equal([...doc.querySelectorAll('[data-type][aria-pressed="true"]')].length,1);
console.log('PASS: genre/type intersection, launch sales, full-price exclusions, free distribution, empty states, no summary');

const adultData={...data,groups:[
  {name:'RPG',new:[{...makeGame(10,'−10%'),mature:false,steamTags:[{id:'12095',name:'선정적 콘텐츠'}]}],deals:[{...makeGame(11,'−50%'),mature:true,matureContent:true,steamTags:['폭력','감성적']}],free:[],emptyMessages:{}},
  {name:'공포',new:[{...makeGame(12),matureContent:false,steamTags:[{id:'6650',name:'신체 노출'}]}],deals:[],free:[{...makeGame(13),steamTags:['Nudity']}],emptyMessages:{}},
]};
function mountAdult(input) {
  const dom=parseHTML(template.replace('__REPORT_DATA__',JSON.stringify(input).replaceAll('<','\\u003c')));
  vm.runInNewContext(script,{document:dom.document,URL,Set}); return dom.document;
}
const adultDoc=mountAdult(adultData);
const adultTab=adultDoc.querySelector('[role="tab"][aria-label="성인 요소"]');
assert.ok(adultTab);
assert.equal(adultDoc.querySelector('#view-count').textContent,'4개 게임','Aggregate adult view adds no duplicate rows');
adultTab.click();
assert.equal(adultDoc.querySelector('#view-title').textContent,'성인 요소');
assert.equal(adultDoc.querySelector('#view-count').textContent,'3개 게임');
for(const [type,expected] of [['new',2],['deals',1],['free',1]]) {
 adultDoc.querySelector(`[data-type="${type}"]`).click();
 assert.equal(adultDoc.querySelector('#view-count').textContent,`${expected}개 게임`);
}
assert.equal(mountAdult({...adultData,includeMature:false}).querySelector('[aria-label="성인 요소"]'),null);
console.log('PASS: exact Steam sexual/nudity tags, no violence/emotional false positives, type filters and no duplicates');

const typedData={...data,new:[
 {...makeGame(20),releaseDate:'2026-11-22',releaseState:'released',isNewRelease:true,discountPercent:20,originalPriceValue:10000,priceValue:8000},
 {...makeGame(21),releaseDate:'2026-11-20',releaseState:'early_access',isNewRelease:true,discountPercent:0},
 {...makeGame(22),releaseDate:'2026-11-25',releaseState:'upcoming',discountPercent:0},
 {...makeGame(23),releaseDate:'2020-01-01',releaseState:'released',isNewRelease:false,discountPercent:50,originalPriceValue:10000,priceValue:10000},
],deals:[]};
const typedDoc=mountAdult(typedData);
const typedRows=[...typedDoc.querySelectorAll('.game')];
assert.equal(typedRows[0].querySelector('.badge-new').textContent,'신작');
assert.equal(typedRows[0].querySelector('.badge-new').title,'출시일 2026.11.22');
assert.equal(typedRows[0].querySelector('.badge-sale').textContent,'−20%');
assert.ok(typedRows[1].querySelector('.badge-ea').textContent.includes('신작 · 앞서 해보기'));
assert.equal(typedRows[2].querySelector('.badge-upcoming').textContent,'출시 예정');
assert.equal(typedRows[2].querySelector('.badge-sale'),null);
assert.equal(typedRows[3].querySelector('.badge-release'),null,'Old release dates are hidden');
assert.equal(typedRows[3].textContent.includes('2020.01.01'),false);
assert.equal(typedRows[3].querySelector('.badge-new'),null);
assert.equal(typedRows[3].querySelector('.badge-sale'),null,'Equal prices cannot be advertised as discounted');
typedDoc.querySelector('[data-type="deals"]').click();
assert.equal(typedDoc.querySelector('#view-count').textContent,'1개 게임');
assert.equal(adultDoc.querySelector('.steam-tags .badge-sexual').getAttribute('href'),'https://store.steampowered.com/app/10/');
console.log('PASS: visible separate release/sale badges, upcoming/EA states, exact dates, contradictory price exclusion and tag provenance');

const metadataGame={...makeGame(30),koreanSupported:true,koreanDetails:'인터페이스 · 자막',reviewCount:6906,reviewSummary:'압도적으로 긍정적',reviewScore:9,reviewPositivePercent:96,reviewScope:'최근 30일',note:'Steam 사용자 태그와 한국 지역 본편 가격을 확인했습니다.',steamTags:Array.from({length:7},(_,i)=>({id:String(i),name:'태그'+i}))};
const metadataDoc=mountAdult({...data,new:[metadataGame],deals:[]});
const metadataRow=metadataDoc.querySelector('.game');
assert.ok(metadataRow.querySelector('.metadata').textContent.includes('한국어 O'));
assert.ok(metadataRow.querySelector('.metadata').textContent.includes('최근 리뷰 5,000↑'));
assert.equal(metadataRow.querySelector('.badge-positive').textContent,'압도적으로 긍정적');
assert.ok([...metadataRow.querySelectorAll('.metadata .badge')].some(x=>x.title.includes('6,906개')&&x.title.includes('96%')));
assert.equal(metadataRow.querySelector('.game-details'),null);
assert.equal(metadataRow.textContent.includes('확인했습니다.'),false);
assert.equal([...metadataRow.querySelectorAll('.steam-tag')].filter(x=>!x.hidden).length,3);
metadataRow.querySelector('.tag-toggle').click();
assert.equal([...metadataRow.querySelectorAll('.steam-tag')].filter(x=>!x.hidden).length,7);
assert.equal(metadataRow.querySelector('.tag-toggle').getAttribute('aria-expanded'),'true');
metadataRow.querySelector('.tag-toggle').click();
assert.equal([...metadataRow.querySelectorAll('.steam-tag')].filter(x=>!x.hidden).length,3);
const noReviewsDoc=mountAdult({...data,new:[{...makeGame(31),koreanSupported:false,reviewCount:0,reviewSummary:'평가 없음',reviewScore:0}],deals:[]});
assert.ok(noReviewsDoc.querySelector('.metadata').textContent.includes('한국어 X'));
assert.ok(noReviewsDoc.querySelector('.metadata').textContent.includes('리뷰 0'));
assert.ok(noReviewsDoc.querySelector('.metadata').textContent.includes('평가 없음'));
const quotaData={...data,selectionLimits:{new:3,deals:3},groups:[{name:'인디',new:[40,41,42].map(id=>({...makeGame(id,'−20%'),isNewRelease:true})),deals:[43,44,45].map(id=>makeGame(id,'−50%')),free:[],emptyMessages:{}}]};
const quotaDoc=mountAdult(quotaData);
assert.equal(quotaDoc.querySelector('#view-count').textContent,'6개 게임');
quotaDoc.querySelector('[data-type="new"]').click();
assert.equal(quotaDoc.querySelector('#view-count').textContent,'3개 게임');
quotaDoc.querySelector('[data-type="deals"]').click();
assert.equal(quotaDoc.querySelector('#view-count').textContent,'3개 게임');
assert.deepEqual([...quotaDoc.querySelectorAll('.game')].filter(x=>!x.hidden).map(x=>x.querySelector('.game-title a').getAttribute('href')), [43,44,45].map(id=>`https://store.steampowered.com/app/${id}/`));
console.log('PASS: hover release dates, metadata badges, review buckets, zero vs unknown reviews, visible expandable tags, no boilerplate, separate 3+3 quotas');

assert.ok(metadataRow.querySelector('.language-supported'),'Korean support has a distinct highlighted badge');
assert.equal(noReviewsDoc.querySelector('.language-supported'),null,'Unsupported Korean must not be highlighted');
assert.equal(metadataRow.querySelectorAll('.tag-primary').length,2,'Only two main genre tags are emphasized');
assert.equal(metadataRow.querySelector('.game-title a').title,metadataGame.title,'Full official title remains in tooltip');
const splitDoc=mountAdult({...quotaData,groups:[{...quotaData.groups[0],name:'덱빌딩·자동 전투'}]});
const splitPanel=splitDoc.querySelector('.category-columns');
assert.equal(splitPanel.dataset.mode,'split');
assert.equal(splitPanel.querySelector('[data-category="new"] .category-count').textContent,'3개');
assert.equal(splitPanel.querySelector('[data-category="deals"] .category-count').textContent,'3개');
assert.ok(splitDoc.querySelector('[aria-label="덱빌딩·자동 전투"] .icon'));
assert.equal(splitDoc.querySelector('[aria-label="덱빌딩·자동 전투"] .tab-label').textContent,'덱빌딩');
splitDoc.querySelector('[data-type="deals"]').click();
assert.equal(splitPanel.dataset.mode,'single');
assert.equal(splitPanel.querySelector('[data-category="new"]').hidden,true);
splitDoc.querySelector('[data-type="all"]').click();
assert.equal(splitPanel.dataset.mode,'split');
assert.equal(splitPanel.querySelectorAll('[data-category="new"] .game').length,3,'Rows return to their original section');
const launchDoc=mountAdult({...data,groups:[{name:'증분',new:[makeGame(51,'−20%')],deals:[],free:[],emptyMessages:{}}]});
assert.equal(launchDoc.querySelector('[aria-label="증분"] .tab-label').textContent,'증분');
launchDoc.querySelector('[data-type="deals"]').click();
assert.equal(launchDoc.querySelector('[data-category="deals"] .game').hidden,false,'Launch discount moves into the discount section');
launchDoc.querySelector('[data-type="all"]').click();
assert.equal(launchDoc.querySelector('[data-category="new"] .game').hidden,false,'Restore launch sale to new section in all view');
console.log('PASS: split new/sale sections, filter relocation/restoration, highlighted Korean and key genres, compact icon tabs, incremental genre and complete title tooltip');

const modifierTab=splitDoc.querySelector('[aria-label="덱빌딩·자동 전투"]');modifierTab.click();
const ctrlHome=new window.Event('keydown');ctrlHome.key='Home';ctrlHome.ctrlKey=true;modifierTab.dispatchEvent(ctrlHome);
assert.equal(modifierTab.getAttribute('aria-selected'),'true','Ctrl+Home must keep the selected genre');

const priorityDoc=mountAdult({...data,groups:[{name:'증분',new:[{...makeGame(61),steamTags:[{id:'560542',name:'인크리멘탈'},{id:'5363',name:'파괴'},{id:'5981',name:'마이닝'}]}],deals:[],free:[]}]});
assert.deepEqual([...priorityDoc.querySelectorAll('.tag-primary')].map(x=>x.textContent),['인크리멘탈','파괴'],'Deduplicate primary preferences before selecting two tags');

assert.equal(typedRows[0].querySelector('.badge-sale').parentElement,typedRows[0].querySelector('.price'),'Discount and price are in the same group');
assert.equal(typedRows[0].querySelectorAll('.badge-sale').length,1,'No repeated sale badge');
const copyOrder=[...typedRows[0].querySelector('.copy').children];
assert.ok(copyOrder.indexOf(typedRows[0].querySelector('.price'))<copyOrder.indexOf(typedRows[0].querySelector('.description')),'Price comes before description and secondary metadata');
assert.equal(groupedDOM.document.querySelector('#genre-tabs').parentElement.id,'sidebar');
assert.equal(groupedDOM.document.querySelector('#genre-tabs').getAttribute('aria-orientation'),'vertical');
const facetData={...data,groups:[
 {name:'RPG',new:[{...makeGame(70),steamTags:[{id:'9',name:'전략'},{id:'122',name:'RPG'}]}],deals:[{...makeGame(71,'−40%'),isIndie:true,steamTags:[{id:'9',name:'전략'}]}],free:[]},
 {name:'전략',new:[{...makeGame(72),isIndie:true,steamTags:[{id:'560542',name:'인크리멘탈'}]}],deals:[],free:[]}
]};
const facetDoc=mountAdult(facetData);
function toggleFacet(key,checked){const input=facetDoc.querySelector(`input[data-tag="${key}"]`);input.checked=checked;input.dispatchEvent(new window.Event('change'));}
assert.equal(facetDoc.querySelector('#view-count').textContent,'3개 게임');
toggleFacet('id:9',true);assert.equal(facetDoc.querySelector('#view-count').textContent,'2개 게임');
toggleFacet('id:492',true);assert.equal(facetDoc.querySelector('#view-count').textContent,'1개 게임','Selected tags use AND');
facetDoc.querySelector('[role="tab"][aria-label="전략"]').click();assert.equal(facetDoc.querySelector('#view-count').textContent,'0개 게임');
assert.equal(facetDoc.querySelector('#empty-state').textContent,'선택한 태그를 모두 포함한 게임이 없습니다.');
assert.equal(facetDoc.querySelectorAll('.active-tag').length,2);
facetDoc.querySelector('#tag-clear').click();assert.equal(facetDoc.querySelector('#view-count').textContent,'1개 게임');
assert.equal(facetDoc.querySelectorAll('.active-tag').length,0);
facetDoc.querySelector('[role="tab"][aria-label="RPG"]').click();
facetDoc.querySelector('[data-type="new"]').click();toggleFacet('id:492',true);
assert.equal(facetDoc.querySelector('#view-count').textContent,'0개 게임','Tag, genre and type intersect');
facetDoc.querySelector('[aria-label="인디 태그 해제"]').click();assert.equal(facetDoc.querySelector('#view-count').textContent,'1개 게임');
facetDoc.querySelector('[data-type="all"]').click();
assert.equal(facetDoc.querySelector('input[type=search]'),null,'Tag search is removed');
facetDoc.querySelector('#filters-toggle').click();assert.equal(facetDoc.querySelector('#app').dataset.filterPanel,'open');
facetDoc.querySelector('#filters-toggle').click();assert.equal(facetDoc.querySelector('#filters-toggle').getAttribute('aria-expanded'),'false');
const wideDoc=mountAdult({...data,new:[{...game,thumbnailWideUrl:game.thumbnailAlternates[2]}],deals:[]});
assert.equal(wideDoc.querySelector('.cover img').getAttribute('src'),game.thumbnailAlternates[2],'Use a verified larger image when provided');
console.log('PASS: price-first order and single sale marker, larger verified image, vertical sidebar, AND tag facets, genre/type intersection, no search field, clear and responsive filter toggle');

async function verifyTrailerLifecycle(){
 const input={...data,new:[80,81].map(id=>({...makeGame(id),videoSources:[{url:`https://video.akamai.steamstatic.com/store_trailers/${id}/100/preview.m3u8`,type:'application/vnd.apple.mpegurl'}]})),deals:[]};
 function setup(reduce=false){
  const dom=parseHTML(template.replace('__REPORT_DATA__',JSON.stringify(input)));const instances=[];const timers=new Map();let timerId=0;
  const original=dom.document.createElement.bind(dom.document);
  dom.document.createElement=(name,...args)=>{const node=original(name,...args);if(name==='video'){
    node.paused=true;node.canPlayType=()=>'';node.load=()=>{};node.pause=()=>{node.paused=true;};node.play=async()=>{node.paused=false;node.dispatchEvent(new dom.window.Event('playing'));};
  }return node;};
  class FakeHls{
   static Events={MANIFEST_PARSED:'parsed',ERROR:'error'};static isSupported(){return true;}
   constructor(){this.handlers={};instances.push(this);}on(name,fn){this.handlers[name]=fn;}loadSource(url){this.source=url;}attachMedia(video){this.video=video;}destroy(){this.destroyed=true;}
  }
  vm.runInNewContext(script,{document:dom.document,URL,Set,Hls:FakeHls,matchMedia:()=>({matches:reduce}),setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)});
  return {dom,instances,timers};
 }
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 const env=setup();const covers=[...env.dom.document.querySelectorAll('.cover')];const videos=covers.map(c=>c.querySelector('video'));
 assert.ok(videos.every(v=>v.hidden&&!v.getAttribute('src')),'Videos do not fetch before interaction');
 const enter=new env.dom.window.Event('pointerenter');enter.pointerType='mouse';covers[0].dispatchEvent(enter);
 assert.equal(env.instances.length,0,'Delay hover to avoid loading videos while browsing past');
 covers[0].querySelector('.trailer-toggle').click();await tick();
 assert.equal(env.instances.length,1,'Manual click during hover delay starts playback rather than cancelling');
 env.instances[0].handlers.parsed();await tick();
 assert.equal(videos[0].hidden,false);assert.equal(videos[0].muted,true);assert.equal(covers[0].dataset.preview,'playing');
 covers[1].querySelector('.trailer-toggle').click();await tick();
 assert.equal(env.instances[0].destroyed,true,'Only one preview may play');assert.equal(videos[0].hidden,true);
 env.instances[1].handlers.parsed();await tick();assert.equal(videos[1].hidden,false);
 env.instances[1].handlers.error(null,{fatal:true});assert.equal(videos[1].hidden,true);assert.equal(covers[1].dataset.preview,'unavailable');
 covers[1].querySelector('.trailer-toggle').click();await tick();env.instances[2].handlers.parsed();await tick();
 env.dom.document.querySelector('[data-type="new"]').click();assert.equal(videos[1].hidden,true,'Changing filters stops hidden or stale video');
 const reduced=setup(true);const reducedCover=reduced.dom.document.querySelector('.cover');const reducedEnter=new reduced.dom.window.Event('pointerenter');reducedEnter.pointerType='mouse';reducedCover.dispatchEvent(reducedEnter);
 assert.equal(reduced.timers.size,0,'Reduced motion disables automatic hover');reducedCover.querySelector('.trailer-toggle').click();await tick();assert.equal(reduced.instances.length,1,'Explicit replay remains available with reduced motion');
 const invalid=mountAdult({...data,new:[{...makeGame(82),videoSources:[{url:'https://evil.example/store_trailers/82/a.m3u8',type:'application/vnd.apple.mpegurl'},{url:'https://video.akamai.steamstatic.com/store_trailers/999/a.m3u8',type:'application/vnd.apple.mpegurl'}]}],deals:[]});
 assert.equal(invalid.querySelector('video'),null,'Reject unofficial hosts and videos belonging to a different app');
 console.log('PASS: lazy hover delay, hover/click race, muted playback, single active player, failure poster, filter cancellation, reduced motion and official same-app videos');
}
verifyTrailerLifecycle().catch(error=>{console.error(error);process.exitCode=1;});

const addedNames=['자동화·공장','타워 디펜스','도시 건설','덱빌딩','오토배틀러'];
const expandedGenresDoc=mountAdult({...data,groups:addedNames.map((name,i)=>({name,new:[{...makeGame(900+i),steamTags:[{id:'32322',name:'덱빌딩'},{id:'1084988',name:'오토 배틀러'}]}],deals:[],free:[]}))});
for(const name of addedNames){
 const tab=expandedGenresDoc.querySelector(`[role="tab"][aria-label="${name}"]`);assert.ok(tab);assert.ok(tab.querySelector('.icon'));tab.click();assert.equal(expandedGenresDoc.querySelector('#view-count').textContent,'1개 게임');
}
assert.equal(expandedGenresDoc.querySelector('[role="tab"][aria-label="덱빌딩·자동 전투"]'),null);
const oldCombinedFixture=mountAdult({...data,groups:[{name:'덱빌딩·자동 전투',new:[makeGame(999)],deals:[],free:[]}]});
assert.ok(oldCombinedFixture.querySelector('[aria-label="덱빌딩·자동 전투"]'),'Frozen historical reports remain readable');
console.log('PASS: added genre navigation, independent deck/autobattler filters and legacy report readability');
