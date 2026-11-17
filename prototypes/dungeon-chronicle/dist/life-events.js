// Conditions apply when drawing an event; its confirmed costs/results remain valid after a job change.
const o=(id,label,hint,bias,extra)=>({id,label,hint,bias,...extra});
export const LIFE_EVENTS={
  inn_expansion:{career:'inn',minGold:25,title:'방이 모자라는 여관',prompt:'단골 파티가 늘어 빈방을 찾는 손님을 돌려보내고 있습니다.',options:[
    o('expand','객실을 늘린다','금화 -25 · 이후 여관 수입 증가','bold',{cost:25,delta:{gold:-25,fatigue:8},worldFlag:'innExpanded',text:'빈 창고를 객실로 고쳤습니다. 이후 더 많은 손님을 받을 수 있습니다.'}),
    o('repair','기존 방부터 고친다','금화 -12 · 평판 +5','smart',{cost:12,delta:{gold:-12,reputation:5},text:'낡은 침상과 지붕을 고쳤습니다. 단골들이 다시 찾아왔습니다.'}),
    o('refer','이웃 여관에 손님을 소개한다','평판 +3 · 피로 -4','safe',{delta:{reputation:3,fatigue:-4},text:'이웃 여관과 손님을 나눴습니다. 무리한 확장은 하지 않았습니다.'})]},
  inn_refugees:{career:'inn',requires:'warSeen',title:'피난민이 찾은 여관',prompt:'전쟁을 피해 온 가족들이 던전 모험가의 빈방을 빌려 달라고 합니다.',options:[
    o('shelter','빈방을 무료로 내준다','금화 -15 · 평판 +9 · 후속 인연','kind',{cost:15,delta:{gold:-15,reputation:9},text:'피난 온 가족들에게 잠자리를 내줬습니다.',due:{delay:24,text:'여관에서 머물던 가족이 새 보금자리에서 감사 인사를 보내왔습니다. 평판 +4.',delta:{reputation:4}}}),
    o('sponsor','길드의 숙박 지원을 연결한다','평판 +5 · 피로 +4','smart',{delta:{reputation:5,fatigue:4},text:'길드의 피난민 지원금으로 숙박을 마련했습니다.'}),
    o('short','식사와 길 안내만 돕는다','금화 -4 · 낮은 피로','safe',{cost:4,delta:{gold:-4,reputation:2},text:'따뜻한 식사를 내주고 구호소로 가는 길을 알려줬습니다.'})]},
  inn_cellar:{career:'inn',minAge:25,title:'지하실 아래의 통로',prompt:'술통을 옮기다가 벽 뒤에서 던전으로 이어지는 통로를 발견했습니다.',options:[
    o('explore','통로 안을 조사한다','유물 발견 또는 부상','bold',{p:.5,skill:'scout',success:{text:'지하실 통로에서 오래된 지도와 은화를 찾았습니다. 금화 +25, 탐색력 +2.',delta:{gold:25,scout:2},item:'여관 지하실의 지도'},failure:{text:'낡은 계단이 무너져 다쳤습니다. 체력 -22, 피로 +8.',delta:{hp:-22,fatigue:8}}}),
    o('seal','통로를 봉인한다','금화 -8 · 평판 +4','safe',{cost:8,delta:{gold:-8,reputation:4},text:'통로를 봉인해 손님들이 위험에 빠지지 않도록 했습니다.'}),
    o('report','길드에 발견을 신고한다','금화 +10 · 평판 +3','smart',{delta:{gold:10,reputation:3},text:'길드가 지하실을 조사하고 발견 보상금을 지급했습니다.'})]},
  inn_successor:{career:'inn',minAge:55,title:'여관을 맡겠다는 단골',prompt:'오래 머문 단골이 여관 일을 함께 맡고 싶다고 합니다.',options:[
    o('hire','동료 주인으로 맞는다','금화 -18 · 이후 피로 감소','kind',{cost:18,delta:{gold:-18,fatigue:-15},worldFlag:'innHelper',text:'단골과 여관 일을 나눴습니다. 앞으로 쉴 시간을 더 얻습니다.'}),
    o('sell','여관을 넘기고 일을 내려놓는다','금화 +45 · 마을에서 새로운 길','safe',{delta:{gold:45,fatigue:-30},retireCareer:true,text:'열쇠를 새 주인에게 넘겼습니다. 여관 일을 마치고 마을로 나왔습니다.'}),
    o('keep','아직 직접 운영한다','평판 +2 · 피로 +8','bold',{delta:{reputation:2,fatigue:8},text:'익숙한 여관을 조금 더 직접 운영하기로 했습니다.'})]},
  guild_forgery:{career:'guild',minAge:25,title:'조작된 귀환 보고서',prompt:'던전 귀환 보고서와 구조 기록의 인원수가 맞지 않습니다.',options:[
    o('investigate','보고서의 작성자를 추적한다','진실 발견 또는 조사 실패','bold',{p:.55,skill:'scout',success:{text:'보상을 가로챈 담당자를 밝혀냈습니다. 평판 +9, 금화 +15.',delta:{reputation:9,gold:15},worldFlag:'guildHonest'},failure:{text:'증거를 찾지 못해 조사가 길어졌습니다. 피로 +12, 평판 -2.',delta:{fatigue:12,reputation:-2}}}),
    o('audit','다른 서기와 기록을 대조한다','탐색력 +1 · 평판 +4','smart',{delta:{scout:1,reputation:4,fatigue:4},text:'다른 서기와 기록을 대조해 잘못된 보상 지급을 멈췄습니다.'}),
    o('quiet','상급자에게 봉인해 넘긴다','금화 +5 · 조사를 맡김','safe',{delta:{gold:5},text:'보고서를 봉인하고 감찰 담당자에게 맡겼습니다.'})]},
  guild_quarantine:{career:'guild',requires:'illnessSeen',title:'귀환자 검역소',prompt:'던전에서 돌아온 파티들 사이에 열병이 퍼져 검역 인력이 부족합니다.',options:[
    o('organize','검역소를 조직한다','금화 -12 · 평판 +8 · 이후 질병 위험 감소','smart',{cost:12,delta:{gold:-12,reputation:8},worldFlag:'healthNetwork',text:'치료사와 길드가 협력하는 검역소를 마련했습니다.'}),
    o('visit','아픈 모험가들을 직접 돕는다','평판 +6 · 피로 +12','kind',{delta:{reputation:6,fatigue:12},text:'검역소를 오가며 환자와 가족을 돌봤습니다.'}),
    o('desk','접수와 연락 업무를 맡는다','금화 +8 · 낮은 피로','safe',{delta:{gold:8,fatigue:2},text:'접수대에서 환자들의 가족과 연락을 이어줬습니다.'})]},
  guild_veteran:{career:'guild',minAge:40,title:'부상한 길잡이의 재취업',prompt:'다리를 다쳐 은퇴한 길잡이가 길드에서 일할 자리를 찾습니다.',options:[
    o('mentor','신입 교육 담당으로 고용한다','금화 -18 · 이후 업무 피로 감소','kind',{cost:18,delta:{gold:-18,reputation:5},worldFlag:'guildHelper',text:'은퇴한 길잡이에게 신입 교육을 맡겼습니다. 현장 경험이 길드에 남았습니다.'}),
    o('record','경험을 기록하는 일을 맡긴다','탐색력 +2 · 평판 +3','smart',{delta:{scout:2,reputation:3,fatigue:3},text:'길잡이의 기억을 지도와 기록으로 남겼습니다.'}),
    o('aid','다른 일자리를 소개한다','평판 +2 · 안정적인 지원','safe',{delta:{reputation:2},text:'몸 상태에 맞는 일자리를 찾아 소개했습니다.'})]},
  guild_archive:{career:'guild',minRep:20,title:'봉인된 길드 서고',prompt:'신뢰를 얻어 오래된 던전 사고 기록을 열람할 권한을 받았습니다.',options:[
    o('study','사고의 공통점을 연구한다','탐색력 +3 · 피로 +10','smart',{delta:{scout:3,fatigue:10},item:'길드 사고 조사 수첩',worldFlag:'guildArchive',text:'여러 사고에 반복된 징후를 수첩에 정리했습니다. 탐색력 +3.'}),
    o('share','유족에게 남은 기록을 돌려준다','평판 +8 · 후속 인연','kind',{delta:{reputation:8},text:'서고에 묻힌 기록을 유족에게 돌려줬습니다.',due:{delay:36,text:'기록을 받은 유족이 구조 물자를 기증했습니다. 금화 +16.',delta:{gold:16}}}),
    o('close','개인정보를 지키고 서고를 닫는다','평판 +3 · 피로 -5','safe',{delta:{reputation:3,fatigue:-5},text:'명단을 외부에 넘기지 않고 서고를 닫았습니다.'})]},
  trader_shortage:{career:'trader',minRep:20,title:'물약 공급이 끊긴 날',prompt:'던전용 물약이 부족해져 길드가 비축분을 요청합니다.',options:[
    o('share','비축분을 적정 가격에 공급한다','금화 +12 · 평판 +7','kind',{delta:{gold:12,reputation:7},worldFlag:'traderTrusted',text:'비축 물약을 공정한 가격으로 공급했습니다. 길드가 거래처로 기억합니다.'}),
    o('profit','가격을 올려 판매한다','금화 +35 · 평판 -8','greed',{delta:{gold:35,reputation:-8},text:'급한 파티들이 비싼 물약값을 치렀습니다. 금화 +35, 평판 -8.'}),
    o('reserve','기존 단골의 주문만 받는다','금화 +8 · 안정적인 거래','safe',{delta:{gold:8},text:'기존 단골에게 약속한 물약을 먼저 전달했습니다.'})]},
  trader_theft:{career:'trader',maxRep:60,title:'도난당한 전리품 상자',prompt:'가게 뒤편의 전리품 상자가 사라졌습니다. 장물 시장에서 비슷한 상자를 봤다는 소문이 돕니다.',options:[
    o('recover','장물 거래상을 직접 찾아간다','회수 성공 또는 몸싸움','bold',{p:.45,skill:'luck',success:{text:'도난품을 되찾고 거래상의 장부를 확보했습니다. 금화 +20, 평판 +4.',delta:{gold:20,reputation:4}},failure:{text:'장물 거래상과 몸싸움이 벌어졌습니다. 체력 -24, 금화 -10.',delta:{hp:-24,gold:-10}}}),
    o('guard','경비대에 신고한다','금화 -6 · 평판 +4','smart',{cost:6,delta:{gold:-6,reputation:4},text:'경비대에 조사 비용을 내고 장물 시장 수사를 맡겼습니다.'}),
    o('secure','자물쇠를 바꾸고 손실을 받아들인다','금화 -10 · 이후 경비 확보','safe',{cost:10,delta:{gold:-10},worldFlag:'traderGuard',text:'잃은 물건을 장부에서 지우고 가게의 경비를 보강했습니다.'})]},
  trader_fake:{career:'trader',minAge:25,title:'진짜처럼 보이는 유물',prompt:'비싼 유물의 문양이 오래된 거래 기록과 다릅니다.',options:[
    o('inspect','문양과 출처를 검증한다','탐색력 +2 · 평판 +4','smart',{delta:{scout:2,reputation:4,fatigue:5},text:'유물의 출처를 조사해 정교한 위조품임을 밝혔습니다.'}),
    o('return','판매자에게 돌려준다','손실 없이 거래 중단','safe',{text:'확신할 수 없는 유물을 판매자에게 돌려줬습니다.'}),
    o('sell','진위가 불명확한 채 되판다','금화 +24 · 평판 -7','greed',{delta:{gold:24,reputation:-7},text:'유물을 되팔았지만 뒤늦게 위조 소문이 퍼졌습니다.'})]},
  trader_apprentice:{career:'trader',minAge:45,title:'상점을 잇고 싶은 도제',prompt:'함께 일해 온 도제가 거래 장부와 단골 관리를 맡고 싶다고 합니다.',options:[
    o('partner','동업자로 받아들인다','금화 -20 · 이후 수입 증가·피로 감소','kind',{cost:20,delta:{gold:-20,fatigue:-12},worldFlag:'traderHelper',text:'도제와 상점을 함께 운영하게 됐습니다. 거래와 휴식 시간을 나눕니다.'}),
    o('sale','상점을 넘기고 일을 내려놓는다','금화 +50 · 마을에서 새로운 길','safe',{delta:{gold:50,fatigue:-25},retireCareer:true,text:'장부와 단골 명단을 넘기고 상점 일을 마쳤습니다.'}),
    o('teach','거래법을 가르치며 계속 운영한다','평판 +4 · 행운 +1','smart',{delta:{reputation:4,luck:1,fatigue:6},text:'도제에게 거래법을 가르치며 상점을 계속 운영했습니다.'})]},
  smith_prosthetic:{career:'smith',minAge:25,title:'새 손을 기다리는 모험가',prompt:'던전에서 한 손을 잃은 모험가가 도구를 잡을 보조 장비를 부탁합니다.',options:[
    o('craft','맞춤 보조 장비를 만든다','금화 -15 · 평판 +9 · 후속 인연','kind',{cost:15,delta:{gold:-15,reputation:9,scout:1},text:'몸에 맞는 보조 장비를 만들었습니다. 모험가는 다른 일을 시작할 수 있게 됐습니다.',due:{delay:24,text:'보조 장비를 쓰는 모험가가 운반 일을 시작하고 수리비를 보내왔습니다. 금화 +20.',delta:{gold:20}}}),
    o('team','길드와 제작 비용을 나눈다','금화 -5 · 평판 +5','smart',{cost:5,delta:{gold:-5,reputation:5},text:'길드의 지원을 받아 보조 장비를 함께 제작했습니다.'}),
    o('refer','전문 공방을 소개한다','평판 +2 · 무리한 작업을 피함','safe',{delta:{reputation:2},text:'경험 있는 공방을 소개하고 치수를 전달했습니다.'})]},
  smith_furnace:{career:'smith',minGold:18,title:'낡은 용광로',prompt:'용광로의 온도가 불안정해져 던전 장비 주문을 제대로 처리하지 못합니다.',options:[
    o('replace','용광로를 교체한다','금화 -18 · 이후 공방 수입 증가','smart',{cost:18,delta:{gold:-18,fatigue:5},worldFlag:'smithFurnace',text:'새 용광로를 들여 주문품을 안정적으로 만들게 됐습니다.'}),
    o('patch','균열만 수리한다','금화 -8 · 평판 +2','safe',{cost:8,delta:{gold:-8,reputation:2},text:'균열을 수리하고 작업량을 줄였습니다.'}),
    o('risk','남은 주문을 그대로 처리한다','금화 +18 · 체력 -12 · 높은 피로','greed',{delta:{gold:18,hp:-12,fatigue:15},text:'불안정한 용광로로 주문을 마쳤지만 화상을 입었습니다. 체력 -12.'})]},
  smith_fire:{career:'smith',minAge:30,title:'공방의 화재',prompt:'늦은 밤 불티가 목재 선반으로 옮겨붙었습니다. 안쪽에 주문 장비가 남아 있습니다.',options:[
    o('save','주문 장비를 구하러 들어간다','회수 성공 또는 심한 화상','bold',{p:.4,skill:'scout',success:{text:'연기가 짙어지기 전에 장비를 꺼냈습니다. 평판 +6, 피로 +12.',delta:{reputation:6,fatigue:12}},failure:{text:'장비를 꺼내다가 심한 화상을 입었습니다. 체력 -38, 피로 +18.',delta:{hp:-38,fatigue:18}}}),
    o('crew','이웃들과 밖에서 불을 끈다','금화 -12 · 평판 +3','smart',{cost:12,delta:{gold:-12,reputation:3},text:'이웃들과 불길을 막았습니다. 일부 주문품을 잃었지만 모두 무사했습니다.'}),
    o('escape','사람부터 대피시킨다','금화 -20 · 부상 없이 대피','safe',{delta:{gold:-20,reputation:4},text:'사람들을 먼저 대피시켰습니다. 주문품은 타버렸지만 인명 피해는 없었습니다.'})]},
  smith_legacy:{career:'smith',minAge:55,title:'도제에게 남길 기술',prompt:'함께 일한 도제가 공방의 표식을 이어받고 싶다고 합니다.',options:[
    o('handoff','공방을 맡기고 은퇴한다','금화 +40 · 마을에서 새로운 길','safe',{delta:{gold:40,fatigue:-30},retireCareer:true,text:'공방의 표식과 도구를 도제에게 넘겼습니다. 자신의 다음 삶을 준비합니다.'}),
    o('mentor','작업을 나누고 스승으로 남는다','평판 +7 · 이후 피로 감소','kind',{delta:{reputation:7,fatigue:-15},worldFlag:'smithHelper',text:'무거운 작업을 도제에게 맡기고 기술을 가르치는 일을 이어갔습니다.'}),
    o('book','기술을 책으로 정리한다','탐색력 +2 · 피로 +6','smart',{delta:{scout:2,fatigue:6},item:'자신의 제작 기술서',text:'평생 익힌 장비 제작법을 기술서에 남겼습니다.'})]}
};
