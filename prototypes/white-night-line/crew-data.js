// sync-crew.ps1 generates this file from Skill.xlsx.
const workbookCrew = [
  {
    "sheetId": 1001,
    "name": "바루",
    "affiliation": "Battle 전투팀",
    "cost": 2,
    "maxHp": 36,
    "level": 20,
    "attack": 5,
    "armor": 4,
    "spirit": 0,
    "clashPower": 1,
    "typeResists": {
      "blunt": 0.75,
      "pierce": 1.25
    },
    "affinityResists": {
      "frost": 0.75,
      "current": 1.25
    },
    "animal": "늑대",
    "weapon": "둔기",
    "artReference": "키 작은 늑대 남성. 귀 하나의 흉터와 옆으로 크게 웃는 입. 오버핏 야구 점퍼와 굵은 테이프 손잡이 배트. 타자의 낮은 준비 자세 배트를 크게 두 번 휘두른 뒤 한 번 길게 마무리",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "weapon"
    ],
    "skills": [
      {
        "name": "철심 스윙",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2
      },
      {
        "name": "울프 더블",
        "affinity": "frost",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "clashBonus": 1
      },
      {
        "name": "괴성 풀스윙",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 7,
        "coinCount": 1,
        "coinPower": 5,
        "finishDamage": 3
      }
    ]
  },
  {
    "sheetId": 1002,
    "name": "배온",
    "affiliation": "Battle 전투팀",
    "cost": 3,
    "maxHp": 31,
    "level": 21,
    "attack": 8,
    "armor": 2,
    "spirit": 15,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75,
      "blunt": 1.25
    },
    "affinityResists": {
      "steam": 0.75,
      "frost": 1.25
    },
    "animal": "여우",
    "weapon": "마도서",
    "artReference": "키 큰 여우 남성. 무표정, 세로로 긴 코트, 두꺼운 책과 납작한 펜던트. 도서 복원용 장정과 금속 책갈피 책 페이지가 펼쳐지며 글줄을 따라 관통 침이 나감",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "affinity"
    ],
    "skills": [
      {
        "name": "각주 침",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3
      },
      {
        "name": "목걸이 공명",
        "affinity": "current",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2,
        "mark": 2
      },
      {
        "name": "금서 관통식",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 3
      }
    ]
  },
  {
    "sheetId": 1003,
    "name": "보라",
    "affiliation": "Battle 전투팀",
    "cost": 1,
    "maxHp": 27,
    "level": 19,
    "attack": 6,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": null,
    "weapon": "총기",
    "artReference": "붉은 블런트 단발 여성. 길고 날카로운 눈, 짧은 바시티 재킷. 원거리 표지 장비와 손목 조준기의 원형 혼자 한 발을 꽂아 다음 아군의 표적을 잡음",
    "sets": [
      "affiliation",
      "type",
      "weapon"
    ],
    "skills": [
      {
        "name": "붉은 표지탄",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "mark": 1
      },
      {
        "name": "엄호 점사",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "guard": 3
      },
      {
        "name": "홍선 동시 사격",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 2
      }
    ]
  },
  {
    "sheetId": 1004,
    "name": "오웬",
    "affiliation": "Omega 서포트 팀",
    "cost": 2,
    "maxHp": 33,
    "level": 20,
    "attack": 6,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": null,
    "weapon": "전자장비",
    "artReference": "키 작은 남성. 흐트러진 짧은 머리, 각진 안경과 짙은 눈밑. 넉넉한 후드와 손잡이 달린 단말기 단말을 열고 터치하면 화면의 밝은 점이 적에게 날아감",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "스파크 핑",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "mark": 1
      },
      {
        "name": "과부하 핀",
        "affinity": "current",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3
      },
      {
        "name": "회로 차폐",
        "affinity": "current",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2,
        "guard": 5
      }
    ]
  },
  {
    "sheetId": 1005,
    "name": "오델",
    "affiliation": "Omega 서포트 팀",
    "cost": 2,
    "maxHp": 32,
    "level": 20,
    "attack": 7,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": "여우",
    "weapon": "전자장비",
    "artReference": "여우 여성. 위로 들린 안경 모서리, 비대칭 재킷, 한쪽 눈썹을 올린 미소. 휴대 신호등의 각진 덮개 손안의 반사판을 돌려 거짓 표식을 찍음",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "weapon"
    ],
    "skills": [
      {
        "name": "미끼 신호",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 3,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 1
      },
      {
        "name": "거울 핀",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3,
        "mark": 2
      },
      {
        "name": "거짓 교신",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 3
      }
    ]
  },
  {
    "sheetId": 1006,
    "name": "오린",
    "affiliation": "Omega 서포트 팀",
    "cost": 3,
    "maxHp": 32,
    "level": 21,
    "attack": 9,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "frost": 0.75
    },
    "animal": "여우",
    "weapon": "전자장비",
    "artReference": "여우 남성. 가는 안경과 여유 있는 반미소, 긴 민소매 코트와 정렬 렌즈. 오래된 광학 측정기의 원형 눈금 렌즈 두 개를 겹쳐 서리빛 일직선을 냄",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "affinity"
    ],
    "skills": [
      {
        "name": "빙점 산정",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2
      },
      {
        "name": "초점 보정",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2,
        "clashBonus": 1
      },
      {
        "name": "각도 역산",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 3,
        "mark": 1
      }
    ]
  },
  {
    "sheetId": 1007,
    "name": "비크",
    "affiliation": "Before 사전 준비 팀",
    "cost": 4,
    "maxHp": 35,
    "level": 22,
    "attack": 10,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "frost": 0.75
    },
    "animal": "카멜레온",
    "weapon": "전자장비",
    "artReference": "카멜레온 남성. 한쪽 눈을 감싸는 모노클, 말린 꼬리 곡선, 조각난 색면이 있는 후드. 카멜레온의 눈과 꼬리 어깨의 색면이 접히고 빈자리에서 점 하나가 튀어나옴",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "은신 침",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "mark": 1
      },
      {
        "name": "의태 해제",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 2,
        "followUpDamage": 1
      },
      {
        "name": "빈 골목 개막",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 4,
        "mark": 3
      }
    ]
  },
  {
    "sheetId": 1008,
    "name": "벤",
    "affiliation": "Before 사전 준비 팀",
    "cost": 2,
    "maxHp": 25,
    "level": 20,
    "attack": 8,
    "armor": 1,
    "spirit": 10,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75,
      "slash": 1.25
    },
    "affinityResists": {
      "frost": 0.75,
      "steam": 1.25
    },
    "animal": "족제비",
    "weapon": "전자장비",
    "artReference": "족제비 남성 훈련생. 작은 둥근 귀, 길쭉한 실루엣, 오버핏 바람막이와 고글. 메신저백과 등산용 금속 고리 달리면서 가방을 열어 손안으로 장비를 꺼냄",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "가방깃 핀",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2
      },
      {
        "name": "보급 릴",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "guard": 3
      },
      {
        "name": "비상 키트 전개",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 3
      }
    ]
  },
  {
    "sheetId": 1009,
    "name": "비아",
    "affiliation": "Before 사전 준비 팀",
    "cost": 1,
    "maxHp": 25,
    "level": 19,
    "attack": 6,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "frost": 0.75
    },
    "animal": "쥐",
    "weapon": "전자장비",
    "artReference": "17세 쥐 수인 여성. 턱선의 밤색 직모 단발, 둥근 귀, 가는 꼬리, 연노랑 조끼와 주황 탐지기. 귀 뒤에 손바닥을 띄움 탐지기를 세우면 바닥을 따라 작은 탐색 파문이 번짐",
    "sets": [
      "affiliation",
      "type",
      "animal"
    ],
    "skills": [
      {
        "name": "소음 핀",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "mark": 1
      },
      {
        "name": "그림자 탐침",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3,
        "followUpDamage": 1
      },
      {
        "name": "무음 경로",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 2
      }
    ]
  },
  {
    "sheetId": 1010,
    "name": "다인",
    "affiliation": "Detective 추적팀",
    "cost": 1,
    "maxHp": 25,
    "level": 19,
    "attack": 7,
    "armor": 1,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": "늑대",
    "weapon": "전자장비",
    "artReference": "늑대 여성 조수. 턱 쪽을 따라 모이는 짧은 머리, 집중한 눈. 짧은 트렌치와 접이식 메모판 메모를 들춰 탐침으로 증거 자리를 짚음",
    "sets": [
      "affiliation",
      "type",
      "animal"
    ],
    "skills": [
      {
        "name": "증거 핀",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "mark": 2
      },
      {
        "name": "보조 가설",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3
      },
      {
        "name": "단서 배열",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 3
      }
    ]
  },
  {
    "sheetId": 1011,
    "name": "도건",
    "affiliation": "Detective 추적팀",
    "cost": 3,
    "maxHp": 37,
    "level": 21,
    "attack": 7,
    "armor": 4,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": "늑대",
    "weapon": "둔기",
    "artReference": "키 큰 늑대 행동대장. 턱 옆 흉터, 넓은 어깨, 작업 조끼. 장비의 큰 면으로 타격하고 뾰족한 끝으로 관통 무게를 앞으로 싣고 크게 한 번 들이받음",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "weapon"
    ],
    "skills": [
      {
        "name": "현장 강타",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2,
        "clashBonus": 1
      },
      {
        "name": "표식 충각",
        "affinity": "current",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "mark": 1
      },
      {
        "name": "포위 사잇길",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 4,
        "guard": 3
      }
    ]
  },
  {
    "sheetId": 1012,
    "name": "델라",
    "affiliation": "Detective 추적팀",
    "cost": 3,
    "maxHp": 29,
    "level": 21,
    "attack": 9,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": null,
    "weapon": "전자장비",
    "artReference": "30대 초반 여성 탐정. 침착한 눈, 긴 코트와 작은 수첩. 담배 소품은 손가락에 낮게 두고 반대 손으로 증거 지시 시선과 손가락이 먼저 움직이고 표식이 뒤따름",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "용의선 지정",
        "affinity": "current",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3,
        "mark": 2
      },
      {
        "name": "정황 대조",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2,
        "mark": 3
      },
      {
        "name": "결정적 증거",
        "affinity": "current",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 4,
        "mark": 4
      }
    ]
  },
  {
    "sheetId": 1013,
    "name": "누리",
    "affiliation": "Nadir 뒷정리 팀",
    "cost": 4,
    "maxHp": 33,
    "level": 22,
    "attack": 11,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "frost": 0.75
    },
    "animal": null,
    "weapon": "둔기",
    "artReference": "키 작은 힘 캐릭터. 울먹이는 눈과 큰 작업 장갑, 봉투 한 묶음. 큰 쓰레기봉투의 묶인 입구와 접힌 면 봉투를 한 팔로 세게 내리쳐 낮은 체력의 적을 마무리",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "잔해 봉투",
        "affinity": "frost",
        "type": "blunt",
        "basePower": 6,
        "coinCount": 1,
        "coinPower": 5
      },
      {
        "name": "울먹이는 내리찍기",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 4,
        "finishDamage": 1
      },
      {
        "name": "마지막 수거",
        "affinity": "frost",
        "type": "blunt",
        "basePower": 7,
        "coinCount": 1,
        "coinPower": 6,
        "finishDamage": 4
      }
    ]
  },
  {
    "sheetId": 1014,
    "name": "나령",
    "affiliation": "Nadir 뒷정리 팀",
    "cost": 1,
    "maxHp": 28,
    "level": 19,
    "attack": 6,
    "armor": 2,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75,
      "slash": 1.25
    },
    "affinityResists": {
      "current": 0.75,
      "steam": 1.25
    },
    "animal": "쥐",
    "weapon": "둔기",
    "artReference": "키 작은 쥐 수인 대장. 납작한 눈썹과 화난 입, 짧은 작업 재킷과 호각·지휘봉. 항만 반사띠 호각을 불고 작은 지휘봉으로 좌우를 정리",
    "sets": [
      "affiliation",
      "type",
      "animal"
    ],
    "skills": [
      {
        "name": "집합 호각",
        "affinity": "current",
        "type": "blunt",
        "basePower": 4,
        "coinCount": 1,
        "coinPower": 6,
        "mark": 1
      },
      {
        "name": "지휘봉 구령",
        "affinity": "current",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "clashBonus": 1
      },
      {
        "name": "잔무 일괄 처리",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 3,
        "finishDamage": 3
      }
    ]
  },
  {
    "sheetId": 1015,
    "name": "노엘",
    "affiliation": "Nadir 뒷정리 팀",
    "cost": 3,
    "maxHp": 32,
    "level": 22,
    "attack": 8,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75,
      "blunt": 1.25
    },
    "affinityResists": {
      "current": 0.75,
      "frost": 1.25
    },
    "animal": null,
    "weapon": "둔기",
    "artReference": "키 큰 남성 청소 담당. 옷자락이 긴 앞치마, 긴 빗자루 손잡이와 넓은 솔 부분. 산업용 청소 도구 바닥을 길게 한 번 쓸며 반달 모양 궤적을 만듦",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "빗자루 날",
        "affinity": "steam",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3
      },
      {
        "name": "잔해 밀어내기",
        "affinity": "current",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 3
      },
      {
        "name": "무흔 청소",
        "affinity": "current",
        "type": "slash",
        "basePower": 6,
        "coinCount": 3,
        "coinPower": 2,
        "finishDamage": 2
      }
    ]
  },
  {
    "sheetId": 1016,
    "name": "카인",
    "affiliation": "Clear 암살팀",
    "cost": 1,
    "maxHp": 31,
    "level": 19,
    "attack": 5,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": null,
    "weapon": "총기",
    "artReference": "남성 저격수. 마스크 밖에 보이는 눈 옆 흉터, 낮은 목선, 납작한 망토. 소품은 무광의 단순한 실루엣 실루엣이 한 번 낮아진 뒤 조준점이 먼저 드러남",
    "sets": [
      "affiliation",
      "type",
      "weapon"
    ],
    "skills": [
      {
        "name": "한숨 숨기기",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 5,
        "coinCount": 1,
        "coinPower": 4,
        "followUpDamage": 1
      },
      {
        "name": "안개 조준",
        "affinity": "frost",
        "type": "pierce",
        "basePower": 6,
        "coinCount": 1,
        "coinPower": 5
      },
      {
        "name": "정적의 한 발",
        "affinity": "steam",
        "type": "pierce",
        "basePower": 6,
        "coinCount": 1,
        "coinPower": 6,
        "followUpDamage": 2
      }
    ]
  },
  {
    "sheetId": 1017,
    "name": "케이",
    "affiliation": "Clear 암살팀",
    "cost": 2,
    "maxHp": 28,
    "level": 20,
    "attack": 8,
    "armor": 1,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": null,
    "weapon": "도검",
    "artReference": "조용한 관측수. 감은 듯한 옆눈, 몸에 붙는 짧은 하프코트와 단검. 작은 광학 기기와 접이식 머리띠 옆눈으로 확인하고 짧게 한 선을 그음",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "침묵의 밑줄",
        "affinity": "current",
        "type": "slash",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3
      },
      {
        "name": "관측점 절개",
        "affinity": "frost",
        "type": "slash",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 3,
        "mark": 2
      },
      {
        "name": "시야 밖 궤적",
        "affinity": "current",
        "type": "slash",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 2,
        "followUpDamage": 2
      }
    ]
  },
  {
    "sheetId": 1018,
    "name": "코르",
    "affiliation": "Clear 암살팀",
    "cost": 4,
    "maxHp": 41,
    "level": 22,
    "attack": 9,
    "armor": 4,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": null,
    "weapon": "방호장비",
    "artReference": "근접 가드. 크고 낮은 어깨, 넓은 방패와 짧은 검. 철제 방패의 보강선과 손잡이 곡선 방패를 세운 뒤 측면에서 검이 한 번 나감",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "방패 뒤의 칼",
        "affinity": "steam",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 2
      },
      {
        "name": "교대 가드",
        "affinity": "frost",
        "type": "slash",
        "basePower": 6,
        "coinCount": 1,
        "coinPower": 5,
        "guard": 5
      },
      {
        "name": "틈새 결착",
        "affinity": "steam",
        "type": "slash",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 4,
        "followUpDamage": 2
      }
    ]
  },
  {
    "sheetId": 1019,
    "name": "제온",
    "affiliation": "zenith 지원팀",
    "cost": 4,
    "maxHp": 37,
    "level": 22,
    "attack": 9,
    "armor": 4,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": "거북이",
    "weapon": "방호장비",
    "artReference": "거북이 수인 방어수. 둥근 등갑 실루엣과 넓은 팔 보호대. 거북 등껍질의 큰 다각형 면 등갑 모양 보호막이 접혔다 크게 펴짐",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "등갑 전개",
        "affinity": "current",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2,
        "guard": 3
      },
      {
        "name": "방벽 전진",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 6,
        "coinCount": 1,
        "coinPower": 5,
        "guard": 5
      },
      {
        "name": "갑판 성채",
        "affinity": "current",
        "type": "blunt",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 7
      }
    ]
  },
  {
    "sheetId": 1020,
    "name": "지오",
    "affiliation": "zenith 지원팀",
    "cost": 4,
    "maxHp": 34,
    "level": 23,
    "attack": 10,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75,
      "pierce": 1.25
    },
    "affinityResists": {
      "steam": 0.75,
      "current": 1.25
    },
    "animal": "호랑이",
    "weapon": "방호장비",
    "artReference": "키 작은 호랑이 남성. 짧은 단발, 둥근 귀, 관자놀이 줄무늬. 구조 조끼와 붕대 릴, 부드러운 눈 타격 후 붕대 릴이 체력이 낮은 아군에게 뻗음",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "응급 간섭",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 1,
        "coinPower": 4,
        "heal": 2
      },
      {
        "name": "회복 붕대 릴",
        "affinity": "current",
        "type": "blunt",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "heal": 4
      },
      {
        "name": "재정비 신호",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "heal": 6
      }
    ]
  },
  {
    "sheetId": 1021,
    "name": "자크",
    "affiliation": "zenith 지원팀",
    "cost": 1,
    "maxHp": 30,
    "level": 19,
    "attack": 5,
    "armor": 4,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "frost": 0.75
    },
    "animal": "하이에나",
    "weapon": "방호장비",
    "artReference": "하이에나 수인. 얼굴 흉터와 솟은 목선, 헐렁한 구조복. 들것의 둥근 끝과 밝은 이송 끈 들것을 눕혀 통로를 만들고 허리 벨트를 팽팽히 당김",
    "sets": [
      "affiliation",
      "type",
      "weapon"
    ],
    "skills": [
      {
        "name": "들것 밀치기",
        "affinity": "frost",
        "type": "blunt",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "guard": 2
      },
      {
        "name": "구호 벨트",
        "affinity": "steam",
        "type": "blunt",
        "basePower": 4,
        "coinCount": 2,
        "coinPower": 2,
        "heal": 2
      },
      {
        "name": "이송로 확보",
        "affinity": "frost",
        "type": "blunt",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 4
      }
    ]
  },
  {
    "sheetId": 1022,
    "name": "아르덴",
    "affiliation": "Alfa 간부",
    "cost": 2,
    "maxHp": 34,
    "level": 20,
    "attack": 6,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "slash": 0.75
    },
    "affinityResists": {
      "steam": 0.75
    },
    "animal": "드래곤",
    "weapon": "도검",
    "artReference": "키 큰 드래곤 남성. 각진 뿔, 묵직한 꼬리, 정장의 긴 라펠. 도검 손잡이와 직각의 재단선 소매를 정리하고 직선 두 개를 이어 긋음",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "용린 선긋기",
        "affinity": "steam",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 2
      },
      {
        "name": "재단 검식",
        "affinity": "current",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 2
      },
      {
        "name": "간부 결재",
        "affinity": "steam",
        "type": "slash",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 4,
        "clashBonus": 1
      }
    ]
  },
  {
    "sheetId": 1023,
    "name": "아델",
    "affiliation": "Alfa 간부",
    "cost": 3,
    "maxHp": 39,
    "level": 21,
    "attack": 7,
    "armor": 4,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "blunt": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": "갈매기",
    "weapon": "도검",
    "artReference": "갈매기에서 모티프를 잡은 여성. 가는 안경, 흰색과 회색이 나뉜 깃 코트. 접히는 깃과 얇은 곡선 날 옷자락이 접혔다 펴지며 바람을 따라 베어냄",
    "sets": [
      "affiliation",
      "type",
      "weapon",
      "affinity"
    ],
    "skills": [
      {
        "name": "깃날 검사",
        "affinity": "current",
        "type": "slash",
        "basePower": 4,
        "coinCount": 3,
        "coinPower": 2
      },
      {
        "name": "편대 재정렬",
        "affinity": "frost",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "guard": 4
      },
      {
        "name": "기류 절단",
        "affinity": "current",
        "type": "slash",
        "basePower": 6,
        "coinCount": 3,
        "coinPower": 2,
        "followUpDamage": 2
      }
    ]
  },
  {
    "sheetId": 1024,
    "name": "안셀",
    "affiliation": "Alfa 간부",
    "cost": 4,
    "maxHp": 37,
    "level": 22,
    "attack": 10,
    "armor": 3,
    "spirit": 0,
    "clashPower": 0,
    "typeResists": {
      "pierce": 0.75
    },
    "affinityResists": {
      "current": 0.75
    },
    "animal": "쥐",
    "weapon": "도검",
    "artReference": "키 작은 쥐 남성 간부. 무표정, 큰 정장 소매와 얇은 검, 시가 소품. 둥근 귀와 직선 머리의 대비 한 손을 주머니에 둔 채 짧고 차갑게 선을 남김",
    "sets": [
      "affiliation",
      "type",
      "animal",
      "weapon"
    ],
    "skills": [
      {
        "name": "정숙 지시",
        "affinity": "current",
        "type": "slash",
        "basePower": 5,
        "coinCount": 2,
        "coinPower": 3,
        "clashBonus": 1
      },
      {
        "name": "은색 재단",
        "affinity": "frost",
        "type": "slash",
        "basePower": 5,
        "coinCount": 3,
        "coinPower": 2
      },
      {
        "name": "최종 서명",
        "affinity": "current",
        "type": "slash",
        "basePower": 6,
        "coinCount": 2,
        "coinPower": 4,
        "finishDamage": 2
      }
    ]
  }
];
