const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const template = fs.readFileSync(path.join(__dirname, 'steam-epic-daily-brief/assets/report-preview.html'), 'utf8');
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
for (const value of [game.title, game.description, game.price, game.discount]) {
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
  {name:'RPG',new:[{...makeGame(10,'−10%'),mature:true}],deals:[makeGame(11,'−50%')],free:[],emptyMessages:{}},
  {name:'공포',new:[{...makeGame(12),matureContent:true}],deals:[],free:[{...makeGame(13),mature:true}],emptyMessages:{}},
]};
function mountAdult(input) {
  const dom=parseHTML(template.replace('__REPORT_DATA__',JSON.stringify(input).replaceAll('<','\\u003c')));
  vm.runInNewContext(script,{document:dom.document,URL,Set}); return dom.document;
}
const adultDoc=mountAdult(adultData);
const adultTab=adultDoc.querySelector('[role="tab"][aria-label="성인 게임"]');
assert.ok(adultTab);
assert.equal(adultDoc.querySelector('#view-count').textContent,'4개 게임','Aggregate adult view adds no duplicate rows');
adultTab.click();
assert.equal(adultDoc.querySelector('#view-title').textContent,'성인 게임');
assert.equal(adultDoc.querySelector('#view-count').textContent,'3개 게임');
for(const [type,expected] of [['new',2],['deals',1],['free',1]]) {
 adultDoc.querySelector(`[data-type="${type}"]`).click();
 assert.equal(adultDoc.querySelector('#view-count').textContent,`${expected}개 게임`);
}
assert.equal(mountAdult({...adultData,includeMature:false}).querySelector('[aria-label="성인 게임"]'),null);
console.log('PASS: adult ratings/content flags, genre aggregation, type intersection, no duplicates, maturity preference');
