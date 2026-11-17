import { dungeonPersonGroup, dungeonHasPerson, personIntro, personLabel, person, relationLabel, dungeonRelationshipTerms, personAvailable } from './relationships.js';
import { planCompanions } from './companions.js';
// Conditional stories share the existing landmark slots, never an extra per-room roll.
const o=(id,label,hint,bias,result,extra={})=>({id,label,hint,bias,...extra,...result});
const r=(text,delta={},extra={})=>({text,delta,...extra});
const skip=o('skip','흔적을 남기지 않고 지나간다','자원을 아끼고 탐험 계속','safe',r('눈앞의 일을 뒤로하고 탐험을 이어갔습니다.'));
const risk=(p,skill,success,failure)=>({p,skill,success,failure});
export const DUNGEON_EVENTS={
  human_register:{race:'human',title:'돌아오지 못한 원정대',prompt:'회랑의 명패에서 마을 출신 원정대의 이름을 알아봤습니다. 옆에 젖은 수첩이 놓여 있습니다.',options:[
    o('record','이름과 마지막 행로를 정리한다','탐색력 +1 · 다음 원정에서 유족의 소식','kind',r('같은 마을 사람들의 이름을 수첩에 옮겼습니다. 귀환하면 유족에게 전하기로 했습니다.',{scout:1},{next:'family_reply'})),
    o('search','남겨진 보급품을 찾는다','금화 +14 · 기록은 남기지 않음','greed',r('원정대의 보급품에서 쓸 수 있는 은화를 챙겼습니다.',{gold:14})),skip]},
  elf_roots:{race:'elf',title:'지하에서 자라는 숲',prompt:'돌바닥 아래의 뿌리가 엘프의 발소리에 반응합니다. 말라가는 샘과 봉인된 뿌리가 보입니다.',options:[
    o('water','물약을 희석해 뿌리를 살린다','물약 -1 · 다음 방문에 숲의 변화','kind',r('물약을 나눠 뿌리에 부었습니다. 말라 있던 잎에 작은 빛이 돌아왔습니다.',{},{next:'root_spring',sameDungeon:true}),{potionCost:1}),
    o('listen','뿌리가 전하는 길을 듣는다','탐색력 +2 · 체력 -5','smart',r('뿌리의 기억에서 길을 읽었지만 차가운 기운이 몸에 남았습니다.',{scout:2,hp:-5})),skip]},
  dwarf_lift:{race:'dwarf',title:'끊어진 갱도 승강기',prompt:'광부들이 쓰던 승강기의 톱니가 부서져 있습니다. 드워프의 눈에는 수리할 자리가 보입니다.',options:[
    o('repair','부품을 써서 톱니를 고친다','금화 -8 · 다음 방문에 광부들의 도움','smart',r('빠진 톱니를 깎아 끼웠습니다. 끊겼던 갱도에 다시 수레가 다니기 시작했습니다.',{},{next:'miners_return',sameDungeon:true}),{cost:8}),
    o('salvage','남은 금속을 떼어낸다','금화 +16 · 승강기는 복구되지 않음','greed',r('남은 금속을 챙겼습니다. 승강기는 다시 움직이지 않았습니다.',{gold:16})),skip]},
  goblin_marks:{race:'goblin',title:'고블린의 벽 낙서',prompt:'다른 모험가들은 지나쳤지만, 벽의 낙서는 고블린 상단의 약속 장소를 가리킵니다.',options:[
    o('answer','안전한 길을 답장으로 남긴다','평판 +2 · 다음 원정에서 상단과 재회','kind',r('낙서 아래에 안전한 길과 자신의 표식을 남겼습니다.',{reputation:2},{next:'goblin_caravan'})),
    o('stash','낙서를 따라 은닉처를 찾는다','성공 시 금화 +22 · 실패 시 체력 -12','greed',risk(.55,'scout',r('낙서가 가리킨 은닉처에서 금화를 찾았습니다.',{gold:22}),r('상단이 남긴 경보 장치에 다쳤습니다.',{hp:-12}))),skip]},
  undead_name:{race:'undead',title:'이름을 잊은 망자',prompt:'살아 있는 이에게는 들리지 않는 목소리가 무너진 비석 안에서 이름을 찾아 달라고 합니다.',options:[
    o('restore','비석 조각을 맞춰 이름을 돌려준다','체력 -6 · 다음 방문에 망자의 길잡이','kind',r('비석의 이름을 맞췄습니다. 망자가 다음에 이 길을 찾아오면 돕겠다고 속삭였습니다.',{hp:-6},{next:'dead_guide',sameDungeon:true})),
    o('bind','기억을 자신의 힘으로 묶는다','전투력 +2 · 체력 -12','bold',r('이름 없는 기억을 붙잡았습니다. 힘은 남았지만 육신에 균열이 생겼습니다.',{power:2,hp:-12})),skip]},
  warrior_banner:{job:'warrior',title:'진형이 무너진 전초',prompt:'부서진 방패 뒤에 정찰대가 고립돼 있습니다. 전사의 신호를 알아보고 길을 열어 달라고 합니다.',options:[
    o('lead','방패를 들고 퇴로를 연다','성공 시 인연 · 실패 시 체력 -20','bold',risk(.5,'power',r('방패로 공격을 받아내며 정찰대를 밖으로 이끌었습니다.',{hp:-6,reputation:3},{next:'scout_reunion'}),r('퇴로를 열지 못하고 거센 공격에 밀려났습니다.',{hp:-20}))),
    o('signal','진형 신호로 우회로를 알린다','탐색력 +1 · 다음 원정에 정찰대 재회','smart',r('먼 거리에서 신호를 보내 정찰대를 우회시켰습니다.',{scout:1},{next:'scout_reunion'})),skip]},
  rogue_cipher:{job:'rogue',title:'도둑 길드의 암호',prompt:'잠금장치 옆의 작은 칼자국은 도적들만 읽는 암호입니다. 봉인 보관함의 열쇠가 숨겨져 있습니다.',options:[
    o('decode','암호를 풀어 열쇠를 챙긴다','다음 방문에 숨겨진 보관함','smart',r('칼자국의 순서를 따라 작은 열쇠를 찾았습니다.',{},{next:'hidden_vault',sameDungeon:true})),
    o('force','지금 잠금장치를 뜯는다','성공 시 금화 +25 · 실패 시 체력 -16','greed',risk(.45,'scout',r('장치를 뜯고 안쪽 은화를 꺼냈습니다.',{gold:25}),r('잠금장치의 독침에 찔렸습니다.',{hp:-16}))),skip]},
  mage_resonance:{job:'mage',title:'잠든 마력 회로',prompt:'바닥의 마력 회로가 같은 음을 반복합니다. 마법사라면 회로에 자신의 파장을 남길 수 있습니다.',options:[
    o('tune','회로에 안전한 파장을 맞춘다','체력 -8 · 다음 방문에 회로 재가동','smart',r('회로에 자신의 파장을 남겼습니다. 꺼진 마력핵이 천천히 빛나기 시작했습니다.',{hp:-8},{next:'circuit_awake',sameDungeon:true})),
    o('drain','남은 마력을 뽑아낸다','전투력 +2 · 체력 -14','bold',r('남은 마력을 끌어냈습니다. 회로는 타버렸고 손끝에는 화상이 남았습니다.',{power:2,hp:-14})),skip]},
  priest_bell:{job:'priest',title:'울리지 않는 장례 종',prompt:'작은 성소에 장례를 마치지 못한 사람들의 명단이 남아 있습니다. 종 아래에 혼탁한 빛이 맺혔습니다.',options:[
    o('rites','남은 이들을 위해 의식을 마친다','물약 -1 · 다음 원정에 유족의 보답','kind',r('물약을 성수로 나누고 이름을 하나씩 불렀습니다. 멎었던 종이 한 번 울렸습니다.',{},{next:'family_reply'}),{potionCost:1}),
    o('cleanse','종에 남은 저주만 정화한다','체력 +8 · 저주 해제','smart',r('종의 혼탁한 빛을 씻어냈습니다. 몸을 짓누르던 기운도 가벼워졌습니다.',{hp:8},{clearCurse:true})),skip]},
  porter_cargo:{job:'porter',title:'주인을 잃은 보급 상자',prompt:'길목에 길드의 보급 상자가 버려져 있습니다. 짐꾼의 매듭법으로 봉인되어 목적지를 확인할 수 있습니다.',options:[
    o('deliver','상자를 길드 보급소로 옮긴다','체력 -5 · 다음 원정에 보급대의 지원','kind',r('흩어진 짐을 다시 묶어 보급소로 옮겼습니다. 담당자가 이름을 적어 두었습니다.',{hp:-5},{next:'supply_return'})),
    o('keep','쓸 수 있는 물약만 챙긴다','물약 +1 · 후속 보급 인연 없음','greed',r('상자에서 물약 한 병을 챙기고 남은 짐은 두었습니다.',{potions:1})),skip]},
  trait_tracks:{traits:['sharp','lost'],title:'되돌아오는 발자국',prompt:'자신의 발자국 같은 흔적이 앞쪽에도 남아 있습니다. 갈림길이 같은 풍경으로 이어집니다.',options:[
    o('read','[예리함] 발자국의 차이를 구분한다','재방문할 때 숨겨진 보관함의 단서','smart',r('미세하게 다른 발자국을 골라 감춰진 문의 위치를 적었습니다.',{},{next:'hidden_vault',sameDungeon:true}),{requires:'sharp'}),
    o('wander','[길치] 익숙하지 않은 틈으로 들어간다','성공 시 은닉처 · 실패 시 체력 -13','bold',risk(.4,'luck',r('길을 헤맨 끝에 숨겨진 문을 발견했습니다.',{},{next:'hidden_vault',sameDungeon:true}),r('막힌 틈에서 미끄러져 다쳤습니다.',{hp:-13})),{requires:'lost'}),skip]},
  trait_roar:{traits:['brave','coward'],title:'문 너머의 울음',prompt:'닫힌 문 안에서 짐승의 울음과 사람의 신호가 섞여 들립니다.',options:[
    o('rush','[대담] 문을 열어 안쪽을 확인한다','성공 시 구조 인연 · 실패 시 체력 -24','bold',risk(.45,'power',r('짐승을 몰아내고 갇힌 정찰병을 구했습니다.',{hp:-5},{next:'scout_reunion'}),r('문이 열리자 달려든 짐승에게 크게 다쳤습니다.',{hp:-24})),{requires:'brave'}),
    o('warn','[겁쟁이] 돌아가며 안전 신호를 남긴다','평판 +2 · 다음 원정에 경고의 결과','safe',r('문에서 물러나 경고 표식을 남겼습니다. 뒤따르는 사람들에게 위험을 알렸습니다.',{reputation:2},{next:'warning_return'}),{requires:'coward'}),skip]},
  trait_glimmer:{traits:['greedy','lucky'],title:'금빛이 새는 틈',prompt:'붕괴한 석문 사이에서 금빛이 새어 나옵니다. 누군가 일부러 남긴 표식도 보입니다.',options:[
    o('take','[탐욕] 손을 뻗어 금빛 물건을 꺼낸다','금화 +30 · 체력 -12 · 뒤따르는 그림자','greed',r('금빛 물건을 꺼냈습니다. 주인이 찍어 둔 검은 표식이 손에 남았습니다.',{gold:30,hp:-12},{next:'debt_collector'}),{requires:'greedy'}),
    o('wait','[행운아] 빛이 옮겨 갈 때까지 기다린다','금화 +12 · 재방문할 때 보관함의 단서','smart',r('기다리자 빛이 작은 틈으로 옮겨 갔습니다. 은화와 보관함의 표식을 찾았습니다.',{gold:12},{next:'hidden_vault',sameDungeon:true}),{requires:'lucky'}),skip]},
  trait_omen:{traits:['blessed','unlucky'],title:'금 간 운명의 제단',prompt:'제단의 돌이 갈라지며 자신의 그림자만 반대 방향으로 흔들립니다.',options:[
    o('bless','[신의 총애] 남은 빛을 제단에 나눈다','체력 -6 · 다음 원정에 성소의 응답','kind',r('남은 빛을 제단에 나눴습니다. 갈라진 돌 틈에서 희미한 종소리가 났습니다.',{hp:-6},{next:'sanctuary_reply',sameDungeon:true}),{requires:'blessed'}),
    o('mark','[불운] 무너질 자리를 먼저 표시한다','체력 -5 · 다음 원정에 경고의 결과','smart',r('불길한 예감이 닿는 자리에 경고를 새겼습니다. 돌아서는 동안 돌가루가 어깨를 스쳤습니다.',{hp:-5},{next:'warning_return'}),{requires:'unlucky'}),skip]},
  trait_body:{traits:['frail','regen'],title:'몸의 한계를 재는 통로',prompt:'좁은 틈을 지나는 동안 몸이 떨립니다. 벽 안쪽에서는 약초 냄새가 납니다.',options:[
    o('herbs','[허약] 몸을 쉬게 하며 약초를 살핀다','체력 +5 · 다음 원정에 약초꾼의 소식','smart',r('벽 틈의 약초를 기록하고 잠시 쉬었습니다. 귀환길의 약초꾼에게 위치를 전하기로 했습니다.',{hp:5},{next:'herbalist_return'}),{requires:'frail'}),
    o('push','[재생] 상처를 감수하고 틈을 넓힌다','체력 -10 · 다음 방문에 열린 샘','bold',r('살갗이 긁혔지만 막힌 틈을 넓혔습니다. 바위 뒤에서 물소리가 들렸습니다.',{hp:-10},{next:'root_spring',sameDungeon:true}),{requires:'regen'}),skip]},
  bridge_rope:{title:'끊어진 밧줄 다리',prompt:'다리의 밧줄이 끊어져 보급 행렬이 돌아서고 있습니다. 남은 줄을 엮을 수 있을 듯합니다.',options:[
    o('mend','자신의 줄과 도구를 써서 고친다','금화 -6 · 다음 원정에 보급대의 지원','kind',r('끊어진 줄을 엮어 다리를 보강했습니다. 멈췄던 보급 행렬이 다시 움직였습니다.',{},{next:'supply_return'}),{cost:6}),
    o('jump','무너진 다리 아래의 짐을 건진다','성공 시 금화 +23 · 실패 시 체력 -22','bold',risk(.4,'scout',r('끊어진 줄을 타고 내려가 남겨진 짐을 건졌습니다.',{gold:23}),r('남은 줄마저 끊어져 바위에 부딪혔습니다.',{hp:-22}))),skip]},
  sealed_cache:{title:'타인의 표식이 찍힌 보물',prompt:'먼지 아래 보물함에 아직 생생한 검은 표식이 찍혀 있습니다. 옆에는 주인을 찾는 쪽지가 남았습니다.',options:[
    o('return','표식과 발견 장소를 길드에 알린다','평판 +3 · 다음 원정에 주인의 소식','kind',r('보물함은 그대로 두고 길드에 발견 장소를 전했습니다.',{reputation:3},{next:'family_reply'})),
    o('steal','표식을 떼고 보물을 챙긴다','금화 +28 · 다음 원정에 추적자','greed',r('표식을 떼어냈지만 뚜껑 안쪽의 낙인은 보지 못했습니다.',{gold:28},{next:'debt_collector'})),skip]},
  wounded_herbalist:{title:'돌무더기 아래의 약초꾼',prompt:'약초꾼이 발을 다쳐 돌무더기 아래에 앉아 있습니다. 던전 약초가 든 자루를 놓지 못합니다.',options:[
    o('aid','물약으로 치료하고 출구를 알려준다','물약 -1 · 다음 원정에 약초꾼의 보답','kind',r('물약을 건네고 출구에 표식을 남겼습니다. 약초꾼이 이름을 물었습니다.',{},{next:'herbalist_return'}),{potionCost:1}),
    o('buy','치료사를 부를 금화를 건넨다','금화 -8 · 다음 원정에 약초꾼의 보답','smart',r('치료사를 찾을 돈을 건네고 안전한 곳으로 옮겨 주었습니다.',{},{next:'herbalist_return'}),{cost:8}),skip]},
  family_reply:{followup:true,title:'돌려준 이름의 답장',prompt:'전에 남긴 기록과 물건을 받은 가족이 감사 편지와 보급 꾸러미를 보내왔습니다.',options:[
    o('accept','편지와 꾸러미를 받아 둔다','물약 +1 · 평판 +3','kind',r('돌려준 이름이 누군가에게 닿았습니다. 보급 꾸러미를 챙기고 편지를 접었습니다.',{potions:1,reputation:3},{flag:'familiesRemember'})),
    o('donate','꾸러미를 신입 모험가에게 나눈다','평판 +7 · 후속 사건 마무리','kind',r('가족의 편지는 간직하고 보급품은 신입들에게 나눴습니다.',{reputation:7},{flag:'familiesRemember'})),skip]},
  root_spring:{followup:true,title:'다시 열린 지하 샘',prompt:'이전에 손을 보탰던 곳에 맑은 물이 고였습니다. 돌 틈에는 작은 잎이 자라고 있습니다.',options:[
    o('drink','맑은 물을 조금 마신다','체력 +14 · 후속 사건 마무리','safe',r('자신이 남긴 작은 변화가 맑은 샘으로 돌아왔습니다. 물을 마시고 몸을 추슬렀습니다.',{hp:14},{flag:'springRestored'})),
    o('bottle','샘물을 작은 병에 담는다','물약 +1 · 후속 사건 마무리','smart',r('되살아난 샘물을 한 병만 챙겼습니다. 나머지는 뒤따르는 이들을 위해 남겼습니다.',{potions:1},{flag:'springRestored'})),skip]},
  miners_return:{followup:true,title:'돌아온 광부들의 수레',prompt:'전에 고친 장치에서 수레 소리가 들립니다. 광부들이 당신의 도구 자국을 알아봅니다.',options:[
    o('supplies','광부들의 보급을 받는다','물약 +1 · 금화 +8','kind',r('광부들이 수리 덕분에 길이 열렸다며 보급품과 품삯을 건넸습니다.',{potions:1,gold:8},{flag:'minersAlly'})),
    o('map','새로 이어진 갱도의 지도를 받는다','탐색력 +2 · 후속 사건 마무리','smart',r('광부들에게 새로 이어진 갱도의 지도를 받았습니다. 자신의 수리가 길을 바꿨습니다.',{scout:2},{flag:'minersAlly'})),skip]},
  goblin_caravan:{followup:true,title:'답장을 읽은 고블린 상단',prompt:'벽에 남긴 표식을 따라 고블린 상단이 다가옵니다. 당신의 안전 표식을 읽었다고 합니다.',options:[
    o('trade','상단의 답례를 받는다','금화 +12 · 평판 +2','kind',r('상단은 안전한 길 덕분에 짐을 지켰다며 답례를 건넸습니다.',{gold:12,reputation:2},{flag:'caravanAlly'})),
    o('news','상단에게 길의 소식을 듣는다','탐색력 +2 · 후속 사건 마무리','smart',r('상단과 새로 위험해진 길의 소식을 나눴습니다.',{scout:2},{flag:'caravanAlly'})),skip]},
  dead_guide:{followup:true,title:'약속을 기억한 망자',prompt:'이름을 돌려줬던 망자가 비석 뒤에 서 있습니다. 위험한 길을 피해 갈 손짓을 보냅니다.',options:[
    o('follow','망자의 손짓을 따른다','보스 비밀 통로 · 체력 -4','smart',r('망자는 약속대로 보스의 뒤로 이어지는 길을 보여줬습니다. 차가운 숨결만 몸에 남았습니다.',{hp:-4},{secret:true,flag:'deadPromiseKept'})),
    o('farewell','고맙다는 말을 전하고 떠나보낸다','체력 +10 · 후속 사건 마무리','kind',r('망자의 이름을 불러 작별했습니다. 얼어붙었던 몸의 기운이 가벼워졌습니다.',{hp:10},{flag:'deadPromiseKept'})),skip]},
  scout_reunion:{followup:true,title:'퇴로에서 다시 만난 정찰대',prompt:'전에 도왔던 정찰병들이 당신의 얼굴을 알아봤습니다. 새로 알아낸 보스의 길을 알려주려 합니다.',options:[
    o('route','정찰대가 찾아낸 길을 듣는다','이번 원정의 보스 비밀 통로','smart',r('살아 돌아간 정찰대가 보스 뒤편의 통로를 알려줬습니다. 과거의 구조가 이번 원정에 이어졌습니다.',{},{secret:true,flag:'scoutsRemember'})),
    o('bandage','정찰대와 붕대와 식량을 나눈다','체력 +12 · 평판 +2','kind',r('정찰대와 잠시 쉬며 붕대와 식량을 나눴습니다.',{hp:12,reputation:2},{flag:'scoutsRemember'})),skip]},
  hidden_vault:{followup:true,title:'기록해 둔 숨은 보관함',prompt:'전에 적어 둔 암호와 표식이 이 문에서 맞아떨어집니다. 오래 닫혀 있던 보관함이 열립니다.',options:[
    o('coins','안의 은화를 챙긴다','금화 +24 · 후속 사건 마무리','greed',r('전에 남긴 단서를 따라 보관함의 은화를 찾았습니다.',{gold:24},{flag:'vaultFound'})),
    o('notes','기록과 도구를 조사한다','탐색력 +2 · 금화 +6','smart',r('보관함에서 옛 탐험가의 기록과 도구를 꺼냈습니다.',{scout:2,gold:6},{flag:'vaultFound'})),skip]},
  circuit_awake:{followup:true,title:'다시 깨어난 마력 회로',prompt:'전에 남긴 자신의 파장이 회로를 따라 흐릅니다. 마력핵이 당신에게 반응합니다.',options:[
    o('shield','회로의 보호 마력을 나눈다','체력 +15 · 후속 사건 마무리','safe',r('자신이 맞춘 회로에서 보호 마력이 돌아왔습니다. 상처가 천천히 닫혔습니다.',{hp:15},{flag:'circuitStable'})),
    o('learn','안정된 회로를 연구한다','전투력 +1 · 탐색력 +1','smart',r('과거에 남긴 파장을 연구하며 마력의 흐름을 익혔습니다.',{power:1,scout:1},{flag:'circuitStable'})),skip]},
  supply_return:{followup:true,title:'도움을 기억한 보급대',prompt:'이전에 운반한 짐과 고쳐 둔 길 덕분에 보급대가 도착했습니다. 담당자가 당신을 찾습니다.',options:[
    o('potion','예비 물약을 받는다','물약 +1 · 평판 +2','kind',r('이전의 수고가 보급품으로 돌아왔습니다. 예비 물약 한 병을 받았습니다.',{potions:1,reputation:2},{flag:'supplyAlly'})),
    o('tools','보급대와 장비를 손질한다','전투력 +1 · 체력 +5','smart',r('보급대의 도구를 빌려 무기를 손질하고 잠시 쉬었습니다.',{power:1,hp:5},{flag:'supplyAlly'})),skip]},
  warning_return:{followup:true,title:'경고를 따라 살아온 사람들',prompt:'뒤따르던 모험가들이 당신의 경고 표식 덕분에 위험을 피했다고 합니다.',options:[
    o('share','확인한 위험 정보를 서로 나눈다','탐색력 +2 · 평판 +3','smart',r('서로 다른 길의 위험을 지도에 함께 표시했습니다. 남겨 둔 경고가 실제 생환으로 이어졌습니다.',{scout:2,reputation:3},{flag:'warningSaved'})),
    o('rest','그들과 잠시 쉬어 간다','체력 +10 · 후속 사건 마무리','safe',r('경고를 읽고 살아온 이들과 조용히 한 끼를 나눴습니다.',{hp:10},{flag:'warningSaved'})),skip]},
  debt_collector:{followup:true,title:'지워지지 않은 검은 표식',prompt:'보물의 검은 표식을 알아본 추적자가 길을 막았습니다. 가져간 물건의 값을 요구합니다.',options:[
    o('pay','은화로 값을 치른다','금화 -18 · 추적 마무리','safe',r('가져간 물건의 값을 치렀습니다. 추적자가 손의 표식을 지웠습니다.',{},{flag:'debtSettled'}),{cost:18}),
    o('bargain','[도적] 표식의 진짜 주인을 따져 묻는다','금화 -8 · 추적 마무리','smart',r('표식의 암호를 읽고 실제 손실만 계산해 돌려줬습니다.',{},{flag:'debtSettled'}),{job:'rogue',cost:8}),
    o('fight','길을 막은 추적자와 맞선다','성공 시 체력 -8 · 실패 시 체력 -28','bold',risk(.35,'power',r('추적자를 물리쳤지만 날붙이에 스쳤습니다.',{hp:-8},{flag:'debtSettled'}),r('추적자의 칼을 피하지 못했습니다. 표식과 상처가 함께 남았습니다.',{hp:-28},{flag:'debtSettled'}))),
    o('flee','옆길로 달아난다','체력 -14 · 금화 -6 · 추적 마무리','safe',r('어두운 옆길로 달아났습니다. 바위에 부딪히고 은화 일부를 흘렸습니다.',{hp:-14,gold:-6},{flag:'debtSettled'}))]},
  sanctuary_reply:{followup:true,title:'남겨 둔 빛의 응답',prompt:'빛을 나눴던 제단의 균열이 닫혔습니다. 작은 성소가 지나가는 이들을 쉬게 합니다.',options:[
    o('rest','회복된 성소에서 쉰다','체력 +16 · 후속 사건 마무리','safe',r('전에 나눈 빛이 성소의 온기로 돌아왔습니다.',{hp:16},{flag:'sanctuaryRestored'})),
    o('cleanse','남은 빛으로 저주를 씻는다','저주 해제 · 평판 +3','kind',r('성소의 빛으로 몸에 남은 저주를 씻었습니다.',{reputation:3},{clearCurse:true,flag:'sanctuaryRestored'})),skip]},
  herbalist_return:{followup:true,title:'귀환한 약초꾼의 꾸러미',prompt:'전에 도왔던 약초꾼이 말린 약초와 붕대를 싸 왔습니다. 알려준 약초 자리의 소식도 전합니다.',options:[
    o('heal','약초꾼에게 상처를 맡긴다','체력 +14 · 후속 사건 마무리','safe',r('이전에 나눈 도움이 치료로 돌아왔습니다. 약초꾼이 상처를 조심스럽게 감쌌습니다.',{hp:14},{flag:'herbalistAlly'})),
    o('learn','약초 구별법을 배운다','탐색력 +2 · 후속 사건 마무리','smart',r('약초꾼에게 독초와 약초를 구별하는 방법을 배웠습니다.',{scout:2},{flag:'herbalistAlly'})),skip]}
};

Object.assign(DUNGEON_EVENTS,{
  miners_request:{followup:true,stage:3,title:'광부들이 부탁한 마지막 짐',prompt:'보급을 나눴던 광부들이 무너진 길 앞에서 기다립니다. 다친 동료의 장비를 밖으로 옮겨 달라고 합니다.',options:[
    o('carry','남은 장비를 함께 옮긴다','체력 -6 · 금화 +16 · 평판 +3','kind',r('예전에 수리한 길에서 마지막 짐까지 옮겼습니다. 광부들이 동료를 데리고 무사히 돌아갔습니다.',{hp:-6,gold:16,reputation:3},{flag:'minersRescued'})),
    o('rig','[짐꾼] 운반틀을 만들어 나눈다','금화 -4 · 금화 +12 · 평판 +4','smart',r('운반틀로 짐의 무게를 나눴습니다. 다친 광부도 일행과 함께 돌아갈 수 있었습니다.',{gold:12,reputation:4},{flag:'minersRescued'}),{job:'porter',cost:4}),skip]},
  unmapped_chamber:{followup:true,stage:3,title:'지도 끝의 빈 공간',prompt:'광부들에게 받은 지도 끝에 비어 있는 방이 있습니다. 벽의 균열 사이로 묻힌 작업장이 보입니다.',options:[
    o('chart','안쪽까지 들어가 지도를 완성한다','성공 시 탐색력 +2·금화 +12 · 실패 시 체력 -18','bold',risk(.45,'scout',r('묻힌 작업장을 찾아 지도 끝의 빈칸을 채웠습니다.',{scout:2,gold:12},{flag:'mineMapped'}),r('안쪽의 버팀대가 무너졌습니다. 지도를 끝내지 못하고 물러났습니다.',{hp:-18},{flag:'mineSurveyEnded'}))),
    o('shore','[드워프] 버팀대를 세워 조사한다','금화 -8 · 금화 +16 · 탐색력 +1','smart',r('돌의 하중을 읽어 버팀대를 세웠습니다. 작업장 기록과 도구를 안전하게 꺼냈습니다.',{gold:16,scout:1},{flag:'mineMapped'}),{race:'dwarf',cost:8}),
    o('seal','위험한 입구를 표시하고 봉인한다','평판 +4 · 위험 구역 기록','safe',r('지도의 빈칸을 위험 구역으로 남겼습니다. 더는 그 입구로 사람이 들어가지 않게 했습니다.',{reputation:4},{flag:'mineSealed'})),skip]},
  countertrail:{followup:true,stage:3,title:'비밀 통로에 남은 역추적',prompt:'정찰대가 알려줬던 길에 낯선 발자국이 겹쳐 있습니다. 통로를 이용한 흔적을 적도 따라온 듯합니다.',options:[
    o('decoy','가짜 흔적으로 적을 다른 길로 보낸다','성공 시 평판 +4·금화 +10 · 실패 시 체력 -24','bold',risk(.4,'scout',r('적의 추적을 가짜 길로 돌렸습니다. 통로의 끝에서 버려진 보급품도 찾았습니다.',{reputation:4,gold:10},{flag:'trailSecured'}),r('미끼를 놓던 중 적의 습격을 받았습니다. 가까스로 큰길로 돌아왔습니다.',{hp:-24},{flag:'trailAbandoned'}))),
    o('erase','[도적] 추적 표식을 지우며 빠져나온다','탐색력 +2 · 위험 통로 폐기','smart',r('추적 표식을 하나씩 지웠습니다. 다시 쓰지 않을 길은 지도에서도 지웠습니다.',{scout:2},{flag:'trailSecured'}),{job:'rogue'}),
    o('skip','비밀 통로를 포기하고 큰길로 돌아간다','역추적 위험을 피해 큰길로 탐험 계속','safe',r('편했던 길도 오래 안전하지는 않았습니다. 정찰대에 역추적 소식을 전하고 큰길로 돌아갔습니다.',{},{flag:'trailAbandoned'}))]},
  rookie_escort:{followup:true,stage:3,title:'붕대를 나눴던 정찰병의 후배',prompt:'함께 식량과 붕대를 나눴던 정찰병이 후배를 데려왔습니다. 위험을 살피는 방법을 보여 달라고 합니다.',options:[
    o('lead','앞장서서 위험 구간을 통과한다','성공 시 평판 +8·체력 -5 · 실패 시 체력 -20','bold',risk(.55,'power',r('후배 앞에서 물러설 때와 나아갈 때를 보여줬습니다. 모두 출구까지 걸어 나왔습니다.',{reputation:8,hp:-5},{flag:'rookiesTrained'}),r('길을 가르치던 중 기습을 받아 다쳤습니다. 후배는 먼저 안전한 곳으로 보냈습니다.',{hp:-20},{flag:'rookiesWarned'}))),
    o('teach','안전한 자리에서 지도를 함께 읽는다','탐색력 +1 · 평판 +3','smart',r('위험한 구간은 지도 위에서 설명했습니다. 정찰병의 후배가 자신의 지도를 그리기 시작했습니다.',{scout:1,reputation:3},{flag:'rookiesTrained'})),
    o('care','[사제] 응급 처치부터 가르친다','물약 -1 · 평판 +7','kind',r('물약을 나눠 응급 처치를 가르쳤습니다. 먼저 다친 사람을 살피라는 말을 남겼습니다.',{reputation:7},{flag:'rookiesTrained'}),{job:'priest',potionCost:1}),skip]},
  relic_claimant:{followup:true,stage:3,title:'은화의 주인을 찾는 사람',prompt:'숨은 보관함에서 가져온 은화의 문양을 알아본 사람이 나타났습니다. 잃어버린 원정대의 자산이라고 합니다.',options:[
    o('return','남은 은화를 일부 돌려준다','금화 -16 · 평판 +5','kind',r('원정대의 표식을 확인하고 은화를 돌려줬습니다. 보관함에서 시작된 일이 가족에게 닿았습니다.',{reputation:5},{flag:'vaultRestitution'}),{cost:16}),
    o('share','소유를 확인할 때까지 길드에 일부 맡긴다','금화 -8 · 평판 +2','smart',r('길드가 은화의 소유 기록을 확인하도록 맡겼습니다. 성급한 거래를 멈췄습니다.',{reputation:2},{flag:'vaultMediated'}),{cost:8}),
    o('bluff','자신이 산 물건이라고 주장한다','성공 시 금화 +8·평판 -4 · 실패 시 체력 -18·금화 -10','greed',risk(.4,'luck',r('다른 거래 기록을 내밀어 은화를 팔았지만 마을에는 좋지 않은 소문이 남았습니다.',{gold:8,reputation:-4},{flag:'vaultDispute'}),r('주장의 허점을 들킨 뒤 몸싸움이 벌어졌습니다.',{hp:-18,gold:-10},{flag:'vaultDispute'}))),
    o('skip','그를 피해 자리를 떠난다','평판 -4 · 소유 분쟁을 남김','safe',r('은화의 사연을 듣지 않고 떠났습니다. 원정대의 가족은 다른 곳에 도움을 청했습니다.',{reputation:-4},{flag:'vaultDispute'}))]},
  archive_test:{followup:true,stage:3,title:'수첩이 가리킨 봉인 서고',prompt:'보관함에서 읽었던 기록이 봉인 서고의 문장과 맞아떨어집니다. 은화 대신 간직한 지식이 문 앞까지 이끌었습니다.',options:[
    o('decode','문장을 해독해 서고를 연다','성공 시 탐색력 +2·전투력 +1 · 실패 시 체력 -16','smart',risk(.5,'scout',r('수첩의 빠진 문장을 채워 서고를 열었습니다. 옛 원정대의 기술을 익혔습니다.',{scout:2,power:1},{flag:'archiveOpened'}),r('문장의 순서를 틀려 봉인의 반발을 받았습니다.',{hp:-16},{flag:'archiveClosed'}))),
    o('spell','[마법사] 마력으로 문장의 틈을 읽는다','체력 -6 · 탐색력 +2','smart',r('문장의 마력 간격을 읽어 안전하게 기록을 꺼냈습니다. 손끝에는 작은 화상이 남았습니다.',{hp:-6,scout:2},{flag:'archiveOpened'}),{job:'mage'}),
    o('notice','[예리함] 바뀐 문장만 대조한다','탐색력 +2 · 평판 +1','smart',r('필사본과 달라진 글자만 짚어냈습니다. 위험한 봉인을 건드리지 않고 기록을 남겼습니다.',{scout:2,reputation:1},{flag:'archiveOpened'}),{requires:'sharp'}),
    o('report','길드 조사단에 수첩을 넘긴다','금화 +8 · 평판 +3','kind',r('직접 문을 열기보다 조사단에 기록을 넘겼습니다. 서고는 여러 사람의 연구로 이어졌습니다.',{gold:8,reputation:3},{flag:'archiveShared'})),skip]},
  clean_deal:{followup:true,stage:3,title:'값을 치른 뒤의 거래',prompt:'표식의 값을 정리했던 상인이 이번에는 정식 거래 장부를 펼칩니다. 서로의 이름을 숨기지 않는 거래입니다.',options:[
    o('buy','장부에 적힌 값으로 물약을 산다','금화 -10 · 물약 +1','smart',r('지난 빚과는 별개의 정식 거래를 마쳤습니다. 상인이 영수증을 건넸습니다.',{potions:1},{flag:'honestTrade'}),{cost:10}),
    o('news','검은 표식의 거래 관행을 묻는다','탐색력 +1 · 평판 +2','smart',r('표식이 붙은 물건의 거래 관행을 들었습니다. 다음에는 남의 소유를 확인할 방법을 알게 됐습니다.',{scout:1,reputation:2},{flag:'honestTrade'})),skip]},
  marked_hunters:{followup:true,stage:3,title:'남겨진 표식을 쫓는 동료들',prompt:'전에 맞서거나 달아났던 추적자의 동료들이 길을 막았습니다. 해결되지 않은 표식 이야기가 퍼져 있었습니다.',options:[
    o('settle','중재 비용을 내고 분쟁을 끝낸다','금화 -16 · 평판 -2','safe',r('중재인 앞에서 값을 정리했습니다. 뒤늦은 비용을 치르고 표식 분쟁을 끝냈습니다.',{reputation:-2},{flag:'huntEnded'}),{cost:16}),
    o('fight','이번에는 추적자들의 무리에 맞선다','성공 시 체력 -8·금화 +10 · 실패 시 체력 -30','bold',risk(.35,'power',r('추적자 무리를 물리쳤습니다. 남은 이들은 더는 표식을 쫓지 않겠다고 물러났습니다.',{hp:-8,gold:10},{flag:'huntEnded'}),r('여럿의 공격을 막지 못해 크게 다쳤습니다. 사람들 틈으로 숨어 겨우 빠져나왔습니다.',{hp:-30},{flag:'huntEscaped'}))),
    o('hide','[겁쟁이] 미리 숨을 곳을 찾아 피한다','체력 -4 · 싸움을 피하고 이탈','safe',r('평소 살피던 좁은 틈에 몸을 숨겼습니다. 바위에 긁혔지만 무리는 지나갔습니다.',{hp:-4},{flag:'huntEscaped'}),{requires:'coward'}),
    o('skip','짐을 버리며 큰길로 달아난다','체력 -10 · 금화 -4','safe',r('짐 일부를 던져 추격을 늦추고 큰길의 행렬에 섞였습니다. 표식의 이야기는 그 길에 남겨 두었습니다.',{hp:-10,gold:-4},{flag:'huntEscaped'}))]}
});
// These are the second encounter's decisions, not automatic rewards for its flag.
for(const [source,choice,next,sameDungeon] of [
  ['miners_return','supplies','miners_request',false],['miners_return','map','unmapped_chamber',true],
  ['scout_reunion','route','countertrail',true],['scout_reunion','bandage','rookie_escort',false],
  ['hidden_vault','coins','relic_claimant',false],['hidden_vault','notes','archive_test',true],
  ['debt_collector','pay','clean_deal',false],['debt_collector','bargain','clean_deal',false],
  ['debt_collector','fight','marked_hunters',false],['debt_collector','flee','marked_hunters',false]
]){
  const option=DUNGEON_EVENTS[source].options.find(o=>o.id===choice);
  option.hint=option.hint.replace(/ · (후속 사건|추적) 마무리/,'')+' · 나중 원정에 다른 만남';
  for(const result of option.p==null?[option]:[option.success,option.failure])Object.assign(result,{next,sameDungeon});
}
export const DUNGEON_EVENT_IDS=Object.freeze(Object.keys(DUNGEON_EVENTS));
export function storyState(g){return g.world.dungeonStories??={version:1,seen:[],flags:{},pending:[]};}
export function eventEligible(g,id){
  const e=DUNGEON_EVENTS[id];if(!e||storyState(g).seen.includes(id))return false;
  if(dungeonHasPerson(id)&&!personAvailable(g.world.bonds?.people?.[dungeonPersonGroup(id)]))return false;
  if(e.followup)return storyState(g).pending.some(p=>p.id===id&&p.trip<=g.world.trips&&(!p.dungeon||p.dungeon===g.world.dungeonId));
  return (!e.race||e.race===g.character.race)&&(!e.job||e.job===g.character.job)&&(!e.traits||e.traits.some(t=>g.has(t)));
}
export function eventOptions(g,id,score){return dungeonRelationshipTerms(g,id,DUNGEON_EVENTS[id].options,score).filter(o=>(!o.requires||g.has(o.requires))&&(!o.job||g.character.job===o.job)&&(!o.race||g.character.race===o.race)).map(o=>({...o,icon:o.requires||o.job||o.race,disabled:(o.cost||0)>g.s.gold||(o.potionCost||0)>g.s.potions}));}
export function planDungeonEvents(g){
  const st=storyState(g),follow=st.pending.find(p=>eventEligible(g,p.id));
  const pool=g.shuffle(['chest','traveler',...DUNGEON_EVENT_IDS.filter(id=>!DUNGEON_EVENTS[id].followup&&eventEligible(g,id))]);
  let chosen=follow?[follow.id]:[pool.pop()];
  if(g.chance(.4)&&pool.length)chosen.push(pool.pop());
  chosen=planCompanions(g,chosen,!!follow);
  const spots=[];for(const [index,id] of chosen.entries()){let floor=id?.companion?1:g.int(1,index?g.floorCount():Math.min(2,g.floorCount())),room=id?.companion?(id.phase==='invite'?2:Math.min(4,g.roomCount(1))):g.int(2,g.roomCount(floor));while(spots.some(p=>p.floor===floor&&p.room===room)){room++;if(room>g.roomCount(floor)){floor=floor%g.floorCount()+1;room=2;}}
    spots.push({kind:id?.companion?'companion-event':DUNGEON_EVENTS[id]?'dungeon-event':id,...(id?.companion?{group:id.companion,phase:id.phase}:DUNGEON_EVENTS[id]?{source:id}:{}),floor,room});}
  return spots;
}
export function openDungeonEvent(g,id){
  if(g.world.mode!=='dungeon'||g.s.status!=='running'||!eventEligible(g,id))return false;
  const st=storyState(g),event=DUNGEON_EVENTS[id],prior=st.pending.find(p=>p.id===id);st.seen.push(id);st.pending=st.pending.filter(p=>p.id!==id);
  const trail=prior?.trail||[],previous=trail.at(-1),decision=previous&&DUNGEON_EVENTS[previous.source].options.find(o=>o.id===previous.choice)?.label;
  const prompt=prior?`‘${DUNGEON_EVENTS[prior.origin].title}’${decision?`에서 ‘${decision}’를 고른 일`:'에서 남긴 선택'}이 이어집니다. ${event.prompt}`:event.prompt;
  const group=dungeonHasPerson(id)?dungeonPersonGroup(id):null,p=group?person(g,group):null;
  g.setMenu('dungeon-event',(group?personIntro(g,group):'')+prompt,eventOptions(g,id).map(({id,label,hint,bias,icon,disabled})=>({id,label,hint,bias,icon,disabled})),{source:id,title:event.title,followup:!!event.followup,stage:event.stage|| (event.followup?2:1),trail,...(group?{personName:personLabel(g,group),relation:relationLabel(p.score),meetings:p.meetings+1,relationshipScore:p.score}:{})});return true;
}
export function chooseDungeonEvent(g,id){
  const ch=g.s.choice;if(ch?.kind!=='dungeon-event'||!ch.options.some(o=>o.id===id))return false;
  const o=eventOptions(g,ch.source,ch.relationshipScore).find(o=>o.id===id);if(!o||o.disabled)return false;
  g.s.status='running';g.s.choice=null;g.s.choicesMade++;g.emit(`선택: ${o.label}.`,'choice');
  g.s.gold-=o.cost||0;g.s.potions-=o.potionCost||0;
  const skill=o.skill==='power'?g.character.power*.009:o.skill==='scout'?g.character.scout*.012:g.character.luck*.015;
  const result=o.p==null?o:g.chance(Math.min(.9,o.p+skill))?o.success:o.failure;
  const cost=[o.cost?`금화 -${o.cost}`:'',o.potionCost?`물약 -${o.potionCost}`:''].filter(Boolean);
  const delta={...(result.delta||{})},labels={hp:'체력',gold:'금화',potions:'물약',power:'전투력',scout:'탐색력',reputation:'평판'};
  if(delta.hp>0)delta.hp=Math.min(delta.hp,g.character.maxHp-g.s.hp);
  const changes=Object.entries(delta).filter(([,v])=>v).map(([k,v])=>`${labels[k]||k} ${v>0?'+':''}${v}`);
  const group=dungeonHasPerson(ch.source)?dungeonPersonGroup(ch.source,id):null,text=[group?`${personLabel(g,group)} — ${result.text}`:result.text,...cost,...changes].join(' · ');
  const harmful=Object.values(delta).some(v=>v<0)&&!Object.values(delta).some(v=>v>0);
  g.enqueue(text,result===o.failure||harmful?'bad':id==='skip'?'note':'good',delta,{storyEffect:{flag:result.flag||null,next:result.next||null,sameDungeon:!!result.sameDungeon,secret:!!result.secret,clearCurse:!!result.clearCurse,origin:ch.source,trip:g.world.trips,dungeon:g.world.dungeonId,choiceLabel:o.label,trail:[...(ch.trail||[]),{source:ch.source,choice:id}]}});
  return true;
}
export function commitDungeonEffect(g,effect){
  const st=storyState(g);if(effect.flag)st.flags[effect.flag]=true;if(effect.secret)g.s.flags.secret=true;if(effect.clearCurse)g.s.flags.cursed=false;
  if(effect.next&&!st.seen.includes(effect.next)&&!st.pending.some(p=>p.id===effect.next))st.pending.push({id:effect.next,trip:effect.trip+1,dungeon:effect.sameDungeon?effect.dungeon:null,origin:effect.origin,...(effect.trail?{trail:structuredClone(effect.trail)}:{})});
}
export function dungeonEventAutoChoice(g){
  const ch=g.s.choice,options=ch.options.filter(o=>!o.disabled);
  if(options.some(o=>o.id===ch.autoTarget))return ch.autoTarget;
  const preferences=new Set([g.has('greedy')?'greed':null,g.has('brave')?'bold':null,g.has('coward')?'safe':null,g.has('sharp')?'smart':null,g.has('blessed')?'kind':null,g.character.job==='priest'?'kind':null,g.character.job==='rogue'||g.character.job==='mage'?'smart':null].filter(Boolean));
  const weights=options.map(o=>1+(preferences.has(o.bias)?4:0)+(o.icon&&g.has(o.icon)?2:0)+(o.bias==='safe'&&g.s.hp<g.character.maxHp*.4?12:0));
  return ch.autoTarget=g.weightedOption(options,weights);
}
export function validStoryTrail(trail){return trail===undefined||(Array.isArray(trail)&&trail.length<=3&&trail.every(p=>p&&DUNGEON_EVENTS[p.source]?.options.some(o=>o.id===p.choice)));}
export function validStoryState(st){return st?.version===1&&Array.isArray(st.seen)&&st.seen.every(id=>DUNGEON_EVENT_IDS.includes(id))&&new Set(st.seen).size===st.seen.length&&st.flags&&typeof st.flags==='object'&&!Array.isArray(st.flags)&&Object.values(st.flags).every(v=>typeof v==='boolean')&&Array.isArray(st.pending)&&new Set(st.pending.map(p=>p?.id)).size===st.pending.length&&st.pending.every(p=>p&&DUNGEON_EVENTS[p.id]?.followup&&!st.seen.includes(p.id)&&Number.isInteger(p.trip)&&p.trip>=0&&(!p.dungeon||['mine','crypt','ruins'].includes(p.dungeon))&&DUNGEON_EVENTS[p.origin]&&validStoryTrail(p.trail));}
