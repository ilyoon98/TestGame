import { Dungeon, JOBS } from './engine.js';
import { LIFE_EVENTS } from './life-events.js';
import { createLayout, legacyLayout, validLayout } from './dungeon-layout.js';
import { planDungeonEvents, openDungeonEvent, chooseDungeonEvent, commitDungeonEffect, storyState, validStoryState, validStoryTrail, dungeonEventAutoChoice } from './dungeon-events.js';
import { bondState, migrateBonds, validBonds, validBondEffect, rememberDungeonContact, rememberRescuedGoblin, drawTownConnection, openTownConnection, chooseTownConnection, commitTownConnection } from './town-connections.js';
import { applyDungeonRelationship, openRelationshipEvent, chooseRelationshipEvent, validRelationshipChoice, personAvailable } from './relationships.js';
import { openCompanionEvent, chooseCompanionEvent, rescueByCompanion, commitCompanionEffect, advanceCompanion, partCompanion, openCompanionMemory, chooseCompanionMemory, companionReminiscence, validCompanionState, validCompanionEffect, validCompanionChoice } from './companions.js';
export const AGING={human:{from:60},elf:{from:68},dwarf:{from:65},goblin:{from:54},undead:{from:68}};
export const AGING_STEP=10;
export const AGING_RISKS=Object.freeze([.02,.08,.20,.45,.80,.95]);
export function agingRisk(race,age){
  const years=age-AGING[race].from;
  return years<0?0:AGING_RISKS[Math.min(AGING_RISKS.length-1,Math.floor(years/AGING_STEP))];
}

export const DUNGEONS=[
  {id:'mine',name:'이끼 광산',hint:'3층 · 짧은 탐험 · 광석과 도구',boss:'광산의 거수',reward:65,loot:'거수의 광석',floors:['버려진 갱도','수정 광맥','거수의 둥지'],monsters:['갱도 슬라임','광석 벌레','삽 든 코볼트'],scenes:['천장에 박힌 수정이 희미하게 빛납니다.','버려진 수레에 새로운 발자국이 남았습니다.','망치 소리가 깊은 갱도를 울립니다.']},
  {id:'crypt',name:'속삭이는 묘지',hint:'5층 · 보통 위험 · 망자의 보물',boss:'검은 왕',reward:100,loot:'검은 왕의 왕관',floors:['이끼 낀 회랑','잊힌 저장고','속삭이는 지하묘지','봉인의 성소','검은 왕의 옥좌'],monsters:['해골 궁수','묘지의 파수꾼','울부짖는 망령'],scenes:['비석 뒤에서 자신의 이름을 부르는 소리가 들립니다.','부서진 제단에 촛불 하나가 남아 있습니다.','은빛 가루가 발걸음을 따라 흩어집니다.']},
  {id:'ruins',name:'별잠긴 유적',hint:'7층 · 높은 위험 · 고대 유물',boss:'별의 파수꾼',reward:160,loot:'별의 심장',floors:['무너진 정원','청동 회랑','잠든 도서관','수로의 관문','거울의 전당','별빛 계단','파수꾼의 제단'],monsters:['청동 인형','거울의 짐승','별빛 사냥꾼'],scenes:['부서진 거울에 낯선 하늘이 비칩니다.','고대 문자가 손끝의 온기에 반응합니다.','천장 없는 전당으로 별빛이 흘러내립니다.']}
];
export const CAREERS=[
  {id:'inn',name:'여관주인',place:'여관',hint:'모험가의 숙소 · 손님과 인연',verb:'여관을 운영'},
  {id:'guild',name:'길드 직원',place:'길드',hint:'의뢰와 구조 · 탐험 경험 활용',verb:'길드 의뢰를 처리'},
  {id:'trader',name:'상인',place:'상점',hint:'전리품·물약 거래 · 자산과 행운',verb:'전리품 상점을 운영'},
  {id:'smith',name:'장인',place:'공방',hint:'장비 제작·수리 · 소재와 기술',verb:'장비 공방에서 작업'}
];
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
const CHILD_JOB=Object.freeze({id:'child',name:'아직 직업 없음',hp:0,power:0,scout:0,luck:0});
const FAMILY_NAMES=['로안','이셀','마렌','루카','헤나','다렌','리에','오웬','아린','벨라','도린','유나'];
const FAMILY_JOBS=['던전 짐꾼','여관 일꾼','광산 노동자','약초상','길드 서기','장비 수선공','빵집 주인','퇴역 모험가'];
const BIRTHPLACES=['미궁마을','광산 아래 마을','숲 가장자리 마을','성벽 밖 마을'];
const CHILD_EVENTS={
  young:['부모의 손을 잡고 처음으로 마을 길을 걸었습니다.','집 앞에서 나무 조각을 쌓으며 놀았습니다.','밤마다 부모에게 던전 이야기를 들었습니다.','비 오는 날 창가에 앉아 물방울을 세었습니다.'],
  school:['작은 학교에서 자신의 이름을 쓰는 법을 배웠습니다.','동네 아이들과 던전 입구까지 갔다가 돌아왔습니다.','길드 게시판 앞에서 모험가들의 이름을 읽었습니다.','부모가 일하는 곳에 도시락을 가져다줬습니다.'],
  youth:['귀환한 모험가에게 길을 묻고 지도를 들여다봤습니다.','부모의 일을 도우며 하루를 보냈습니다.','마을 축제에서 또래들과 밤늦게 이야기를 나눴습니다.','낡은 장비를 손질하며 자신의 앞날을 생각했습니다.']
};
const option=(id,label,hint,bias='safe',extra={})=>({id,label,hint,bias,...extra});
const defaultWorld=()=>({version:1,mode:'hub',dungeonId:'crypt',career:null,day:0,totalDays:0,seasons:0,reputation:0,fatigue:0,bestFloor:0,trips:0,cleared:[],careerHistory:[],flags:{},due:[],eventOrder:[],eventCounts:{},routineOrder:[],adultArc:null,lastAgeCheck:null,exitSnapshot:null});
const routine={
  inn:['새벽에 돌아온 파티에게 따뜻한 수프를 내줬습니다.','젖은 망토를 말리고 빈 객실을 정리했습니다.','손님들의 던전 이야기를 모아 지도에 표시했습니다.','짐꾼들이 단체 숙박을 예약했습니다.','모험가가 남긴 장비를 주인에게 돌려줬습니다.','신입 모험가에게 안전한 숙소를 소개했습니다.','광산에서 돌아온 손님이 식사를 추가 주문했습니다.','길드 게시판에 여관의 빈방 소식을 올렸습니다.'],
  guild:['신입 파티의 탐험 신고서를 정리했습니다.','돌아온 모험가의 지도를 길드 기록에 옮겼습니다.','미귀환 파티의 마지막 위치를 확인했습니다.','광산 소재 운반 의뢰를 배정했습니다.','부상자를 위한 구조 물자를 준비했습니다.','위험 구역 안내문을 새로 붙였습니다.','파티 사이의 보상 분쟁을 중재했습니다.','고대 유적의 발견 기록을 검토했습니다.'],
  trader:['모험가가 가져온 전리품의 가격을 매겼습니다.','물약과 횃불 묶음을 판매했습니다.','광산에서 나온 작은 보석을 거래했습니다.','귀환한 파티의 중고 장비를 손질해 팔았습니다.','유적 탐험에 필요한 도구를 주문받았습니다.','던전 지도를 찾는 손님에게 안내했습니다.','길드에 구조 물품을 납품했습니다.','먼지 쌓인 유물에서 판매할 만한 물건을 골랐습니다.'],
  smith:['모험가의 부러진 검을 수리했습니다.','광산의 철광석으로 단검을 만들었습니다.','길드가 맡긴 갑옷의 이음새를 보강했습니다.','가죽과 금속을 엮어 새 배낭을 완성했습니다.','탐험용 곡괭이의 날을 다시 세웠습니다.','고대 유물의 문양을 장비에 옮겼습니다.','부상한 모험가의 방패를 가볍게 고쳤습니다.','신입 파티의 장비를 밤늦게까지 손질했습니다.']
};
// Costs are checked before selection, and deferred consequences survive job changes.
const EVENTS={
  inn_credit:{career:'inn',title:'외상을 부탁하는 파티',prompt:'광산으로 떠나는 파티가 식사값을 나중에 갚겠다고 합니다.',options:[
    option('credit','외상을 허용한다','금화 -8 · 나중에 보답 가능','kind',{cost:8,delta:{gold:-8,reputation:2},text:'배고픈 파티에게 외상으로 식사를 내줬습니다.',due:{delay:2,text:'외상값을 갚으러 온 파티가 선물을 얹었습니다. 금화 +22, 평판 +3.',delta:{gold:22,reputation:3}}}),
    option('cash','선불을 받는다','금화 +7 · 안정적인 수입','greed',{delta:{gold:7},text:'파티가 장비를 맡기고 식사값을 먼저 냈습니다. 금화 +7.'}),
    option('decline','다른 숙소를 소개한다','손실 없이 지나가기','safe',{delta:{reputation:1},text:'형편에 맞는 숙소를 소개했습니다. 평판 +1.'})]},
  inn_patient:{career:'inn',title:'부상자의 밤',prompt:'던전에서 다친 모험가가 여관 문을 두드립니다.',options:[
    option('care','물약과 침상을 내준다','물약 -1 · 평판 +6','kind',{potionCost:1,delta:{potions:-1,reputation:6,fatigue:7},text:'부상자를 돌봤습니다. 물약 -1, 평판 +6.'}),
    option('doctor','치료사를 부른다','금화 -12 · 평판 +5','smart',{cost:12,delta:{gold:-12,reputation:5},text:'치료사가 상처를 돌봤습니다. 금화 -12, 평판 +5.'}),
    option('guild','길드 구조소로 안내한다','평판 +2 · 안전한 지원','safe',{delta:{reputation:2},text:'길드 구조소로 부상자를 안내했습니다. 평판 +2.'})]},
  inn_luggage:{career:'inn',title:'돌아오지 않은 손님',prompt:'미귀환 모험가의 가방에 던전 지도와 유물이 남아 있습니다.',options:[
    option('return','길드에 가방을 맡긴다','평판 +5 · 후속 인연','kind',{delta:{reputation:5},text:'가방을 길드에 맡겼습니다. 가족이 이 일을 기억할 것입니다.',due:{delay:3,text:'가방을 돌려받은 가족이 감사 편지를 보냈습니다. 금화 +15, 평판 +2.',delta:{gold:15,reputation:2}}}),
    option('map','지도만 기록한다','탐색력 +2 · 평판 +1','smart',{delta:{scout:2,reputation:1},text:'지도에 적힌 위험 구역을 기록했습니다. 탐색력 +2, 평판 +1.'}),
    option('sell','유물을 매입해 판매한다','금화 +25 · 평판 -4','greed',{delta:{gold:25,reputation:-4},text:'남은 유물을 판매했지만 손님들의 시선이 차가워졌습니다. 금화 +25, 평판 -4.'})]},
  guild_rescue:{career:'guild',title:'구조 의뢰',prompt:'연락이 끊긴 파티의 구조 요청이 길드에 도착했습니다.',options:[
    option('lead','탐험 경험으로 구조를 지휘한다','성공 시 금화 +24 · 실패 위험','bold',{p:.55,skill:'experience',success:{text:'탐험 경험으로 구조대를 이끌었습니다. 금화 +24, 평판 +6.',delta:{gold:24,reputation:6,fatigue:12}},failure:{text:'길이 막혀 구조가 늦어졌습니다. 평판 -2, 피로 +12.',delta:{reputation:-2,fatigue:12}}}),
    option('supply','구조 물자를 지원한다','금화 -10 · 평판 +5','kind',{cost:10,delta:{gold:-10,reputation:5},text:'구조대에 물자를 보냈습니다. 금화 -10, 평판 +5.'}),
    option('veteran','숙련된 구조대에 맡긴다','금화 +5 · 평판 +2','safe',{delta:{gold:5,reputation:2},text:'숙련된 구조대를 연결했습니다. 금화 +5, 평판 +2.'})]},
  guild_rookie:{career:'guild',title:'신입의 첫 의뢰',prompt:'신입 파티가 깊은 던전의 의뢰를 맡겠다고 합니다.',options:[
    option('warn','얕은 던전부터 권한다','평판 +4 · 신입의 생존 지원','kind',{delta:{reputation:4},text:'신입 파티를 이끼 광산으로 안내했습니다. 평판 +4.'}),
    option('train','탐험 지도를 함께 읽는다','탐색력 +1 · 평판 +3','smart',{delta:{scout:1,reputation:3,fatigue:5},text:'신입과 지도를 읽으며 위험을 설명했습니다. 탐색력 +1, 평판 +3.'}),
    option('approve','큰 의뢰를 승인한다','성공 시 높은 수수료 · 실패 위험','greed',{p:.45,skill:'experience',success:{text:'신입 파티가 무사히 돌아왔습니다. 금화 +30, 평판 +2.',delta:{gold:30,reputation:2}},failure:{text:'신입의 탐험이 실패해 길드가 배상했습니다. 금화 -12, 평판 -4.',delta:{gold:-12,reputation:-4}}})]},
  guild_map:{career:'guild',title:'새로운 던전 정보',prompt:'익명의 모험가가 별잠긴 유적의 지도를 가져왔습니다.',options:[
    option('verify','기록과 비교해 검증한다','탐색력 +2 · 평판 +3','smart',{delta:{scout:2,reputation:3,fatigue:5},text:'기록을 대조해 지도의 오류를 찾았습니다. 탐색력 +2, 평판 +3.'}),
    option('publish','안전한 부분부터 공개한다','평판 +4','kind',{delta:{reputation:4},text:'확인된 통로만 모험가들에게 공개했습니다. 평판 +4.'}),
    option('sell','독점 정보로 거래한다','금화 +20 · 평판 -2','greed',{delta:{gold:20,reputation:-2},text:'정보를 독점 계약으로 넘겼습니다. 금화 +20, 평판 -2.'})]},
  trader_curse:{career:'trader',title:'수상한 전리품',prompt:'모험가가 검은 기운이 흐르는 유물을 싸게 팔겠다고 합니다.',options:[
    option('buy','유물을 매입한다','금화 -18 · 큰 수익 또는 저주','greed',{cost:18,p:.55,skill:'luck',success:{text:'유물을 안전하게 거래했습니다. 금화 +42, 평판 +2.',delta:{gold:42,reputation:2}},failure:{text:'유물의 저주가 몸에 깃들었습니다. 평판 -3.',delta:{reputation:-3},flag:'cursed'}}),
    option('inspect','감정사에게 확인한다','금화 -5 · 평판 +3','smart',{cost:5,delta:{gold:-5,reputation:3},text:'감정사가 저주를 확인하고 봉인했습니다. 금화 -5, 평판 +3.',clearFlag:'cursed'}),
    option('decline','거래를 거절한다','안전하게 가게 운영 계속','safe',{text:'유물을 돌려주고 위험한 거래를 피했습니다.'})]},
  trader_caravan:{career:'trader',title:'유적 보급 계약',prompt:'별잠긴 유적으로 떠나는 파티가 큰 보급 계약을 제안합니다.',options:[
    option('invest','보급품을 먼저 마련한다','금화 -20 · 성공 시 큰 수익','bold',{cost:20,p:.65,skill:'luck',success:{text:'보급 계약이 성공했습니다. 금화 +55, 평판 +4.',delta:{gold:55,reputation:4,fatigue:7}},failure:{text:'파티가 일정을 취소했습니다. 투자금은 돌아오지 않았습니다.',delta:{fatigue:7}}}),
    option('deposit','계약금을 받고 납품한다','금화 +12 · 평판 +2','smart',{delta:{gold:12,reputation:2,fatigue:4},text:'계약금을 받고 물품을 보냈습니다. 금화 +12, 평판 +2.'}),
    option('small','소규모 주문만 받는다','금화 +6 · 낮은 피로','safe',{delta:{gold:6,fatigue:2},text:'감당할 수 있는 주문만 받았습니다. 금화 +6.'})]},
  trader_map:{career:'trader',title:'길잡이의 지도',prompt:'길잡이가 세 던전의 통로를 정리한 지도를 판매합니다.',options:[
    option('learn','지도를 사서 익힌다','금화 -10 · 탐색력 +3','smart',{cost:10,delta:{gold:-10,scout:3},text:'세 던전의 지도를 익혔습니다. 금화 -10, 탐색력 +3.',item:'세 던전의 지도'}),
    option('resell','지도를 매입해 되판다','금화 -10 · 판매 수익 +25','greed',{cost:10,delta:{gold:15,reputation:1},text:'지도를 거래해 차익을 남겼습니다. 금화 +15, 평판 +1.'}),
    option('pass','현재 거래에 집중한다','안정적인 영업 계속','safe',{text:'익숙한 거래를 이어갔습니다.'})]},
  smith_ore:{career:'smith',title:'희귀한 광석',prompt:'이끼 광산에서 나온 광석으로 무엇을 만들지 결정해야 합니다.',options:[
    option('weapon','자신의 무기를 강화한다','금화 -12 · 전투력 +3','bold',{cost:12,delta:{gold:-12,power:3,fatigue:6},text:'희귀 광석으로 무기를 강화했습니다. 금화 -12, 전투력 +3.',item:'광석으로 강화한 무기'}),
    option('order','길드 주문품을 만든다','금화 +18 · 평판 +4','smart',{delta:{gold:18,reputation:4,fatigue:8},text:'길드 주문품을 완성했습니다. 금화 +18, 평판 +4.'}),
    option('save','광석을 보관한다','자산을 보존하고 작업 계속','safe',{text:'다음에 사용할 광석을 보관했습니다.',item:'공방의 희귀 광석'})]},
  smith_repair:{career:'smith',title:'저주받은 장비',prompt:'모험가가 저주받은 갑옷을 수리해 달라고 부탁합니다.',options:[
    option('repair','직접 수리한다','성공 시 금화 +28 · 실패 위험','bold',{p:.6,skill:'craft',success:{text:'저주를 피해 장비를 수리했습니다. 금화 +28, 평판 +4.',delta:{gold:28,reputation:4,fatigue:10},clearFlag:'cursed'},failure:{text:'저주의 잔향이 공방을 뒤덮었습니다. 평판 -2, 피로 +15.',delta:{reputation:-2,fatigue:15},flag:'cursed'}}),
    option('cleanse','성직자와 함께 정화한다','금화 -8 · 평판 +5 · 저주 해제','kind',{cost:8,delta:{gold:-8,reputation:5},text:'성직자와 장비를 정화했습니다. 금화 -8, 평판 +5.',clearFlag:'cursed'}),
    option('decline','위험한 작업을 거절한다','안전한 주문에 집중','safe',{text:'위험을 설명하고 정화소를 안내했습니다.'})]},
  smith_apprentice:{career:'smith',title:'도제의 부탁',prompt:'신입 모험가가 장비 손질을 배우고 싶다고 합니다.',options:[
    option('teach','기술을 가르친다','전투력 +1 · 평판 +5','kind',{delta:{power:1,reputation:5,fatigue:7},text:'도제에게 기술을 가르치며 자신의 손도 익숙해졌습니다. 전투력 +1, 평판 +5.'}),
    option('pay','유료 수업을 연다','금화 +14 · 평판 +2','greed',{delta:{gold:14,reputation:2,fatigue:5},text:'장비 손질 수업을 열었습니다. 금화 +14, 평판 +2.'}),
    option('tips','기본 손질법만 알려준다','평판 +2 · 낮은 피로','safe',{delta:{reputation:2,fatigue:1},text:'기본 손질법을 알려줬습니다. 평판 +2.'})]}
};

Object.assign(EVENTS,LIFE_EVENTS);
export const LIFE_EVENT_IDS=Object.freeze(Object.keys(EVENTS));

export class Fantasy extends Dungeon {
  constructor(seed){
    super(seed,{deferJob:true});this.s.world={...defaultWorld(),mode:'childhood',layouts:{}};this.s.timeline={version:1,startAge:1,elapsedDays:0};
    storyState(this);
    bondState(this);
    const names=this.shuffle(FAMILY_NAMES),wealth=this.pick(['어려움','소박함','넉넉함']);
    this.s.life={version:1,stage:'childhood',family:{parents:[{name:names[0],job:this.pick(FAMILY_JOBS)},{name:names[1],job:this.pick(FAMILY_JOBS)}],place:this.pick(BIRTHPLACES),wealth},illness:null,jobRevealPending:false};
  }
  static restore(raw){
    const base=Dungeon.restore(raw),game=Object.create(Fantasy.prototype);game.s=base.s;
    if(!raw.world){game.s.world={...defaultWorld(),mode:raw.status==='ready'?'hub':'dungeon',bestFloor:raw.maxFloor||0};}
    else{const w=raw.world;if(w.version!==1 || !['hub','dungeon','life','childhood'].includes(w.mode) || !DUNGEONS.some(d=>d.id===w.dungeonId) || (w.career&&!CAREERS.some(c=>c.id===w.career)) || !Number.isFinite(w.day) || !Number.isFinite(w.reputation) || !Number.isFinite(w.fatigue) || !Array.isArray(w.due) || !Array.isArray(w.careerHistory))throw new Error('이야기 저장 데이터가 올바르지 않습니다.');game.s.world={...defaultWorld(),...structuredClone(w)};}
    if(raw.life){const l=raw.life;if(l.version!==1||!['childhood','adult'].includes(l.stage)||!l.family||!Array.isArray(l.family.parents)||l.family.parents.length!==2||!l.family.parents.every(p=>typeof p.name==='string'&&typeof p.job==='string')||!BIRTHPLACES.includes(l.family.place)||!['어려움','소박함','넉넉함'].includes(l.family.wealth)||(l.illness&&(!['fever','infection'].includes(l.illness.id)||![1,2].includes(l.illness.step)||typeof l.illness.fatal!=='boolean'))||(game.world.mode==='childhood')!==(l.stage==='childhood')||(game.character.job==='child')!==(l.stage==='childhood'))throw new Error('유년기 저장 데이터가 올바르지 않습니다.');}
    else if(game.world.mode==='childhood')throw new Error('유년기 저장 데이터가 없습니다.');
    const w=game.world;
    if(!w.eventCounts||typeof w.eventCounts!=='object'||Array.isArray(w.eventCounts)||!Object.values(w.eventCounts).every(n=>Number.isInteger(n)&&n>=0)||!Array.isArray(w.routineOrder)||(w.adultArc&&(!['illness','war'].includes(w.adultArc.type)||![1,2].includes(w.adultArc.step)||typeof w.adultArc.fatal!=='boolean'))||(w.lastAgeCheck!==null&&(!Number.isInteger(w.lastAgeCheck)||w.lastAgeCheck<0)))throw new Error('생애 사건 저장 데이터가 올바르지 않습니다.');
    // Old saves already contain these prompts; do not replay them after the new event pool is installed.
    if(!raw.world?.eventCounts)for(const key of LIFE_EVENT_IDS)w.eventCounts[key]=Math.min(1,game.s.log.filter(x=>x.kind==='choice'&&x.text===EVENTS[key].prompt).length);
    if(raw.timeline){if(raw.timeline.version!==1||!Number.isInteger(raw.timeline.startAge)||raw.timeline.startAge<0||!Number.isInteger(raw.timeline.elapsedDays)||raw.timeline.elapsedDays<0)throw new Error('나이 저장 데이터가 올바르지 않습니다.');}
    else game.s.timeline={version:1,startAge:18,elapsedDays:(game.world.totalDays||0)*30+(game.s.roomsExplored||0)};
    if(w.layouts){if(typeof w.layouts!=='object'||Array.isArray(w.layouts)||Object.entries(w.layouts).some(([id,l])=>!DUNGEONS.some(d=>d.id===id)||!validLayout(l)))throw new Error('던전 구조 저장 데이터가 올바르지 않습니다.');}
    else w.layouts=raw.world?Object.fromEntries(DUNGEONS.map(d=>[d.id,legacyLayout(d)])):{};
    if(game.world.mode==='dungeon'&&w.layouts[w.dungeonId])w.layouts[w.dungeonId].visited=Math.max(w.layouts[w.dungeonId].visited,Math.min(game.s.maxFloor,w.layouts[w.dungeonId].floors.length));
    if(game.s.outcome&&!Number.isInteger(game.s.outcome.ageYears))game.stampOutcome();
    if(w.dungeonStories&&!validStoryState(w.dungeonStories))throw new Error('던전 사건 저장 데이터가 올바르지 않습니다.');
    if((game.s.choice?.kind==='dungeon-event'&&!validStoryTrail(game.s.choice.trail))||game.s.queue.some(e=>e.storyEffect&&!validStoryTrail(e.storyEffect.trail)))throw new Error('던전 인연 기록이 올바르지 않습니다.');
    storyState(game);
    if(w.bonds&&!validBonds(w.bonds))throw new Error('마을 인연 저장 데이터가 올바르지 않습니다.');
    if(game.s.queue.some(e=>e.bondEffect&&!validBondEffect(e.bondEffect)))throw new Error('마을 재회 결과가 올바르지 않습니다.');
    if(!validRelationshipChoice(game.s.choice))throw new Error('인연의 재회 선택이 올바르지 않습니다.');
    if(!validCompanionState(w.companions)||!validCompanionChoice(game.s.choice)||game.s.queue.some(e=>e.companionEffect&&!validCompanionEffect(e.companionEffect)))throw new Error('동행의 저장 기록이 올바르지 않습니다.');
    if(w.companions?.active){const a=w.companions.active;if(w.mode!=='dungeon'||a.trip!==w.trips||!w.bonds?.contacts[a.group]||!personAvailable(w.bonds.people[a.group]))throw new Error('동행 상태가 현재 원정과 맞지 않습니다.');}
    if(!validCompanionChoice(w.exitSnapshot?.choice)||w.exitSnapshot?.queue?.some(e=>e.companionEffect&&!validCompanionEffect(e.companionEffect)))throw new Error('귀환 전 동행 기록이 올바르지 않습니다.');
    migrateBonds(game);
    return game;
  }
  age(){const t=this.s.timeline;return {years:t.startAge+Math.floor(t.elapsedDays/360),months:Math.floor((t.elapsedDays%360)/30)};}
  ageLabel(){const a=this.age();return `${a.years}세${a.months?` ${a.months}개월`:''}`;}
  elapsedLabel(){const d=this.s.timeline.elapsedDays;return d>=360?`${Math.floor(d/360)}년 ${Math.floor(d%360/30)}개월`:d>=30?`${Math.floor(d/30)}개월`:`${d}일`;}
  stampOutcome(){const a=this.age();Object.assign(this.s.outcome,{ageYears:a.years,ageMonths:a.months,elapsedDays:this.s.timeline.elapsedDays,location:this.location()});}
  advanceTime(days){this.s.timeline.elapsedDays+=days;}
  oldAge(location){
    const age=this.age().years;
    if(this.world.lastAgeCheck===age)return false;
    this.world.lastAgeCheck=age;
    const risk=agingRisk(this.character.race,age);
    if(!risk||!this.chance(risk))return false;
    this.s.flags.deathCause=this.character.race==='undead'?'오랜 세월을 버틴 육신의 마력이 다했습니다.':'쇠약해진 몸이 마지막 밤을 넘기지 못했습니다. 노환으로 생을 마쳤습니다.';
    this.emit(this.s.flags.deathCause,'big',{hp:-this.s.hp},{finish:'death',location});return true;
  }
  townEvent(){
    const w=this.world;
    if(this.chance(.006)){
      this.s.flags.deathCause=this.pick(['길에서 벌어진 시비가 칼부림으로 번져 목숨을 잃었습니다.','귀가하던 길에 무너진 담장에 깔렸습니다.','아무런 징후 없이 갑자기 쓰러져 다시 일어나지 못했습니다.']);
      if(this.s.flags.deathCause.includes('시비')&&w.career==='trader'&&w.flags.traderGuard){delete this.s.flags.deathCause;this.emit('가게 앞에서 시비가 붙었지만 고용한 경비가 싸움을 막았습니다.','note');return true;}
      this.emit(this.s.flags.deathCause,'bad',{hp:-this.s.hp});return true;
    }
    if(this.chance(.04)){
      const risk=Math.min(.55,.15+Math.max(0,this.age().years-50)*.008+(this.has('frail')?.08:0)+(w.fatigue>=70?.06:0));
      w.adultArc={type:'illness',step:1,fatal:this.chance(risk*(w.flags.healthNetwork?.55:1)*(w.flags.bondClinic?.8:1)*(this.has('regen')?.75:1))};w.flags.illnessSeen=true;
      this.emit('갑작스러운 열병으로 일을 내려놓고 누웠습니다. 치료사가 집을 찾아왔습니다.','bad',{fatigue:8});return true;
    }
    if(!w.flags.warSeen&&this.chance(.012)){
      w.flags.warSeen=true;w.adultArc={type:'war',step:1,fatal:this.chance(.18)};
      this.emit('변경에서 전쟁이 시작됐습니다. 던전 물자와 피난민이 마을로 몰려왔습니다.','big');return true;
    }
    return false;
  }
  adultArcStep(){
    const a=this.world.adultArc;
    if(a.step===1){a.step=2;this.emit(a.type==='illness'?'며칠째 열이 내리지 않았습니다. 가까운 사람들이 번갈아 곁을 지켰습니다.':'피난 행렬을 돕던 중 전투가 마을 입구까지 번졌습니다.','bad',{fatigue:5});}
    else{this.world.adultArc=null;if(a.fatal){this.s.flags.deathCause=a.type==='illness'?'앓던 열병이 악화되어 치료에도 회복하지 못했습니다.':'피난 행렬을 덮친 전쟁의 유탄에 목숨을 잃었습니다.';this.emit(this.s.flags.deathCause,'bad',{hp:-this.s.hp});}else this.emit(a.type==='illness'?'치료와 간호를 받은 뒤 열이 내렸습니다. 천천히 일상으로 돌아왔습니다.':'마을을 떠돌던 포성이 멎었습니다. 살아남은 이웃들과 일상을 다시 시작했습니다.','good',{fatigue:-8});}return true;
  }
  get world(){return this.s.world;}
  get life(){return this.s.life;}
  job(){return this.character.job==='child'?CHILD_JOB:super.job();}
  familyLabel(){const f=this.life?.family;return f?`${f.parents.map(p=>`${p.name}(${p.job})`).join(' · ')} · ${f.place}`:'';}
  dungeon(){return DUNGEONS.find(d=>d.id===(this.world?.dungeonId||'crypt'));}
  career(){return CAREERS.find(c=>c.id===this.world?.career)||null;}
  displayJob(){return this.world.mode==='life'?this.career():this.job();}
  layout(){return this.world.layouts?.[this.world.dungeonId];}
  floorNames(){return this.layout()?.floors||this.dungeon().floors;}
  roomCount(floor=this.s.floor){return this.layout()?.rooms[floor-1]||6;}
  landmark(){
    if(!this.world.tripLandmarks)return super.landmark();
    return this.world.tripLandmarks.find(p=>p.floor===this.s.floor&&p.room===this.s.room)?.kind||null;
  }
  setChoice(kind){
    if(kind==='companion-event'){
      const spot=this.world.tripLandmarks.find(p=>p.floor===this.s.floor&&p.room===this.s.room);
      if(spot&&openCompanionEvent(this,spot.group,spot.phase))return true;
      this.emit('서로 다른 길의 발자국이 갈림길에서 멀어졌습니다. 탐험을 이어갑니다.','note');return true;
    }
    if(kind==='dungeon-event'){
      const spot=this.world.tripLandmarks.find(p=>p.floor===this.s.floor&&p.room===this.s.room);
      return spot?openDungeonEvent(this,spot.source):false;
    }
    return super.setChoice(kind);
  }
  encounter(){
    // Rotate the scenery bag while keeping the merchant/ghost encounter rules.
    const s=this.s;
    if(s.floor>=2&&!s.flags.merchant&&s.gold>=20&&this.chance(.4)){this.setChoice('merchant');return;}
    if(this.chance(.25)){const gold=this.int(3,8);this.emit(`길을 잃은 유령에게 출구를 알려줬습니다. 답례로 금화 ${gold}개를 받았습니다.`,'good',{gold});return;}
    if(!this.world.sceneOrder?.length){const last=this.world.lastScene;this.world.sceneOrder=this.shuffle(this.sceneAt());if(this.world.sceneOrder.at(-1)===last)this.world.sceneOrder.unshift(this.world.sceneOrder.pop());}
    const scene=this.world.sceneOrder.pop();this.world.lastScene=scene;this.emit(scene,'note');
  }
  monstersAt(){return this.dungeon().monsters;}
  sceneAt(){return this.dungeon().scenes;}
  bossName(){return this.dungeon().boss;}
  bossReward(){return this.dungeon().reward;}
  bossLoot(){return this.dungeon().loot;}
  danger(){return {mine:1,crypt:1.02,ruins:1.04}[this.dungeon().id];}
  location(){return this.world.mode==='childhood'?`${this.life.family.place} · 집`:this.world.mode==='dungeon'?`${this.dungeon().name} · ${this.s.floor?this.s.floor+'층':'입구'}`:this.world.mode==='life'?`${this.career().place} · ${Math.floor(this.world.day/12)}년`:'미궁마을';}
  emit(text,kind='normal',delta={},extra={}){
    if(extra.travelYear){this.advanceTime(360);if(this.oldAge(extra.location))return;}
    ({text,delta,extra}=rescueByCompanion(this,text,delta,extra));
    const location=extra.location||this.location();
    if(extra.finish==='death')text=`${this.character.name}, ${this.ageLabel()}에 ${location}에서 사망했습니다. ${this.s.flags.deathCause||text}`;
    this.world.reputation=bound(this.world.reputation+(delta.reputation||0),0,100);
    this.world.fatigue=bound(this.world.fatigue+(delta.fatigue||0),0,100);
    super.emit(text,kind,delta,extra);Object.assign(this.s.log.at(-1),{location,ageYears:this.age().years,ageMonths:this.age().months,elapsedDays:this.s.timeline.elapsedDays});
    if(this.s.outcome&&extra.finish==='death')this.s.outcome.location=location;
    if(extra.storyEffect&&this.s.hp>0&&this.s.status!=='ended'){commitDungeonEffect(this,extra.storyEffect);rememberDungeonContact(this,extra.storyEffect);applyDungeonRelationship(this,extra.storyEffect);}
    if(extra.flag==='helped'&&this.s.hp>0)rememberRescuedGoblin(this);
    if(extra.bondEffect&&this.s.hp>0&&this.s.status!=='ended')commitTownConnection(this,extra.bondEffect);
    if(extra.companionEffect)commitCompanionEffect(this,extra.companionEffect);
    this.world.bestFloor=Math.max(this.world.bestFloor,this.s.maxFloor);
    if(this.world.mode==='dungeon'&&this.layout())this.layout().visited=Math.max(this.layout().visited,Math.min(this.s.floor,this.floorCount()));
    if(extra.clearFlag)this.s.flags[extra.clearFlag]=false;
    if(extra.nextMenu)this.world.pendingMenu=extra.nextMenu;
    if(extra.retireCareer){this.stopCareer();this.world.exitPending=false;}
    if(extra.worldFlag)this.world.flags[extra.worldFlag]=true;
  }
  start(){
    if(this.s.status!=='ready')return false;this.s.status='running';this.s.startedAt=new Date().toISOString();
    if(this.life?.stage==='childhood'){
      const f=this.life.family,[a,b]=f.parents;
      this.emit(this.character.race==='undead'?`${f.place}의 집에서 어린 언데드가 깨어났습니다. 이름은 ${this.character.name}, 가족은 ${a.name}·${b.name}입니다.`:`${f.place}에서 ${a.name}·${b.name}의 아이가 태어났습니다. 이름은 ${this.character.name}, 종족은 ${this.race().name}입니다.`,'big');
      this.enqueue(`${a.name}의 생업은 ${a.job}, ${b.name}의 생업은 ${b.job}입니다. ${f.wealth==='어려움'?'살림은 어려웠지만 아이를 함께 돌봤습니다.':f.wealth==='넉넉함'?'넉넉한 살림에서 아이를 함께 돌봤습니다.':'소박한 살림에서 아이를 함께 돌봤습니다.'}`,'note');
    }else{this.world.mode='hub';this.emit(`${this.ageLabel()} ${this.race().name} ${this.job().name} ${this.character.name}의 이야기가 미궁마을에서 시작됩니다.`,'big');}return true;
  }
  growUp(){
    const job=this.pick(JOBS),c=this.character;
    c.job=job.id;c.maxHp+=job.hp;c.power+=job.power;c.scout+=job.scout;c.luck+=job.luck;
    this.s.hp=c.maxHp;this.s.potions=2;this.s.inventory.push(this.pick(job.weapons));this.life.stage='adult';this.life.jobRevealPending=true;this.world.mode='hub';
    this.emit(`${c.name}의 첫 직업은 ${job.name}입니다. 성인이 되어 자신의 길을 떠날 준비를 했습니다.`,'big');
  }
  childhoodStep(){
    const l=this.life,f=l.family;
    if(l.illness){
      const sick=l.illness;
      if(sick.step===1){sick.step=2;this.emit(`${f.parents[0].name}의 간호가 밤새 이어졌습니다. ${sick.id==='fever'?'열은 쉽게 가라앉지 않았습니다.':'상처 주변이 붓고 열이 났습니다.'}`,'bad');}
      else{l.illness=null;if(sick.fatal){this.s.flags.deathCause=sick.id==='fever'?'어린 시절 앓던 고열을 이겨내지 못했습니다.':'작은 상처의 감염이 온몸으로 번졌습니다.';this.emit(this.s.flags.deathCause,'bad',{hp:-this.s.hp});}else this.emit(`${f.parents[1].name}의 약과 가족의 간호로 회복했습니다. 다시 집 앞을 걸었습니다.`,'good');}return true;
    }
    this.advanceTime(360);if(this.age().years>=18){this.growUp();return true;}
    if(this.chance(.0025)){this.s.flags.deathCause='마을 길에서 일어난 수레 사고로 목숨을 잃었습니다.';this.emit(this.s.flags.deathCause,'bad',{hp:-this.s.hp});return true;}
    if(this.chance(.07)){
      const id=this.pick(['fever','infection']),care=f.wealth==='어려움'?1.2:f.wealth==='넉넉함'?.8:1;
      l.illness={id,step:1,fatal:this.chance(.10*care*(this.has('frail')?1.35:1)*(this.has('regen')?.8:1))};
      this.world.flags.illnessSeen=true;
      this.emit(id==='fever'?'갑자기 높은 열이 나 집에서 누워 지냈습니다.':'놀다가 생긴 작은 상처가 덧났습니다. 부모가 치료사를 찾아갔습니다.','bad');return true;
    }
    const age=this.age().years;
    if(age===6)this.emit(`${f.parents[0].name}의 손을 잡고 마을 학교에 갔습니다. 처음으로 글을 배웠습니다.`,'big');
    else if(age===12)this.emit(`${f.parents[1].name}의 일을 거들며 던전과 마을이 이어져 있음을 알았습니다.`,'note');
    else this.emit(this.pick(CHILD_EVENTS[age<6?'young':age<12?'school':'youth']),'normal');return true;
  }
  finish(type,text){
    this.world.exitPending=false;
    partCompanion(this,type);
    super.finish(type,text);
    this.stampOutcome();
    if(type==='return'||type==='clear'){
      this.world.lastTrip=structuredClone(this.s.outcome);this.world.bestFloor=Math.max(this.world.bestFloor,this.s.maxFloor);
      if(type==='clear'&&!this.world.cleared.includes(this.world.dungeonId))this.world.cleared.push(this.world.dungeonId);
      this.s.status='running';this.s.outcome=null;this.world.mode='hub';this.world.exitSnapshot=null;this.s.hp=this.character.maxHp;this.world.fatigue=Math.max(0,this.world.fatigue-20);
      this.enqueue('미궁마을에서 상처를 치료했습니다. 다시 탐험하거나 다른 일을 시작할 수 있습니다.','good',{}, {location:'미궁마을'});
      if(this.world.tripRecovery)this.enqueue('원정 뒤 한 해 동안 장비를 고치고 몸을 추슬렀습니다.','note',{}, {travelYear:true,location:'미궁마을'});
    }else{this.s.outcome.floor=Math.max(this.world.bestFloor,this.s.maxFloor);this.s.outcome.days=this.world.totalDays;this.s.outcome.careers=[...this.world.careerHistory];}
  }
  resultTitle(type){if(type==='death'&&this.life?.stage==='childhood')return '어린 시절에 멈춘 이야기';if(type==='story')return this.world.reputation>=50?'미궁마을에 이름을 남긴 사람':this.world.totalDays>0?'모험과 일 사이에서 길을 찾은 사람':'자신의 길을 골랐던 모험가';return super.resultTitle(type);}
  step(){
    if(this.s.status!=='running')return false;
    if(!this.s.queue.length&&this.world.pendingMenu){const menu=this.world.pendingMenu;delete this.world.pendingMenu;this.worldChoice(menu);return true;}
    if(this.s.queue.length)return super.step();
    if(this.world.mode==='childhood')return this.childhoodStep();
    if(this.world.adultArc)return this.adultArcStep();
    if(this.world.mode==='dungeon'){
      if(this.world.companions?.active?.remaining===0){partCompanion(this);return true;}
      const previousFloor=this.s.floor,previousRoom=this.s.room;
      if(this.s.floor===4&&!personAvailable(this.world.bonds.people.caravan))this.s.flags.repaid=true;
      if(this.s.floor>0&&this.s.room>=this.roomCount()&&this.s.floor<this.floorCount()){
        this.s.floor++;this.s.room=0;this.s.maxFloor=Math.max(this.s.maxFloor,this.s.floor);
        this.emit(`계단을 따라 ${this.s.floor}층 ${this.floorNames()[this.s.floor-1]}에 들어섰습니다.`,'big');advanceCompanion(this,previousFloor,previousRoom);return true;
      }
      if(this.s.floor>0&&this.s.room<this.roomCount()&&!(this.s.hp<=this.character.maxHp*.35&&this.s.potions>0))this.advanceTime(1);
      if(this.oldAge())return true;const result=super.step();advanceCompanion(this,previousFloor,previousRoom);return result;
    }
    if(this.world.mode==='hub'){this.worldChoice('hub');return true;}
    const w=this.world;
    if(w.fatigue>=80){w.day+=12;w.totalDays+=12;this.advanceTime(360);if(this.oldAge()||this.townEvent())return true;this.emit('바쁜 일을 내려놓고 한 해 쉬었습니다. 피로 -30, 체력 +10.','good',{fatigue:-30,hp:10});return true;}
    const due=w.due.find(x=>x.day<=w.totalDays);
    if(due){w.due.splice(w.due.indexOf(due),1);this.emit(due.text,'good',due.delta);return true;}
    if(!Number.isFinite(w.nextLifeEvent))this.scheduleLifeEvent();
    w.day+=12;w.totalDays+=12;
    this.advanceTime(360);if(this.oldAge()||this.townEvent())return true;
    if(this.s.flags.helped&&!w.flags.friendVisited&&personAvailable(w.bonds.people.caravan)){w.flags.friendVisited=true;this.emit('던전에서 살려준 고블린이 찾아와 손님과 의뢰를 소개했습니다. 금화 +16, 평판 +5.','rare',{gold:16,reputation:5});return true;}
    if(this.s.inventory.includes('거수의 광석')&&w.career==='smith'&&!w.flags.oreUsed){w.flags.oreUsed=true;this.emit('광산에서 가져온 광석으로 좋은 도구를 만들었습니다. 전투력 +2, 평판 +3.','rare',{power:2,reputation:3});return true;}
    if(w.totalDays>=w.nextLifeEvent){const reunion=drawTownConnection(this);if(reunion){this.scheduleLifeEvent();if(reunion.startsWith('memory:'))openCompanionMemory(this,reunion.slice(7));else if(reunion.startsWith('relation:'))openRelationshipEvent(this,reunion.slice(9));else openTownConnection(this,reunion);return true;}const key=this.drawLifeEvent();this.scheduleLifeEvent();if(key){this.lifeChoice(key);return true;}}
    if(companionReminiscence(this))return true;
    let gold=this.int(5,11)+(this.has('greedy')?3:0)+Math.floor(w.reputation/30),fatigue=this.int(4,8)-(this.has('regen')?2:0);
    if((w.career==='smith'&&this.character.race==='dwarf')||(w.career==='trader'&&this.character.race==='goblin')||(w.career==='inn'&&this.character.race==='undead')||(w.career==='guild'&&this.character.race==='human'))gold+=3;
    if(w.flags.innExpanded&&w.career==='inn')gold+=3;
    if(w.flags.smithFurnace&&w.career==='smith')gold+=3;
    if(w.flags.traderTrusted&&w.career==='trader')gold+=2;
    if(w.career==='inn'){if(w.flags.bondInnMiners)gold+=2;if(w.flags.bondInnCaravan)gold+=2;if(w.flags.bondInnWatch)fatigue=Math.max(1,fatigue-2);}
    if(w.career==='guild'){if(w.flags.bondGuildSupply)gold+=1;if(w.flags.bondGuildProtocol)fatigue=Math.max(1,fatigue-2);if(w.flags.bondGuildMentor)fatigue=Math.max(1,fatigue-2);}
    if(w.career==='trader'){if(w.flags.bondTraderOre)gold+=2;if(w.flags.bondTraderHerbs)gold+=1;if(w.flags.bondTraderCaravan)gold+=2;if(w.flags.bondTraderCatalog)gold+=1;if(w.flags.bondTraderPacking)fatigue=Math.max(1,fatigue-2);}
    if(w.career==='smith'){if(w.flags.bondSmithTools)gold+=2;if(w.flags.bondSmithHerbs)gold+=1;if(w.flags.bondSmithCaravan)gold+=2;if(w.flags.bondSmithPatterns)fatigue=Math.max(1,fatigue-2);}
    if(w.flags[`${w.career}Helper`]){fatigue=Math.max(1,fatigue-3);gold+=1;}
    if(!w.routineOrder.length){w.routineOrder=this.shuffle(routine[w.career]);if(w.routineOrder[0]===w.lastRoutine)w.routineOrder.push(w.routineOrder.shift());}const text=w.routineOrder.shift();w.lastRoutine=text;
    this.emit(`한 해가 흘렀습니다. ${text} 금화 +${gold}, 피로 +${fatigue}.`,'normal',{gold,fatigue});return true;
  }
  setMenu(kind,prompt,options,extra={}){this.s.choice={id:++this.s.serial,kind,prompt,options,...extra};this.s.status='choice';this.emit(prompt,'choice');}
  worldChoice(kind){
    if(kind==='hub')this.setMenu('hub','미궁마을에서 어떤 길을 이어갈까요?',[option('delve','모험을 떠난다','도착한 곳에서 던전을 발견','bold'),option('work','마을에서 일을 시작한다','여관 · 길드 · 상점 · 공방','kind'),option('end','이야기를 마무리한다','현재까지의 삶을 기록','safe')]);
    else if(kind==='dungeons')this.setMenu('dungeons','어느 던전으로 향할까요?',[...DUNGEONS.map(d=>option(d.id,d.name,d.hint,'bold',{icon:'warrior'})),option('back','마을로 돌아간다','다른 길을 고르기')]);
    else if(kind==='careers')this.setMenu('careers','던전과 연결된 어떤 일을 시작할까요?',[...CAREERS.map(c=>option(c.id,c.name,c.hint,'kind',{icon:c.id})),option('back','마을로 돌아간다','다른 길을 고르기')]);
    else if(kind==='review')this.setMenu('review',`${this.career().place}에서 열두 달이 지났습니다. 다음은 어떻게 할까요?`,[option('continue','지금 일을 계속한다','수입과 평판을 쌓기','smart'),option('delve','다시 던전으로 향한다','현재 캐릭터와 장비로 탐험','bold'),option('retire','이 일을 은퇴한다','마을에서 다른 일을 고를 수 있음','safe')]);
    else this.setMenu('leave',this.world.mode==='life'?'지금 일을 그만두고 다른 길을 고를까요?':'탐험을 중단하고 지금 마을로 나갈까요?',[option('leave','마을로 나간다','현재 자산·장비·인연 유지','safe'),option('continue','지금 상황으로 돌아간다','남은 선택과 진행을 그대로 유지','bold')]);
  }
  scheduleLifeEvent(){this.world.nextLifeEvent=this.world.totalDays+this.int(3,5)*12;}
  drawLifeEvent(){
    const w=this.world,age=this.age().years;
    const available=LIFE_EVENT_IDS.filter(k=>{const e=EVENTS[k];return e.career===w.career&&!(w.eventCounts[k]>=1)&&age>=(e.minAge||0)&&w.reputation>=(e.minRep||0)&&w.reputation<=(e.maxRep??100)&&this.s.gold>=(e.minGold||0)&&(!e.requires||w.flags[e.requires]);});
    return available.length?this.pick(available):null;
  }
  drawDungeon(){
    const weights=this.character.power>=23?[20,35,45]:this.character.power>=16?[40,40,20]:[65,30,5];
    if(this.world.trips)weights[DUNGEONS.findIndex(d=>d.id===this.world.dungeonId)]*=.4;
    let roll=this.random()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<0)return DUNGEONS[i].id;}return DUNGEONS.at(-1).id;
  }
  enterDungeon(id){
    if(this.world.mode==='childhood'||this.s.status==='ended')return false;
    const d=DUNGEONS.find(d=>d.id===id);if(!d)throw new Error('알 수 없는 던전입니다.');
    const s=this.s;this.world.dungeonId=id;this.world.mode='dungeon';this.world.trips++;
    this.world.layouts??={};this.world.layouts[id]??=createLayout(s.id,d);
    this.world.sceneOrder=[];this.world.lastScene=null;
    this.world.tripLandmarks=planDungeonEvents(this);
    const years=this.int(1,2);this.world.tripRecovery=this.int(0,1);
    s.status='running';s.choice=null;s.floor=0;s.room=0;s.maxFloor=0;s.hp=this.character.maxHp;s.potions=Math.max(2,s.potions);s.flags.merchant=false;s.flags.shrine=false;s.flags.undeadMemory=false;s.flags.secret=false;
    // One preparation record per year lets aging run once for every elapsed year.
    s.queue.push(...Array.from({length:years},(_,i)=>({floor:0,text:i?'먼 길을 오가며 보급품과 탐험 장비를 준비했습니다. 한 해가 흘렀습니다.':'원정을 준비하고 길을 익히는 동안 한 해가 흘렀습니다.',kind:'note',delta:{},travelYear:true,location:'미궁마을 · 원정 준비'})));
    this.enqueue(`길을 따라 도착한 곳은 ${d.name}입니다. ${ {mine:'작은 폐광',crypt:'깊은 지하묘지',ruins:'광대한 고대 유적'}[id] }. 끝은 아직 알 수 없습니다.`,'big');
  }
  lifeChoice(key){const e=EVENTS[key];this.world.eventCounts[key]=(this.world.eventCounts[key]||0)+1;this.setMenu('life-event',e.prompt,e.options.map(o=>({...o,disabled:(o.cost||0)>this.s.gold||(o.potionCost||0)>this.s.potions})),{source:key,title:e.title});}
  canChangePath(){return this.s.status!=='ready'&&this.s.status!=='ended'&&this.s.hp>0&&!['hub','childhood'].includes(this.world.mode)&&this.s.choice?.kind!=='leave'&&!this.world.exitPending;}
  requestChange(){if(!this.canChangePath())return false;this.world.exitSnapshot={status:this.s.status,choice:structuredClone(this.s.choice),queue:structuredClone(this.s.queue)};this.s.queue=[];this.worldChoice('leave');return true;}
  stopCareer(){if(this.world.career)this.world.lastCareer=this.world.career;this.world.mode='hub';this.world.career=null;this.world.day=0;this.world.exitSnapshot=null;}
  choose(id){
    const s=this.s,ch=s.choice;if(s.status!=='choice'||!ch)return false;
    if(ch.kind==='dungeon-event')return chooseDungeonEvent(this,id);
    if(ch.kind==='bond-event')return chooseTownConnection(this,id);
    if(ch.kind==='relation-event')return chooseRelationshipEvent(this,id);
    if(ch.kind==='companion-event')return chooseCompanionEvent(this,id);
    if(ch.kind==='companion-memory')return chooseCompanionMemory(this,id);
    if(!['hub','dungeons','careers','review','leave','life-event'].includes(ch.kind))return super.choose(id);
    const o=ch.options.find(x=>x.id===id);if(!o||o.disabled||(o.cost||0)>s.gold||(o.potionCost||0)>s.potions)return false;
    s.status='running';s.choice=null;s.choicesMade++;this.emit(`선택: ${o.label}.`,'choice');
    if(ch.kind==='hub'){
      if(id==='delve')this.enterDungeon(this.drawDungeon());
      else if(id==='work'){s.queue.push({text:'던전 입구의 일자리를 둘러봅니다.',kind:'note',delta:{},nextMenu:'careers',location:'미궁마을'});}
      else this.enqueue('자신이 고른 길과 남긴 인연을 돌아보며 이야기를 마무리했습니다.','big',{}, {finish:'story'});
    }else if(ch.kind==='dungeons'){
      if(id==='back')this.world.mode='hub';else this.enterDungeon(id);
    }else if(ch.kind==='careers'){
      if(id==='back')this.world.mode='hub';else{this.world.mode='life';this.world.career=id;this.world.day=0;this.world.seasons++;this.world.routineOrder=[];if(!this.world.careerHistory.includes(id))this.world.careerHistory.push(id);this.world.eventOrder=[];this.scheduleLifeEvent();this.enqueue(`${this.career().name} 일을 시작했습니다. 던전에서의 경험도 이곳에서 쓰일 것입니다.`,'big');}
    }else if(ch.kind==='review'){
      if(id==='continue'){this.world.day=0;this.world.seasons++;this.scheduleLifeEvent();this.enqueue('일상을 계속 이어갑니다. 큰 사건이 생기면 다시 결정합니다.','note');}
      else{const old=this.career().name;this.stopCareer();this.enqueue(`${old} 일을 내려놓았습니다. 다른 일을 시작하거나 다시 탐험할 수 있습니다.`,'big');if(id==='delve')this.enterDungeon(this.drawDungeon());}
    }else if(ch.kind==='leave'){
      if(id==='continue'){const prev=this.world.exitSnapshot;this.world.exitSnapshot=null;s.status=prev.status;s.choice=prev.choice;s.queue=prev.queue;}
      else{const previous=this.world.exitSnapshot;this.world.exitSnapshot=null;this.world.exitPending=true;s.queue=previous.queue;if(this.world.mode==='dungeon')this.enqueue('탐험 도중 마을로 나왔습니다. 현재 자산과 장비를 가져갑니다.','good',{}, {finish:'return'});else{const old=this.career().name;this.enqueue(`${old} 일을 은퇴하고 마을로 나왔습니다. 새로운 길을 고를 수 있습니다.`,'big',{}, {retireCareer:true});}}
    }else{
      const e=EVENTS[ch.source],actual=e.options.find(x=>x.id===id);
      if(actual.cost)s.gold-=actual.cost;
      let result=actual;
      if(actual.p!=null){const skill=actual.skill==='experience'?this.world.bestFloor*.035:actual.skill==='scout'?this.character.scout*.008:actual.skill==='craft'?(this.character.race==='dwarf'?.15:0)+this.character.power*.006:this.character.luck*.012;result=this.chance(actual.p+skill)?actual.success:actual.failure;}
      const delta={...(result.delta||{})};
      // Fixed-cost choices already paid above; their displayed negative delta is descriptive.
      if(actual.cost&&actual.p==null)delta.gold=(delta.gold||0)+actual.cost;
      this.enqueue(result.text,result===actual.failure?'bad':'good',delta,{item:result.item,flag:result.flag,clearFlag:result.clearFlag,worldFlag:result.worldFlag,retireCareer:result.retireCareer});
      if(actual.due)this.world.due.push({day:this.world.totalDays+actual.due.delay,text:actual.due.text,delta:actual.due.delta});
    }
    return true;
  }
  enqueue(text,kind='normal',delta={},extra={}){super.enqueue(text,kind,delta,{location:this.location(),...extra});}
  autoChoice(){
    const ch=this.s.choice;if(!ch)return null;
    if(['dungeon-event','bond-event','relation-event','companion-event','companion-memory'].includes(ch.kind))return dungeonEventAutoChoice(this);
    if(!['hub','dungeons','careers','review','leave','life-event'].includes(ch.kind))return super.autoChoice();
    const opts=ch.options.filter(o=>!o.disabled);
    if(ch.autoPolicy===2&&opts.some(o=>o.id===ch.autoTarget))return ch.autoTarget;
    ch.autoPolicy=2;
    if(ch.kind==='hub'){
      const adventure=(this.has('brave')?.8:this.has('coward')?.3:.65)*(this.world.trips?.25:1);
      return ch.autoTarget=this.choiceRoll()<(this.world.fatigue>=60?adventure*.4:adventure)?'delve':'work';
    }
    if(ch.kind==='dungeons')return this.character.power>=23?'ruins':this.character.power>=16?'crypt':'mine';
    if(ch.kind==='careers'){
      const preferred=this.has('greedy')?'trader':this.character.race==='dwarf'?'smith':this.character.job==='priest'?'inn':null;
      const pool=opts.filter(o=>o.id!=='back');const weights=pool.map(o=>(this.world.careerHistory.includes(o.id)?.65:1)+(o.id===preferred?.5:0));return ch.autoTarget=this.weightedOption(pool,weights);
    }
    if(ch.kind==='review')return 'continue';
    if(ch.kind==='leave')return 'leave';
    const preferred=this.has('coward')?'safe':this.has('greedy')?'greed':this.has('brave')?'bold':this.has('blessed')?'kind':'smart';
    const weights=opts.map(o=>1+(o.bias===preferred?5:0)+(o.bias==='safe'&&(this.s.hp<this.character.maxHp*.4||this.world.fatigue>=70)?5:0));
    return ch.autoTarget=this.weightedOption(opts,weights);
  }
  choiceRoll(){let x=(this.s.seed^Math.imul(this.s.choice.id,0x9E3779B1))>>>0;x=Math.imul(x^(x>>>16),0x85EBCA6B);x=Math.imul(x^(x>>>13),0xC2B2AE35);return ((x^(x>>>16))>>>0)/4294967296;}
  weightedOption(opts,weights){let roll=this.choiceRoll()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<opts.length;i++){roll-=weights[i];if(roll<0)return opts[i].id;}return opts.at(-1).id;}
  resumeStory(){if(this.s.status!=='ended'||!['return','clear'].includes(this.s.outcome?.type))return false;this.finish(this.s.outcome.type,'지난 모험에서 이어집니다.');return true;}
}
