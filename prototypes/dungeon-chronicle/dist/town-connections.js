import { DUNGEON_EVENTS } from './dungeon-events.js';
import { initRelationships, person, personLabel, personIntro, relationLabel, applyRelationship, validRelationships, validSocialEffect, eligibleRelationshipGroups, personAvailable } from './relationships.js';
import { eligibleCompanionMemories } from './companions.js';
const result=(text,delta={},flags=[])=>({text,delta,flags});
const o=(id,label,hint,bias,effect,extra={})=>({id,label,hint,bias,...effect,...extra});
const pass=o('pass','지금 하는 일에 집중한다','새로운 약속 없이 생활 계속','safe',result('오랜 인연과 짧게 안부를 나누고 하던 일로 돌아갔습니다.'));
const groups=['miners','scouts','herbalist','caravan','families','records','debt'];
const nextGroup={miners_return:'miners',scout_reunion:'scouts',herbalist_return:'herbalist',goblin_caravan:'caravan',family_reply:'families',hidden_vault:'records',archive_test:'records',circuit_awake:'records',debt_collector:'debt',marked_hunters:'debt',clean_deal:'debt'};
const flagGroups={minersAlly:'miners',minersRescued:'miners',mineMapped:'miners',mineSealed:'miners',scoutsRemember:'scouts',rookiesTrained:'scouts',rookiesWarned:'scouts',herbalistAlly:'herbalist',caravanAlly:'caravan',familiesRemember:'families',vaultFound:'records',archiveOpened:'records',archiveShared:'records',circuitStable:'records',debtSettled:'debt',honestTrade:'debt',huntEnded:'debt',huntEscaped:'debt'};
const settled=(source,choice)=>source==='debt_collector'&&['pay','bargain'].includes(choice)||source==='clean_deal'||source==='marked_hunters'&&choice==='settle';
function baseBonds(){return {version:1,contacts:{},seen:[],lastWasBond:false,memories:[]};}
export function bondState(g){g.world.bonds??=baseBonds();return initRelationships(g);}
export function rememberRescuedGoblin(g,legacy=false){const b=bondState(g);b.contacts.caravan??={source:null,choice:null,status:'known',rescued:true};if(legacy){person(g,'caravan').meetings=Math.max(1,person(g,'caravan').meetings);return;}applyRelationship(g,{group:'caravan',key:'d:rescued-goblin',change:1,choice:'물약으로 고블린을 구조한다'});}
function remember(g,group,source=null,choice=null,status='known'){
  const b=bondState(g),old=b.contacts[group];
  b.contacts[group]={source:source||old?.source||null,choice:choice||old?.choice||null,status:group==='debt'?status:'known'};
}
export function rememberDungeonContact(g,effect){
  const group=nextGroup[effect.next]||flagGroups[effect.flag];if(!group)return;
  const step=effect.trail?.at(-1),source=step?.source||effect.origin,choice=step?.choice||null;
  const status=group==='debt'?(settled(source,choice)||effect.flag==='huntEnded'?'settled':effect.next==='debt_collector'||effect.next==='marked_hunters'||['fight','flee','skip'].includes(choice)?'open':bondState(g).contacts.debt?.status||'uncertain'):'known';
  remember(g,group,source,choice,status);
}
export function migrateBonds(g){
  if(g.world.bonds){bondState(g);return;}
  const b=bondState(g),stories=g.world.dungeonStories;
  // A pending promise or completed result proves an interaction; simply seeing it does not.
  for(const [flag,group] of Object.entries(flagGroups))if(stories?.flags?.[flag])remember(g,group,null,null,group==='debt'?'uncertain':'known');
  if(stories?.flags?.honestTrade||stories?.flags?.huntEnded)if(b.contacts.debt)b.contacts.debt.status='settled';
  for(const p of stories?.pending||[]){const group=nextGroup[p.id];if(group){const step=p.trail?.at(-1);remember(g,group,step?.source||p.origin,step?.choice||null,p.id==='clean_deal'?'settled':group==='debt'?'open':'known');}}
  if(g.s.flags.helped)rememberRescuedGoblin(g,true);
  for(const group of Object.keys(b.contacts))person(g,group).meetings=Math.max(1,person(g,group).meetings);
}
export const TOWN_CONNECTIONS={
  inn_miners:{career:'inn',group:'miners',title:'갱도에서 돌아온 단골들',prompt:'던전에서 도왔던 광부들이 여관 문을 두드립니다. 교대 때마다 머물 방을 정기적으로 빌리고 싶다고 합니다.',options:[
    o('rooms','광부들의 정기 숙소를 맡는다','금화 -10 · 이후 여관 수입 +2','smart',result('함께 갱도를 지나온 광부들이 여관의 단골이 됐습니다. 빈방을 교대 숙소로 정리했습니다.',{},['bondInnMiners']),{cost:10}),
    o('meal','돌아온 이들에게 식사를 차린다','금화 -4 · 평판 +6','kind',result('갱도의 먼지를 씻은 광부들과 같은 식탁에 앉았습니다.',{reputation:6}),{cost:4}),pass]},
  inn_scouts:{career:'inn',group:'scouts',title:'정찰병이 맡긴 여관의 등불',prompt:'전에 도왔던 정찰병들이 잠시 여관에 머뭅니다. 밤 순찰을 나눠 맡으며 여관 일을 돕겠다고 합니다.',options:[
    o('watch','밤 순찰을 함께 맡긴다','평판 +3 · 이후 여관 피로 증가 -2','kind',result('정찰병들과 밤 순찰을 나눴습니다. 던전에서 나눈 도움이 여관의 등불을 지키는 일로 이어졌습니다.',{reputation:3},['bondInnWatch'])),
    o('stories','신입 손님들에게 경험을 들려 달라고 한다','금화 +8 · 평판 +3','smart',result('정찰병의 이야기를 들으러 신입 모험가들이 여관에 모였습니다.',{gold:8,reputation:3})),pass]},
  inn_herbalist:{career:'inn',group:'herbalist',title:'약초꾼이 돌아온 방',prompt:'던전에서 인연을 맺은 약초꾼이 여관에서 묵고 싶다고 합니다. 부상한 손님을 돌볼 작은 자리를 함께 만들자고 제안합니다.',options:[
    o('clinic','빈방을 간호실로 내준다','금화 -12 · 이후 열병의 악화 위험 감소','kind',result('약초꾼과 여관의 작은 간호실을 열었습니다. 던전에서 시작한 인연이 마을의 치료로 이어졌습니다.',{},['bondClinic']),{cost:12}),
    o('medicine','약초 구별법을 배우고 숙박을 제공한다','탐색력 +1 · 평판 +4','smart',result('약초꾼에게 독초를 가리는 법을 배우고 조용한 방을 내줬습니다.',{scout:1,reputation:4})),pass]},
  inn_caravan:{career:'inn',group:'caravan',title:'표식을 기억한 상단의 예약',prompt:'고블린 상단이 예전에 남긴 안전 표식을 기억하고 여관을 찾아왔습니다. 던전 보급길에 이곳을 들르려 합니다.',options:[
    o('contract','보급길의 정기 숙박을 계약한다','금화 -8 · 이후 여관 수입 +2','smart',result('고블린 상단과 숙박 약속을 맺었습니다. 오래전 벽의 표식이 여관 장부의 단골 이름이 됐습니다.',{},['bondInnCaravan']),{cost:8}),
    o('share','상단과 손님들에게 길 소식을 나눈다','평판 +5 · 탐색력 +1','kind',result('상단이 가져온 길 소식을 손님들에게 나눴습니다.',{reputation:5,scout:1})),pass]},
  inn_families:{career:'inn',group:'families',title:'돌려준 이름들이 모인 식탁',prompt:'던전에서 남은 이름과 물건을 전해 받았던 가족들이 여관에 찾아왔습니다. 떠난 이들을 함께 기억할 식탁을 부탁합니다.',options:[
    o('table','가족들을 위한 작은 식사를 연다','금화 -8 · 평판 +8','kind',result('던전에서 돌려준 이름들을 여관의 식탁에서 다시 불렀습니다. 유족들은 서로의 이야기를 나눴습니다.',{reputation:8},['bondMemorialTable']),{cost:8}),
    o('letters','편지와 기록을 읽을 자리를 마련한다','평판 +4 · 피로 -6','smart',result('유족들이 조용히 편지를 읽을 자리를 마련했습니다. 오랫동안 전하지 못했던 안부가 닿았습니다.',{reputation:4,fatigue:-6})),pass]},
  inn_debt:{career:'inn',group:'debt',title:'검은 표식이 찾아온 여관',prompt:'던전에서 마주쳤던 검은 표식의 사람들이 여관 문 앞에 나타났습니다. 과거의 거래를 이번에는 마을에서 이야기하려 합니다.',options:[
    o('mediate','길드 중재인을 불러 분쟁을 정리한다','금화 -14 · 평판 +4 · 남은 추적 종결','smart',{...result('여관에서 길드 중재인과 값을 정리했습니다. 남아 있던 표식의 추적도 끝났습니다.',{reputation:4}),settleDebt:true},{cost:14}),
    o('refuse','마을 경비에게 분쟁을 맡긴다','평판 -2 · 여관 안의 충돌 방지','safe',result('경비에게 분쟁을 넘기고 손님들을 안으로 들였습니다. 옛 거래의 문제는 아직 남아 있습니다.',{reputation:-2})),pass]},
  guild_miners:{career:'guild',group:'miners',title:'광부들이 낸 안전 의뢰',prompt:'던전에서 도왔던 광부들이 길드에 직접 찾아왔습니다. 갱도의 위험과 교대 명단을 정리하는 일을 맡아 달라고 합니다.',options:[
    o('protocol','현장 경험을 안전 절차로 정리한다','금화 -10 · 평판 +6 · 이후 길드 피로 증가 -2','smart',result('광부들과 갱도 안전 절차를 만들었습니다. 함께 걸었던 길의 경험이 길드의 업무가 됐습니다.',{reputation:6},['bondGuildProtocol']),{cost:10}),
    o('map','현장 지도를 길드 기록으로 남긴다','탐색력 +2 · 평판 +3','smart',result('광부들과 현장 지도를 대조해 길드의 위험 구역 기록을 고쳤습니다.',{scout:2,reputation:3})),pass]},
  guild_scouts:{career:'guild',group:'scouts',title:'정찰대의 새 교육 담당자',prompt:'예전에 인연을 맺은 정찰대가 신입 교육을 함께 맡자고 합니다. 현장으로 돌아가지 않고도 경험을 전할 수 있습니다.',options:[
    o('mentor','정찰대와 신입 교육을 나눠 맡는다','금화 -8 · 평판 +5 · 이후 길드 피로 증가 -2','kind',result('정찰대와 신입 교육을 맡았습니다. 던전에서 맺은 인연이 다음 세대의 길잡이가 됐습니다.',{reputation:5},['bondGuildMentor']),{cost:8}),
    o('manual','퇴로와 구조 신호를 교재로 남긴다','탐색력 +2 · 평판 +4','smart',result('함께 살아 나온 길과 구조 신호를 신입 교재에 옮겼습니다.',{scout:2,reputation:4})),pass]},
  guild_herbalist:{career:'guild',group:'herbalist',title:'약초꾼이 맡긴 치료소 명단',prompt:'던전에서 만났던 약초꾼이 길드의 치료소 지원을 부탁합니다. 환자와 약품을 연결하는 손이 부족하다고 합니다.',options:[
    o('support','약품과 간호 인력을 연결한다','금화 -12 · 평판 +8 · 이후 열병 악화 위험 감소','kind',result('약초꾼과 길드의 간호 연락망을 만들었습니다. 현장에서 나눈 도움이 마을의 치료로 이어졌습니다.',{reputation:8},['bondClinic']),{cost:12}),
    o('desk','접수와 가족 연락을 돕는다','평판 +5 · 피로 +3','safe',result('약초꾼이 치료에 집중하도록 접수와 가족 연락을 맡았습니다.',{reputation:5,fatigue:3})),pass]},
  guild_caravan:{career:'guild',group:'caravan',title:'상단과 길드 사이의 약속',prompt:'안전 표식으로 인연을 맺은 고블린 상단이 길드의 보급 계약을 신청했습니다. 신뢰할 연락 담당자가 필요하다고 합니다.',options:[
    o('supply','보급량과 대금을 함께 조정한다','금화 +10 · 평판 +4 · 이후 길드 수입 +1','smart',result('상단과 길드 사이의 보급 계약을 정리했습니다. 벽에 남겼던 표식이 정식 연락망으로 이어졌습니다.',{gold:10,reputation:4},['bondGuildSupply'])),
    o('open','소규모 상단도 쓸 수 있는 계약서를 만든다','평판 +7 · 피로 +4','kind',result('고블린 상단과 작은 상인들도 참여할 수 있는 계약서를 만들었습니다.',{reputation:7,fatigue:4})),pass]},
  guild_records:{career:'guild',group:'records',title:'던전의 기록을 찾는 조사단',prompt:'당신이 던전에서 남긴 암호와 기록의 소식을 듣고 길드 조사단이 찾아왔습니다. 탐험 대신 기록 검증을 맡아 달라고 합니다.',options:[
    o('share','단서를 검증해 길드 자료로 남긴다','탐색력 +2 · 평판 +5','smart',result('던전에서 간직한 단서를 조사단과 검증했습니다. 개인의 탐험 기록이 다음 원정의 자료가 됐습니다.',{scout:2,reputation:5},['bondGuildRecords'])),
    o('sell','확인한 단서를 개인 의뢰로 거래한다','금화 +24 · 평판 -5','greed',result('확인한 단서를 개인 의뢰에 넘겼습니다. 조사단에는 일부 정보만 남았습니다.',{gold:24,reputation:-5})),pass]},
  guild_debt:{career:'guild',group:'debt',title:'익숙한 표식의 분쟁 서류',prompt:'접수된 분쟁 서류에 던전에서 보았던 검은 표식이 찍혀 있습니다. 당사자들이 당신을 알아보고 중재를 부탁합니다.',options:[
    o('settle','자신의 거래부터 공개하고 조정한다','금화 -10 · 평판 +6 · 남은 추적 종결','smart',{...result('자신의 거래 기록부터 공개하고 중재를 마쳤습니다. 오래 남았던 표식의 추적도 정리됐습니다.',{reputation:6}),settleDebt:true},{cost:10}),
    o('transfer','다른 담당자에게 이해관계를 밝히고 넘긴다','평판 +3 · 분쟁은 다른 담당자가 맡음','safe',result('과거의 이해관계를 밝히고 다른 담당자에게 사건을 넘겼습니다. 혼자 판단하지 않기로 했습니다.',{reputation:3})),pass]},
  trader_miners:{career:'trader',group:'miners',title:'갱도에서 이어진 광석 거래',prompt:'던전에서 도왔던 광부들이 상점에 광석 견본을 가져왔습니다. 채굴한 광석과 탐험용 물자를 정기적으로 거래하자고 합니다.',options:[
    o('contract','광석과 보급품의 정기 거래를 연다','금화 -12 · 이후 상점 수입 +2','smart',result('광부들과 광석 납품 장부를 열었습니다. 갱도에서 시작된 인연이 상점의 거래처가 됐습니다.',{},['bondTraderOre']),{cost:12}),
    o('broker','이번 물량만 공정한 값에 중개한다','금화 +14 · 평판 +2','safe',result('광부들의 이번 광석을 중개하고 약속한 대금을 나눴습니다.',{gold:14,reputation:2})),pass]},
  trader_scouts:{career:'trader',group:'scouts',title:'정찰대의 보급 명세서',prompt:'던전에서 만났던 정찰대가 상점에 보급 주문서를 냈습니다. 긴 퇴로에서도 짐이 모자라지 않게 꾸려 달라고 합니다.',options:[
    o('supply','경로별 보급 꾸러미를 표준화한다','금화 -8 · 평판 +3 · 이후 상점 피로 증가 -2','smart',result('정찰대의 이동 경로에 맞춰 보급 꾸러미를 정리했습니다. 해마다 주문을 준비하는 부담이 줄었습니다.',{reputation:3},['bondTraderPacking']),{cost:8}),
    o('small','이번 원정의 소량 주문을 맡는다','금화 +10 · 평판 +3','safe',result('정찰대의 이번 원정에 필요한 물품을 제때 납품했습니다.',{gold:10,reputation:3})),pass]},
  trader_herbalist:{career:'trader',group:'herbalist',title:'약초꾼의 작은 거래 선반',prompt:'던전에서 인연을 맺은 약초꾼이 말린 약초를 가져왔습니다. 믿고 맡길 판매처가 필요하다고 합니다.',options:[
    o('shelf','약초를 검수하는 위탁 선반을 연다','금화 -10 · 평판 +3 · 이후 상점 수입 +1','smart',result('약초꾼과 검수한 약초만 놓는 위탁 선반을 열었습니다. 던전의 인연이 믿을 만한 거래처가 됐습니다.',{reputation:3},['bondTraderHerbs']),{cost:10}),
    o('medicine','개인 몫의 예비 물약을 산다','금화 -6 · 물약 +1','safe',result('약초꾼에게 예비 물약 한 병을 사 두었습니다.',{potions:1}),{cost:6}),pass]},
  trader_caravan:{career:'trader',group:'caravan',title:'안전 표식이 이어 준 거래처',prompt:'던전에서 안전 표식으로 인연을 맺은 고블린 상단이 상점을 찾았습니다. 함께 원정 물자를 들여올 거래처를 구한다고 합니다.',options:[
    o('joint','상단과 원정 물자를 공동 매입한다','금화 -14 · 이후 상점 수입 +2','smart',result('고블린 상단과 공동 매입 장부를 만들었습니다. 벽에 남겼던 표식이 상점의 거래처 이름으로 이어졌습니다.',{},['bondTraderCaravan']),{cost:14}),
    o('trade','이번 짐을 정가로 거래한다','금화 +14 · 평판 +4','kind',result('상단의 이번 짐을 약속한 값으로 거래했습니다. 서로의 이름을 영수증에 남겼습니다.',{gold:14,reputation:4})),pass]},
  trader_families:{career:'trader',group:'families',title:'기록 속 가족의 작은 부탁',prompt:'던전의 기록으로 인연이 닿은 가족들이 상점을 찾아왔습니다. 남은 물품의 주인을 확인하고 필요한 사람에게 전해 달라고 합니다.',options:[
    o('return','주인을 확인하며 물품을 돌려준다','금화 -6 · 평판 +7','kind',result('가족들과 물품의 이름표를 확인해 돌려줬습니다. 던전의 기록이 상점에서 주인을 찾았습니다.',{reputation:7}),{cost:6}),
    o('consign','가족의 동의를 받고 위탁 판매한다','금화 +8 · 평판 +2','smart',result('가족이 맡긴 물품만 위탁 판매하고 정산서를 돌려줬습니다.',{gold:8,reputation:2})),pass]},
  trader_records:{career:'trader',group:'records',title:'단서의 출처를 묻는 감정인',prompt:'던전에서 남긴 기록의 소식을 듣고 감정인이 찾아왔습니다. 출처가 분명한 유물만 거래할 목록을 함께 만들자고 합니다.',options:[
    o('catalog','발견 장소를 확인하는 거래 목록을 만든다','금화 -8 · 탐색력 +1 · 평판 +4 · 이후 상점 수입 +1','smart',result('감정인과 발견 장소와 거래 이력을 확인하는 목록을 만들었습니다. 던전의 기록이 상점의 감정 기준이 됐습니다.',{scout:1,reputation:4},['bondTraderCatalog']),{cost:8}),
    o('appraise','이번 유물만 공동 감정한다','금화 +12 · 탐색력 +1','safe',result('감정인과 이번 유물의 단서를 대조하고 감정료를 받았습니다.',{gold:12,scout:1})),pass]},
  trader_debt:{career:'trader',group:'debt',title:'검은 표식이 찍힌 매입 장부',prompt:'던전에서 얽혔던 검은 표식의 당사자들이 상점으로 찾아왔습니다. 남은 소유권 분쟁부터 정리하고 거래하자고 합니다.',options:[
    o('settle','남은 값을 중재하고 거래를 정리한다','금화 -12 · 평판 +4 · 남은 추적 종결','smart',{...result('상점 장부를 열어 남은 값을 중재했습니다. 던전의 표식 추적도 끝났습니다.',{reputation:4}),settleDebt:true},{cost:12}),
    o('hold','소유권 확인 전까지 매입을 보류한다','평판 +2 · 남은 추적은 유지','safe',result('문제의 물건을 매입하지 않고 길드에 소유권 확인을 요청했습니다. 예전 분쟁은 아직 남아 있습니다.',{reputation:2})),pass]},
  smith_miners:{career:'smith',group:'miners',title:'광부들이 맡긴 도구 주문',prompt:'던전에서 도왔던 광부들이 공방에 닳은 곡괭이와 수레 부품을 가져왔습니다. 작업에 맞는 도구를 꾸준히 만들어 달라고 합니다.',options:[
    o('order','광부들의 규격 도구 주문을 맡는다','금화 -12 · 이후 공방 수입 +2','smart',result('광부들의 손과 작업에 맞춰 도구 규격을 만들었습니다. 함께 지나온 갱도가 공방의 제작 의뢰로 이어졌습니다.',{},['bondSmithTools']),{cost:12}),
    o('repair','이번 도구와 수레 부품을 수리한다','금화 +14 · 평판 +3','safe',result('광부들이 가져온 도구와 수레 부품을 수리하고 품삯을 받았습니다.',{gold:14,reputation:3})),pass]},
  smith_scouts:{career:'smith',group:'scouts',title:'정찰병의 가벼운 장비 의뢰',prompt:'던전에서 만났던 정찰병들이 공방에서 배낭과 방패를 펼칩니다. 오래 걸어도 지치지 않을 장비를 함께 고쳐 달라고 합니다.',options:[
    o('light','정찰대와 경량 장비의 틀을 만든다','금화 -8 · 평판 +3 · 이후 공방 피로 증가 -2','smart',result('정찰대와 경량 장비의 틀을 만들었습니다. 현장의 경험 덕분에 반복 제작의 손길도 가벼워졌습니다.',{reputation:3},['bondSmithPatterns']),{cost:8}),
    o('repair','이번 원정의 장비만 손질한다','금화 +12 · 평판 +3','safe',result('정찰병들의 이번 원정 장비를 손질하고 익숙한 퇴로 이야기를 나눴습니다.',{gold:12,reputation:3})),pass]},
  smith_herbalist:{career:'smith',group:'herbalist',title:'약초꾼이 그려 온 도구',prompt:'던전에서 인연을 맺은 약초꾼이 공방에 스케치를 가져왔습니다. 약초 보관함과 부상자를 위한 보조 도구가 필요하다고 합니다.',options:[
    o('tools','약초 보관함과 보조 도구를 제작한다','금화 -10 · 평판 +4 · 이후 공방 수입 +1','kind',result('약초꾼과 보관함과 보조 도구를 만들었습니다. 환자마다 맞춰 고치는 일이 공방의 정기 의뢰가 됐습니다.',{reputation:4},['bondSmithHerbs']),{cost:10}),
    o('study','휴대 도구를 함께 시험한다','탐색력 +1 · 평판 +5','smart',result('약초꾼과 채집 도구를 시험하며 손질법을 배웠습니다.',{scout:1,reputation:5})),pass]},
  smith_caravan:{career:'smith',group:'caravan',title:'상단의 닳은 짐틀',prompt:'안전 표식으로 인연을 맺은 고블린 상단이 공방에 짐틀을 맡겼습니다. 던전 보급길을 견딜 틀과 잠금쇠를 주문합니다.',options:[
    o('frames','상단의 짐틀과 잠금쇠를 정기 제작한다','금화 -12 · 이후 공방 수입 +2','smart',result('고블린 상단의 짐틀과 잠금쇠를 정기 제작하기로 했습니다. 벽에 남겼던 표식이 공방의 주문서로 이어졌습니다.',{},['bondSmithCaravan']),{cost:12}),
    o('repair','이번 짐틀을 보강한다','금화 +16 · 평판 +2','safe',result('상단의 짐틀에서 닳은 이음새를 고치고 품삯을 받았습니다.',{gold:16,reputation:2})),pass]},
  smith_families:{career:'smith',group:'families',title:'돌려준 이름을 새기는 공방',prompt:'던전의 기록으로 인연이 닿은 가족들이 공방에 찾아왔습니다. 남은 사람들에게 전할 작은 기념패를 부탁합니다.',options:[
    o('engrave','가족이 고른 이름을 기념패에 새긴다','금화 -8 · 평판 +8','kind',result('가족들이 고른 이름을 작은 기념패에 새겼습니다. 던전의 기록이 누군가의 손에 남았습니다.',{reputation:8}),{cost:8}),
    o('restore','가족이 맡긴 물건을 수선한다','금화 +8 · 평판 +4','safe',result('가족이 맡긴 물건의 부서진 고리를 수선했습니다. 손때는 그대로 남겼습니다.',{gold:8,reputation:4})),pass]},
  smith_records:{career:'smith',group:'records',title:'던전의 단서를 가져온 조사단',prompt:'던전에서 남긴 기술 기록의 소식을 듣고 조사단이 공방을 찾았습니다. 위험한 유물 대신 안전한 모형을 만들어 달라고 합니다.',options:[
    o('model','기록을 검증하며 작동 모형을 만든다','금화 -10 · 전투력 +1 · 탐색력 +1','smart',result('조사단과 기록을 검증해 안전한 작동 모형을 만들었습니다. 힘의 흐름을 이해하며 장비 손질법도 익혔습니다.',{power:1,scout:1}),{cost:10}),
    o('copy','복원 도면을 조사단에 남긴다','탐색력 +2 · 평판 +4','kind',result('조사단과 맞춰 본 단서를 복원 도면으로 남겼습니다. 던전에서 적은 기록이 공방에서 새 형태를 얻었습니다.',{scout:2,reputation:4})),pass]},
  smith_debt:{career:'smith',group:'debt',title:'표식이 남은 수리 의뢰',prompt:'던전의 검은 표식에 얽혔던 당사자들이 공방에 도구를 가져왔습니다. 수리를 맡기기 전에 남은 소유권 분쟁을 정리하자고 합니다.',options:[
    o('settle','중재인을 불러 남은 값을 정리한다','금화 -12 · 평판 +5 · 남은 추적 종결','smart',{...result('공방에서 소유권과 남은 값을 확인했습니다. 수리보다 먼저 옛 표식의 추적을 끝냈습니다.',{reputation:5}),settleDebt:true},{cost:12}),
    o('hold','소유권이 확인될 때까지 수리를 보류한다','평판 +2 · 남은 추적은 유지','safe',result('소유권 서류를 확인할 때까지 도구를 수리하지 않았습니다. 예전 분쟁은 아직 남아 있습니다.',{reputation:2})),pass]}
};
export const TOWN_CONNECTION_IDS=Object.freeze(Object.keys(TOWN_CONNECTIONS));
function tradeVariant(e,contact){
  if(!['trader','smith'].includes(e.career))return e;
  const change=(id,patch,prompt)=>({...e,prompt,options:e.options.map(o=>o.id===id?{...o,...patch}:o)}),{source,choice}=contact||{};
  if(e.group==='miners'&&source==='miners_return'&&choice==='map')return e.career==='trader'
    ?change('contract',{label:'갱도 지도에 맞춰 보급품을 정기 납품한다',hint:'금화 -12 · 탐색력 +1 · 이후 상점 수입 +2',delta:{scout:1},text:'광부들과 함께 읽었던 갱도 지도를 납품 장부 옆에 펼쳤습니다. 길에 맞춘 보급품이 정기 거래로 이어졌습니다.'},'전에 지도를 나눴던 광부들이 상점을 찾았습니다. 함께 읽은 갱도 경로에 맞춰 보급품을 꾸려 달라고 합니다.')
    :change('order',{label:'지도에 맞춘 안전 도구를 정기 제작한다',hint:'금화 -12 · 탐색력 +1 · 이후 공방 수입 +2',delta:{scout:1},text:'함께 읽었던 갱도 지도를 바탕으로 안전 도구를 제작했습니다. 지도 속 위험이 공방의 도구 규격에 반영됐습니다.'},'전에 갱도 지도를 나눴던 광부들이 공방을 찾았습니다. 지도에 표시한 위험에 맞는 안전 도구를 부탁합니다.');
  if(e.group==='scouts'&&source==='scout_reunion'&&choice==='bandage')return e.career==='trader'
    ?change('supply',{label:'붕대와 구호 꾸러미를 정기 납품한다',hint:'금화 -8 · 평판 +6 · 이후 상점 피로 증가 -2',delta:{reputation:6},text:'정찰대와 나눴던 붕대를 떠올리며 구호 꾸러미를 정리했습니다. 정기 주문과 함께 구조 물자를 찾는 이들의 신뢰도 쌓였습니다.'},'던전에서 붕대와 식량을 나눴던 정찰병들이 상점을 찾았습니다. 이번에는 후배들을 위한 구호 물자를 부탁합니다.')
    :change('light',{label:'구조용 들것과 배낭의 틀을 만든다',hint:'금화 -8 · 평판 +6 · 이후 공방 피로 증가 -2',delta:{reputation:6},text:'붕대를 나눴던 정찰대와 구조용 들것과 배낭의 틀을 만들었습니다. 부상자를 옮기는 현장의 경험이 반복 제작에 쓰였습니다.'},'던전에서 붕대와 식량을 나눴던 정찰대가 공방을 찾았습니다. 부상자를 옮길 가벼운 들것과 배낭을 부탁합니다.');
  if(e.group==='herbalist'&&source==='herbalist_return'&&choice==='learn')return e.career==='trader'
    ?change('medicine',{label:'함께 배운 약초로 예비 물약을 마련한다',hint:'금화 -6 · 물약 +2',delta:{potions:2},text:'배웠던 약초 구별법으로 검수를 도왔습니다. 약초꾼은 같은 값에 예비 물약 두 병을 마련해 줬습니다.'},'약초 구별법을 가르쳐 줬던 약초꾼이 상점을 찾았습니다. 함께 검수하면 개인 몫의 물약을 더 마련해 주겠다고 합니다.')
    :change('study',{label:'약초에 맞는 채집 도구를 함께 시험한다',hint:'탐색력 +2 · 평판 +5',delta:{scout:2,reputation:5},text:'배웠던 약초 구별법을 떠올리며 채집 도구를 시험했습니다. 잎과 뿌리를 해치지 않는 손질법을 함께 익혔습니다.'},'약초 구별법을 가르쳐 줬던 약초꾼이 공방을 찾았습니다. 함께 알아본 약초에 맞는 채집 도구를 부탁합니다.');
  if(e.group==='families'&&source==='family_reply'&&choice==='donate')return e.career==='trader'
    ?change('return',{label:'가족들과 신입용 보급품을 마련한다',hint:'금화 -6 · 평판 +7',text:'가족들의 꾸러미를 신입들에게 나눴던 일을 상점에서 이어 갔습니다. 함께 마련한 보급품에 안전한 귀환을 바라는 쪽지를 넣었습니다.'},'전에 가족들의 꾸러미를 신입에게 나눴던 소식을 듣고 가족들이 상점에 찾아왔습니다. 이번에도 신입 모험가의 보급품을 함께 마련하자고 합니다.')
    :change('engrave',{label:'가족들과 신입용 장비를 마련한다',hint:'금화 -8 · 평판 +8',text:'신입에게 꾸러미를 나눴던 가족들과 튼튼한 장비를 만들었습니다. 장비 안쪽에 무사히 돌아오라는 짧은 말을 새겼습니다.'},'전에 꾸러미를 신입에게 나눴던 일을 기억한 가족들이 공방을 찾았습니다. 이번에는 신입용 장비를 함께 만들자고 합니다.');
  if(e.group==='records'&&source==='circuit_awake'&&choice==='learn')return e.career==='trader'
    ?change('catalog',{label:'배웠던 회로를 유물 감정 기준에 더한다',hint:'금화 -8 · 탐색력 +2 · 평판 +4 · 이후 상점 수입 +1',delta:{scout:2,reputation:4},text:'던전에서 연구한 회로를 감정인과 대조했습니다. 유물의 작동 흔적까지 확인하는 목록이 상점의 거래 기준이 됐습니다.'},'던전에서 연구했던 마력 회로의 소식을 듣고 감정인이 찾아왔습니다. 회로가 남은 유물의 거래 기준을 함께 세우자고 합니다.')
    :change('model',{label:'연구했던 회로를 안전한 모형으로 옮긴다',hint:'금화 -10 · 전투력 +1 · 탐색력 +2',delta:{power:1,scout:2},text:'던전에서 연구했던 회로를 조사단과 모형으로 옮겼습니다. 알고 있던 파장을 다시 검증하며 장비 손질법을 다듬었습니다.'},'던전에서 연구했던 마력 회로를 기억한 조사단이 공방을 찾았습니다. 그 파장을 안전한 모형으로 재현해 달라고 합니다.');
  return e;
}
function definition(g,id,status,snapshot){
  const e=TOWN_CONNECTIONS[id];
  const contact=snapshot||bondState(g).contacts[e?.group];
  if(e?.group==='caravan'&&contact?.rescued){
    const reunion={inn:['물약을 기억한 고블린의 예약','던전에서 물약을 건네 살렸던 고블린이 돌아왔습니다. 이제 상단에서 일하며 동료들이 묵을 여관을 찾고 있다고 합니다.'],guild:['살아 돌아온 고블린의 보급 계약','던전에서 물약을 건네 살렸던 고블린이 보급 상단의 담당자가 되어 길드에 찾아왔습니다. 함께 정식 보급 계약을 맺고 싶다고 합니다.'],trader:['살아 돌아온 고블린의 거래 제안','던전에서 물약을 건네 살렸던 고블린이 상점을 찾았습니다. 이제 상단의 매입 담당자가 되어 함께 원정 물자를 거래하고 싶다고 합니다.'],smith:['살아 돌아온 고블린의 제작 주문','던전에서 물약을 건네 살렸던 고블린이 상단의 짐틀을 들고 공방을 찾았습니다. 목숨을 건졌던 보급길을 위해 튼튼한 짐틀을 부탁합니다.']}[e.career];
    return {...e,title:reunion[0],prompt:reunion[1],options:e.options.map(o=>({...o,text:o.text.replace('오래전 벽의 표식이','어둠 속에서 건넨 물약이').replace('벽에 남겼던 표식이','던전에서 살린 고블린의 인연이')}))};
  }
  if(e?.group==='debt'&&['trader','smith'].includes(e.career)&&(status??contact?.status)!=='open')return {...e,title:e.career==='trader'?'옛 표식의 새로운 거래':'옛 표식의 정식 수리 의뢰',prompt:((status??contact?.status)==='settled'?'던전의 표식 분쟁은 이미 해결됐습니다. ':'옛 표식의 당사자들이 찾아왔습니다. ')+(e.career==='trader'?'이번에는 소유권을 확인한 물건의 정식 거래를 제안합니다.':'이번에는 소유권 서류를 갖춘 도구의 정식 수리를 부탁합니다.'),options:[
    o('welcome',e.career==='trader'?'확인된 물건을 정식 거래한다':'정식 의뢰로 도구를 수리한다','금화 +14 · 평판 +3','kind',result(e.career==='trader'?'옛 값을 다시 요구하지 않고 정식 거래를 마쳤습니다. 서로 확인한 물건만 장부에 올렸습니다.':'옛 값을 다시 요구하지 않고 정식 수리 의뢰를 마쳤습니다. 확인한 소유자의 이름을 주문서에 남겼습니다.',{gold:14,reputation:3})),
    o('ledger',e.career==='trader'?'소유권 확인 절차를 함께 정리한다':'도구의 소유 이력과 수리 도면을 남긴다','탐색력 +1 · 평판 +3','smart',result('옛 표식의 당사자들과 이번 의뢰의 확인 절차를 기록했습니다. 지난 값은 다시 청구하지 않았습니다.',{scout:1,reputation:3})),pass]};
  if(e?.group==='debt'&&(status??contact?.status)!=='open')return {...e,title:e.career==='inn'?'옛 표식의 정식 손님':'옛 표식의 새 의뢰',prompt:(status??contact?.status)==='settled'?'던전에서 있었던 표식 분쟁은 이미 해결됐습니다. 그때의 당사자들이 이번에는 정식 숙박과 거래 절차를 문의합니다.':'옛 표식의 거래 당사자들이 숙박과 의뢰를 문의합니다. 이번 거래부터 서로의 이름을 장부에 남기자고 합니다.',options:[
    o('welcome','정식 손님과 의뢰인으로 맞는다','금화 +8 · 평판 +3','kind',result('과거의 값을 다시 요구하지 않고 정식 손님과 의뢰인으로 맞았습니다.',{gold:8,reputation:3})),
    o('ledger','정리된 거래를 장부에 남긴다','탐색력 +1 · 평판 +2','smart',result('해결된 거래 기록을 남겼습니다. 같은 분쟁이 되풀이되지 않도록 서로 확인했습니다.',{scout:1,reputation:2})),pass]};
  return tradeVariant(e,contact);
}
export function connectionOptions(g,id){return definition(g,id).options.map(o=>({...o,disabled:(o.cost||0)>g.s.gold}));}
export function eligibleConnections(g){const b=bondState(g);return TOWN_CONNECTION_IDS.filter(id=>{const e=TOWN_CONNECTIONS[id],c=b.contacts[e.group];return e.career===g.world.career&&c&&personAvailable(b.people[e.group])&&!c.unfriendly&&(e.group==='debt'||(b.people[e.group]?.score??0)>-2)&&!b.seen.includes(id);});}
export function drawTownConnection(g){const b=bondState(g),eligible=eligibleConnections(g);if(b.lastWasBond){b.lastWasBond=false;return null;}const memories=eligibleCompanionMemories(g);if(memories.length)return `memory:${g.pick(memories)}`;if(eligible.length)return g.pick(eligible);const later=eligibleRelationshipGroups(g);return later.length?`relation:${g.pick(later)}`:null;}
export function openTownConnection(g,id){
  if(g.world.mode!=='life'||g.s.status!=='running'||!eligibleConnections(g).includes(id))return false;
  const b=bondState(g),e=definition(g,id),contact=b.contacts[e.group],source=DUNGEON_EVENTS[contact.source],choice=source?.options.find(o=>o.id===contact.choice);
  const origin=source?`‘${source.title}’${choice?`에서 ‘${choice.label}’를 택했던 인연`:'에서 이어진 인연'}입니다. `:'던전에서 맺었던 인연이 생활로 이어집니다. ';
  b.seen.push(id);b.lastWasBond=true;
  const p=person(g,e.group);
  g.setMenu('bond-event',personIntro(g,e.group)+origin+e.prompt,connectionOptions(g,id).map(({id,label,hint,bias,disabled})=>({id,label,hint,bias,disabled})),{source:id,title:e.title,bondGroup:e.group,bondStatus:contact.status,bondContact:structuredClone(contact),personName:personLabel(g,e.group),relation:relationLabel(p.score),meetings:p.meetings+1});return true;
}
export function chooseTownConnection(g,id){
  const ch=g.s.choice;if(ch?.kind!=='bond-event'||!ch.options.some(o=>o.id===id))return false;
  // The displayed variant is fixed even if another queued result changes a contact later.
  const options=definition(g,ch.source,ch.bondStatus,ch.bondContact).options;
  const o=options.find(o=>o.id===id);if(!o||(o.cost||0)>g.s.gold)return false;
  g.s.status='running';g.s.choice=null;g.s.choicesMade++;g.emit(`선택: ${o.label}.`,'choice');g.s.gold-=o.cost||0;
  const labels={gold:'금화',reputation:'평판',fatigue:'피로',scout:'탐색력',power:'전투력',potions:'물약'},changes=Object.entries(o.delta).filter(([,v])=>v).map(([k,v])=>`${labels[k]||k} ${v>0?'+':''}${v}`);
  const text=[`${ch.personName||personLabel(g,ch.bondGroup)} — ${o.text}`,...(o.cost?[`금화 -${o.cost}`]:[]),...changes].join(' · ');
  const harmful=Object.values(o.delta).some(v=>v<0)&&!Object.values(o.delta).some(v=>v>0);
  const change=id==='pass'?0:o.settleDebt?2:(o.delta.reputation||0)<0?-2:1;
  g.enqueue(text,harmful?'bad':id==='pass'?'note':'good',o.delta,{bondEffect:{flags:o.flags,settleDebt:!!o.settleDebt,memory:id==='pass'?null:`${ch.personName||personLabel(g,ch.bondGroup)} — ${o.text}`,social:{group:ch.bondGroup,key:`t:${ch.source}`,change,choice:o.label,town:true}}});return true;
}
export function commitTownConnection(g,effect){
  const b=bondState(g);for(const flag of effect.flags||[])g.world.flags[flag]=true;
  applyRelationship(g,effect.social);
  if(effect.settleDebt){if(b.contacts.debt)b.contacts.debt.status='settled';const stories=g.world.dungeonStories;if(stories)stories.pending=stories.pending.filter(p=>!['debt_collector','marked_hunters'].includes(p.id));}
  if(effect.memory&&!b.memories.includes(effect.memory)){b.memories.push(effect.memory);b.memories=b.memories.slice(-4);}
}
export function validBonds(b){return b?.version===1&&b.contacts&&typeof b.contacts==='object'&&!Array.isArray(b.contacts)&&Object.entries(b.contacts).every(([key,c])=>groups.includes(key)&&c&&(!c.source||DUNGEON_EVENTS[c.source])&&(!c.choice||DUNGEON_EVENTS[c.source]?.options.some(o=>o.id===c.choice))&&['known','open','settled','uncertain'].includes(c.status)&&(c.rescued===undefined||typeof c.rescued==='boolean')&&(c.unfriendly===undefined||typeof c.unfriendly==='boolean'))&&Array.isArray(b.seen)&&new Set(b.seen).size===b.seen.length&&b.seen.every(id=>TOWN_CONNECTION_IDS.includes(id))&&typeof b.lastWasBond==='boolean'&&Array.isArray(b.memories)&&b.memories.length<=4&&b.memories.every(t=>typeof t==='string'&&t.length<1000)&&validRelationships(b);}
const effectFlags=new Set(Object.values(TOWN_CONNECTIONS).flatMap(e=>e.options.flatMap(o=>o.flags)));
export function validBondEffect(e){return e&&Array.isArray(e.flags)&&e.flags.every(f=>effectFlags.has(f))&&typeof e.settleDebt==='boolean'&&(e.memory===null||typeof e.memory==='string'&&e.memory.length<1000)&&(e.social===undefined||validSocialEffect(e.social));}
