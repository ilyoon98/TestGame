// 화면용 상수와 원화 좌표표. 좌표는 원화 프레임 기준 백분율이다.
// 호출할 때마다 새 객체를 만든다. 테스트가 판마다 값을 바꿔도 서로 영향을 주지 않는다.
export function createArtData(){
  const pursuitWarningDistance=2;
  const categories = {attack:"공격", defense:"방어", skill:"스킬"};
  const icons = {
    attack:'<path d="m5 19 5-5m-1-3 4 4m-2-3L19 4l1 1-8 8M4 20l3-3"/>',
    partLost:'<path class="part-loss-outline" d="m6 6 12 12M18 6 6 18"/><path class="part-loss-ink" d="m6 6 12 12M18 6 6 18"/>',
    pierce:'<path d="M10 4 4 7v5c0 4 3 6 6 8 3-2 6-4 6-8v-1M10 4l6 3M9 14l12-7m-6 0h6v6"/>',
    defense:'<path d="M12 3 5 6v5c0 4 2.9 7.6 7 10 4.1-2.4 7-6 7-10V6l-7-3Z"/>',
    skill:'<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    head:'<circle cx="12" cy="8" r="5"/><path d="M7 21v-2a5 5 0 0110 0v2"/>',
    eyes:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2"/>',
    hiddenIntent:'<path d="M3 3l18 18M10 6a11 11 0 012 0c6 0 10 6 10 6a15 15 0 01-3 3M6 7a16 16 0 00-4 5s4 6 10 6c1 0 3 0 4-1"/>',
    arms:'<path d="M4 14l3-5 4 1 2 4 3-2V8l-2-1 1-3 4 1 2 5-2 8-5 2-8-1Z"/>',
    chest:'<path d="M8 4l-4 3 2 5 1 6h10l1-6 2-5-4-3-4 3Z"/><path d="M12 7v9"/>',
    belly:'<path d="M7 5l-1 6-2 7 3 2h10l3-2-2-7-1-6"/><circle cx="12" cy="14" r="1"/>',
    legs:'<path d="M8 3h8l-1 9 2 8h-4l-2-7-1 7H6l1-8Z"/>',
    redraw:'<rect x="7" y="5" width="12" height="15" rx="2"/><path d="M4 16V7l2-3m4 8 2 2 4-4"/>',
    clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    learnSkill:'<path d="M12 5v14M3 5h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v12h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3Z"/><path d="M16 8v6m-3-3h6"/>',
    upgradeSkill:'<path d="m5 12 7-7 7 7m-14 6 7-7 7 7"/>',
    nunLantern:'<path d="M9 6a3 3 0 0 1 6 0m-6 0-3 3h12l-3-3M7 9l1 10h8l1-10M6 20h12"/><path d="M10 15c0-1 2-2 2-4 1 2 2 3 2 4a2 2 0 0 1-4 0Z"/>',
    guardCrest:'<path d="M6 3h12v13l-6 5-6-5V3Z"/><path d="M12 6v10M9 10h6"/>',
    traitBow:'<path d="M5 5c9-1 15 5 14 14L5 5Zm1 13L18 6m-5 0h5v5M4 17h3v3"/>',
    brokenShackle:'<path d="M11 5a5 5 0 1 0 4 8l-3-3m4-6 2-2m1 7 3-1m-8 10 3 3m-8-3-2 3"/>',
    routeBattle:'<path d="m4 3 9 9-2 2-9-9 2-2Zm16 0-9 9 2 2 9-9-2-2ZM4 16l4 4m-6 2 5-5m13-1-4 4m6 2-5-5"/>',
    routeRest:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"/>',
    routeShop:'<path d="M5 8h14l2 12H3L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    routeMystery:'<path d="M9 8a3.2 3.2 0 0 1 6.4 0c0 2.6-3.4 3-3.4 5.5"/><circle cx="12" cy="18" r=".5"/>',
    routeElite:'<path d="m4 7 4 3 4-7 4 7 4-3-2 12H6L4 7Zm3 9h10"/>',
    routeBoss:'<path d="M5 10a7 7 0 1114 0c0 3-2 4-3 5v4H8v-4c-1-1-3-2-3-5Zm5 6v3m4-3v3"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/>',
    bell:'<path d="M10 4h4m-2 0v3m-7 7a7 7 0 0 1 14 0v2l2 2H3l2-2v-2Zm4 7h6"/>',
    gate:'<path d="M4 3h16v18H4zM8 3v18m4-18v18m4-18v18M4 10h16"/>',
    routeExit:'<path d="M5 21V3h13v18M9 21V7h9M12 14h1M2 21h20"/>',
    pursuer:'<circle cx="12" cy="5" r="3"/><path d="m7 21 1-10h8l1 10M8 12l-4 5m12-5 4 5M9 5h6M4 17l2 3 3-2m11-1-2 3-3-2"/>',
    runner:'<circle cx="16" cy="5" r="2"/><path d="m5 10 5-3 4 3 3 2 4-1M12 10l-3 4 5 2 1 5m-6-7-3 5H2"/>'
  };
  const bodyAnchors = {
    player:[[50,11],[62,23],[25,43],[49,44],[50,58],[58,80]],
    guard:[[52,12],[60,24],[28,57],[52,42],[50,56],[56,80]],
    awakened:[[52,12],[61,22],[29,58],[53,42],[50,54],[60,80]],
    archer:[[49,12],[55,22],[28,52],[52,41],[51,51],[47,76]],
    shaman:[[45,9],[54,22],[30,54],[51,42],[50,51],[46,76]],
    janitor:[[33,11],[57,20],[73,43],[48,37],[56,60],[51,83]],
    crawler:[[28,26],[51,23],[63,50],[45,43],[72,65],[53,85]],
    medic:[[36,12],[58,22],[68,47],[46,39],[57,61],[49,84]],
    sentinel:[[36,12],[60,21],[72,46],[49,37],[57,61],[46,83]],
    warden:[[36,14],[58,22],[77,48],[49,38],[60,61],[49,83]],
    bellboy:[[43,28],[40,31],[60,46],[51,48],[54,62],[56,83]]
  };
  const partyArt = {
    player:{src:"art/characters/nun-sd.png",kind:"nun"},
    guard:{src:"art/characters/guard-sd.png",kind:"guard"},
    awakened:{src:"art/characters/awakened-sd.png",kind:"awakened"},
    archer:{src:"art/characters/archer-sd-v5.png",kind:"archer"},
    shaman:{src:"art/characters/shaman-sd-v5.png",kind:"shaman"}
  };
  const motionArt=Object.fromEntries(["nun","guard","awakened","archer","shaman","janitor","crawler","medic","sentinel","warden"].map(id=>[
    id,{attack:`art/characters/motion/${id}-attack.png`,hit:`art/characters/motion/${id}-hit.png`,guard:`art/characters/motion/${id}-guard.webp`,defeat:`art/characters/motion/${id}-defeat.webp`}
  ]));
  for(const id of ["nun","shaman"]) motionArt[id].heal=`art/characters/motion/${id}-heal.webp`;
  motionArt.archer.release="art/characters/motion/archer-release.webp";
  motionArt.bellboy=Object.fromEntries(["idle","bell","attack","staggered","hit","defeat"]
    .map(pose=>[pose,`art/characters/bellboy/${pose}.webp`]));
  const armLossAnchors={
    nun:{idle:[64.84,40.1],hit:[59.38,46.35],attack:[61.33,44.01],guard:[64.84,40.89],heal:[60.16,42.45],defeat:[70.56,76.13]},
    guard:{idle:[70.31,41.67],hit:[66.8,47.66],attack:[56.25,45.83],guard:[66.41,43.75],defeat:[58.45,79.07]},
    awakened:{idle:[40.63,41.67],hit:[41.41,47.14],attack:[34.38,46.61],guard:[33.59,39.84],defeat:[51.84,79.07]},
    archer:{idle:[66.15,39.24],hit:[57.42,42.71],attack:[52.34,39.84],guard:[61.33,40.36],release:[54.69,39.58],defeat:[55.51,82.25]},
    shaman:{idle:[38.02,44.44],hit:[32.03,44.27],attack:[28.13,50.26],guard:[37.5,43.23],heal:[43.75,44.01],defeat:[50.73,80.29]}
  };
  const kneelingAnchors={
    nun:{
      legsOnly:{
        idle:{eyes:[63.39,38.69],belly:[57.59,64.58],legs:[70.54,83.33],arms:[65.63,54.17]},
        attack:{eyes:[65.63,41.37],belly:[50.89,65.48],legs:[65.18,81.55],arms:[74.11,51.19]},
        guard:{eyes:[66.07,38.69],belly:[52.68,63.69],legs:[70.54,81.55],arms:[62.05,53.57]},
        hit:{eyes:[55.36,38.1],belly:[55.36,62.5],legs:[74.55,79.76],arms:[74.11,48.51]}
      },
      armsAndLegs:{
        idle:{eyes:[64.29,38.1],belly:[58.48,63.39],legs:[70.54,83.33],arms:[72.32,53.27]},
        attack:{eyes:[68.3,43.15],belly:[56.7,64.29],legs:[73.21,82.14],arms:[71.88,54.17]},
        guard:{eyes:[66.52,41.07],belly:[55.36,63.69],legs:[68.3,81.55],arms:[71.43,54.46]},
        hit:{eyes:[47.77,37.5],belly:[52.23,62.5],legs:[68.3,80.65],arms:[72.77,49.7]}
      }
    },
    guard:{
      legsOnly:{
        idle:{eyes:[57.14,38.39],belly:[55.8,64.29],legs:[62.95,85.42],arms:[66.52,54.76]},
        attack:{eyes:[64.73,42.86],belly:[54.46,65.77],legs:[63.39,85.12],arms:[67.86,56.55]},
        guard:{eyes:[62.05,41.07],belly:[50.45,65.18],legs:[63.39,85.42],arms:[56.7,52.68]},
        hit:{eyes:[50.89,41.96],belly:[50.89,64.29],legs:[65.18,84.82],arms:[62.95,50]}
      },
      armsAndLegs:{
        idle:{eyes:[59.82,39.58],belly:[57.59,63.1],legs:[68.75,81.25],arms:[66.96,56.55]},
        attack:{eyes:[63.39,45.54],belly:[51.79,67.26],legs:[61.16,84.52],arms:[65.18,58.33]},
        guard:{eyes:[62.95,40.48],belly:[53.57,64.58],legs:[68.75,83.33],arms:[68.3,56.25]},
        hit:{eyes:[51.34,41.67],belly:[58.93,64.29],legs:[73.66,81.55],arms:[67.86,55.95]}
      }
    },
    awakened:{
      legsOnly:{
        idle:{eyes:[59.38,37.5],belly:[55.36,66.07],legs:[71.88,82.44],arms:[39.73,57.44]},
        attack:{eyes:[66.96,41.96],belly:[53.57,65.77],legs:[68.3,80.95],arms:[38.84,54.76]},
        guard:{eyes:[57.59,37.8],belly:[55.36,66.67],legs:[68.75,81.55],arms:[46.88,55.36]},
        hit:{eyes:[54.91,37.5],belly:[54.02,65.18],legs:[74.11,82.14],arms:[43.75,54.17]}
      },
      armsAndLegs:{
        idle:{eyes:[61.16,36.61],belly:[57.14,65.77],legs:[71.88,85.42],arms:[44.64,55.65]},
        attack:{eyes:[62.05,41.96],belly:[50.89,66.37],legs:[65.63,83.93],arms:[42.86,56.85]},
        guard:{eyes:[59.82,38.39],belly:[56.25,67.56],legs:[70.98,84.82],arms:[44.2,55.65]},
        hit:{eyes:[53.13,38.39],belly:[58.04,66.37],legs:[73.66,82.14],arms:[44.64,53.87]}
      }
    },
    archer:{
      legsOnly:{
        idle:{eyes:[59.82,38.1],belly:[61.61,63.39],legs:[66.07,82.74],arms:[73.21,61.9]},
        attack:{eyes:[59.38,39.88],belly:[56.25,64.29],legs:[64.29,81.25],arms:[75,51.79]},
        guard:{eyes:[62.95,37.8],belly:[57.59,63.39],legs:[68.3,82.44],arms:[71.88,52.98]},
        hit:{eyes:[54.02,38.1],belly:[55.8,62.8],legs:[65.18,80.06],arms:[70.54,58.63]}
      },
      armsAndLegs:{
        idle:{eyes:[62.5,39.58],belly:[61.61,65.48],legs:[68.75,82.44],arms:[71.88,57.74]},
        attack:{eyes:[62.95,41.67],belly:[56.25,64.88],legs:[66.07,84.23],arms:[71.43,57.14]},
        guard:{eyes:[62.05,39.88],belly:[57.59,66.07],legs:[69.64,82.44],arms:[72.32,54.76]},
        hit:{eyes:[56.25,38.99],belly:[55.8,65.18],legs:[69.64,81.55],arms:[70.54,55.36]}
      }
    },
    shaman:{
      legsOnly:{
        idle:{eyes:[56.7,39.88],belly:[58.93,66.67],legs:[64.73,81.55],arms:[43.75,61.31]},
        attack:{eyes:[57.59,47.32],belly:[48.66,69.64],legs:[60.27,81.55],arms:[37.95,60.71]},
        guard:{eyes:[57.14,42.56],belly:[58.93,67.56],legs:[68.3,81.85],arms:[34.38,61.9]},
        hit:{eyes:[54.91,38.69],belly:[59.38,64.88],legs:[69.64,79.46],arms:[43.75,57.44]}
      },
      armsAndLegs:{
        idle:{eyes:[58.93,41.07],belly:[59.82,69.05],legs:[69.64,85.12],arms:[45.54,61.31]},
        attack:{eyes:[56.7,49.4],belly:[49.55,70.24],legs:[58.48,84.52],arms:[38.84,61.31]},
        guard:{eyes:[54.46,43.45],belly:[57.14,67.86],legs:[68.3,84.23],arms:[41.07,58.93]},
        hit:{eyes:[57.14,42.26],belly:[56.7,66.96],legs:[74.11,82.14],arms:[41.52,59.23]}
      }
    }
  };
  const woundPoseAnchors={
    nun:{idle:[56,23,48,53,60,76],attack:[55,33,39,61,64,76],hit:[47,34,52,63,71,79],guard:[59,28,48,56,65,76],heal:[55,29,46,57,55,75],defeat:[80,65,33,79,11,81]},
    guard:{idle:[59,23,50,52,63,78],attack:[53,33,47,60,57,80],hit:[49,33,50,60,73,81],guard:[58,29,50,58,70,79],defeat:[66,76,38,78,18,84]},
    awakened:{idle:[57,21,52,48,66,75],attack:[53,32,39,54,65,78],hit:[48,36,55,60,73,78],guard:[60,23,55,53,70,79],defeat:[78,72,43,76,27,87]},
    archer:{idle:[57,21,49,51,54,75],attack:[42,23,35,51,59,75],hit:[43,29,55,57,60,79],guard:[52,25,49,52,65,77],release:[42,23,38,49,59,75],defeat:[73,75,41,78,18,84]},
    shaman:{idle:[57,25,49,51,63,78],attack:[44,38,36,60,56,82],hit:[42,28,50,57,65,80],guard:[54,28,48,58,73,78],heal:[53,26,49,55,61,79],defeat:[83,75,41,79,23,87]}
  };

  const woundSprites=Object.fromEntries(["scratch","wrap"]
    .map(id=>[id,`art/characters/conditions/wounds/${id}.webp`]));
  const eyeLossAnchors={
    nun:{
      upright:{idle:[58.8,22,-1,18.5],attack:[62.9,32.9,-4,18.5],hit:[47.9,32.4,-10,19.5],guard:[62.5,26.8,-3,18.2],heal:[53.6,28.9,2,19.7],defeat:[75.1,71.6,22,13.5]},
      armsOnly:{defeat:[77.1,72.6,27,13.5]},
      legsOnly:{idle:[64.8,38.4,-5,17.7],attack:[67.3,41.6,-3,18],hit:[55.3,37.5,-12,18.7],guard:[66.3,38.6,-8,19]},
      armsAndLegs:{idle:[65.1,37.8,1,18.3],attack:[72.8,42,-12,17.2],hit:[51.6,37.5,-24,18.7],guard:[68,40.7,-4,19]},
    },
    guard:{
      upright:{idle:[60.8,23.4,-1,18.7],attack:[57.8,33.3,6,18],hit:[50.1,32.1,-25,17.3],guard:[62.9,28.6,1,18.8],defeat:[59.4,81.2,36,11.5]},
      armsOnly:{defeat:[66.1,80.8,40,12]},
      legsOnly:{idle:[57.8,38.9,-1,18.2],attack:[66.6,43.8,-2,17.1],hit:[51.3,41.1,-12,18.2],guard:[62.6,42.1,2,18]},
      armsAndLegs:{idle:[61.3,40.3,2,18.7],attack:[65.4,43.8,15,18.1],hit:[53.7,41.2,-17,17.9],guard:[63.3,41,0,17.2]},
    },
    awakened:{
      upright:{idle:[58.1,20.4,7,19.1],attack:[59.8,29.7,5,19],hit:[48.6,28.4,-19,19.3],guard:[62.5,23.5,9,19.1],defeat:[77,79.4,18,12]},
      armsOnly:{defeat:[76.2,80.3,18,12.8]},
      legsOnly:{idle:[60.7,37.2,2,18.5],attack:[66.9,40.5,11,18.3],hit:[47.4,36.2,-31,18.8],guard:[60.3,37.6,9,18.6]},
      armsAndLegs:{idle:[60.2,37,11,19.4],attack:[66.1,41.3,4,18.8],hit:[50.2,35.7,-29,19.5],guard:[61,37.6,5,18]},
    },
    archer:{
      upright:{idle:[57,22.3,7,18.9],attack:[48,24.4,6,18.2],hit:[47.2,26.6,-9,19.6],guard:[58.5,25.5,11,18.2],release:[47.9,24.3,5,18.7],defeat:[74.9,80.2,40,13]},
      armsOnly:{attack:[47.9,23,6,18.2],release:[47.8,22.9,5,18.7],defeat:[78.1,81.9,38,13]},
      legsOnly:{idle:[60.8,39,7,18.6],attack:[59.6,40.3,4,17.7],hit:[55.3,37.5,-15,17.7],guard:[65.8,37.9,8,18.3]},
      armsAndLegs:{idle:[63.5,39.7,5,19.2],attack:[67.2,41.8,4,18.5],hit:[57.4,38.2,-10,20],guard:[65,39.4,10,18.3]},
    },
    shaman:{
      upright:{idle:[56.3,22.3,6,19.2],attack:[50.3,36.9,-9,18.8],hit:[44.7,29.5,-20,20],guard:[58.1,27.1,2,18.2],heal:[57.2,24.5,6,18.6],defeat:[76,81.6,30,13]},
      armsOnly:{defeat:[75.2,82.3,29,13]},
      legsOnly:{idle:[59.1,40.4,4,18.4],attack:[60.8,47.3,-13,17.9],hit:[54.7,42.2,-23,19.7],guard:[60,42.5,2,18]},
      armsAndLegs:{idle:[62.2,41.5,5,18.8],attack:[58.9,48.6,-11,18.5],hit:[56.6,42.9,-23,18.8],guard:[57.8,43,1,17.7]},
    },
  };
  return {pursuitWarningDistance, categories, icons, bodyAnchors, partyArt, motionArt, armLossAnchors, kneelingAnchors, woundPoseAnchors, woundSprites, eyeLossAnchors};
}
