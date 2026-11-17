export const RACES = [
  { id:'human', name:'인간', hp:56, power:8, scout:8, luck:6, flavor:'평범한 태생도, 특별한 모험을 할 수 있습니다.' },
  { id:'elf', name:'엘프', hp:47, power:7, scout:13, luck:7, flavor:'어둠 속 작은 흔적도 놓치지 않는 눈을 가졌습니다.' },
  { id:'dwarf', name:'드워프', hp:66, power:10, scout:6, luck:4, flavor:'단단한 몸과 돌벽 너머를 듣는 감각을 가졌습니다.' },
  { id:'goblin', name:'고블린', hp:45, power:6, scout:11, luck:10, flavor:'작은 몸으로, 남들이 지나친 틈새를 찾아냅니다.' },
  { id:'undead', name:'언데드', hp:60, power:9, scout:7, luck:5, flavor:'이미 한 번 죽었지만, 이번 모험은 처음입니다.' }
];
// These describe existing race mechanics; the two random traits are separate.
export const RACE_DETAILS = Object.freeze({
  human:{summary:'균형 잡힌 능력 · 길드 수입 +3 G',event:'종족 사건: 모험가의 수첩 발견 · 탐색력 +2',detail:'기본 체력 56 / 전투력 8 / 탐색력 8 / 행운 6. 길드 직원 생활 수입 +3 G.'},
  elf:{summary:'높은 탐색력 · 숲의 문양으로 회복',event:'종족 사건: 탐색력 +2 · 체력 +8',detail:'기본 체력 47 / 전투력 7 / 탐색력 13 / 행운 7. 숲의 문양 사건에서 탐색력과 체력을 얻습니다.'},
  dwarf:{summary:'높은 체력·전투력 · 장인 수입 +3 G',event:'종족 사건: 숨겨진 광맥 발견 · 금화 +24',detail:'기본 체력 66 / 전투력 10 / 탐색력 6 / 행운 4. 장인 생활 수입 +3 G, 위험한 제작 성공 확률 +15%p.'},
  goblin:{summary:'높은 행운 · 상인 수입 +3 G',event:'종족 사건: 벽 낙서의 비밀 · 금화 +20',detail:'기본 체력 45 / 전투력 6 / 탐색력 11 / 행운 10. 상인 생활 수입 +3 G.'},
  undead:{summary:'망령에게 받는 피해 -3 · 여관 수입 +3 G',event:'종족 사건: 탐험당 한 번 망자의 기억 · 전투력 +2',detail:'기본 체력 60 / 전투력 9 / 탐색력 7 / 행운 5. 이름에 망령이 포함된 적의 피해가 3 줄어듭니다(최소 피해 1). 망자의 기억은 탐험당 한 번 전투력 +2. 여관주인 생활 수입 +3 G.'}
});
export const JOBS = [
  { id:'warrior', name:'전사', hp:9, power:7, scout:0, luck:0, weapons:['이가 빠진 장검','낡은 도끼','묵직한 철퇴'] },
  { id:'rogue', name:'도적', hp:0, power:3, scout:7, luck:2, weapons:['날이 얇은 단검','구부러진 도검','독 묻은 칼'] },
  { id:'mage', name:'마법사', hp:-3, power:9, scout:2, luck:1, weapons:['금 간 마법봉','참나무 지팡이','별빛 수정구'] },
  { id:'priest', name:'사제', hp:5, power:4, scout:1, luck:3, weapons:['빛바랜 성서','은빛 성물','오래된 기도봉'] },
  { id:'porter', name:'짐꾼', hp:12, power:1, scout:4, luck:2, weapons:['튼튼한 곡괭이','접이식 삽','손때 묻은 망치'] }
];
export const TRAITS = [
  { id:'greedy', name:'탐욕', negative:true, tip:'보물을 더 많이 발견하지만, 저주받은 상자의 유혹도 커집니다.' },
  { id:'coward', name:'겁쟁이', negative:true, tip:'자동 선택 시 안전을 우선하며, 강한 적에게서 도망치기 쉽습니다.' },
  { id:'unlucky', name:'불운', negative:true, tip:'행운 -4. 함정과 좋지 않은 사건의 비중이 늘어납니다.' },
  { id:'lost', name:'길치', negative:true, tip:'탐색력 -3. 길을 헤매거나 우연히 숨겨진 방을 발견합니다.' },
  { id:'frail', name:'허약', negative:true, tip:'최대 체력 -10. 대신 위험한 길을 살피는 탐색력 +2.' },
  { id:'regen', name:'재생', tip:'새로운 탐험 구간에 들어갈 때 체력 2를 회복합니다.' },
  { id:'lucky', name:'행운아', tip:'행운 +5. 희귀한 보물과 좋은 결과의 가능성이 커집니다.' },
  { id:'brave', name:'대담', tip:'전투력 +3. 자동 선택 시 도전과 더 깊은 탐험을 선호합니다.' },
  { id:'sharp', name:'예리함', tip:'탐색력 +5. 함정을 발견하고 비밀을 알아차리기 쉽습니다.' },
  { id:'blessed', name:'신의 총애', tip:'행운 +2. 첫 치명상에서 체력 1로 살아남습니다.' }
];
export const FLOORS = ['이끼 낀 회랑','잊힌 저장고','속삭이는 지하묘지','봉인의 성소','검은 왕의 옥좌'];
const NAMES = ['루엔','모르','에린','노아','바린','카일','이브','라온','세라','테오','하린','로웬','미르','아샤','오르'];
const MONSTERS = [
  ['슬라임','동굴 거미','녹슨 갑옷병'],['하수도 쥐 떼','굶주린 코볼트','돌껍질 벌레'],
  ['해골 궁수','울부짖는 망령','묘지의 파수꾼'],['봉인의 수호자','그림자 사냥꾼','검은 사제'],['왕의 근위병','심연의 짐승','머리 없는 기사']
];
const SCENES = [
  ['벽의 이끼 사이로 희미한 빛이 새어 나옵니다.','물방울 소리 외에는 아무것도 들리지 않습니다.','누군가 남긴 횃불이 아직 따뜻합니다.'],
  ['무너진 선반 아래 오래된 발자국이 남아 있습니다.','빈 술통 속에서 작은 소리가 들립니다.','먼지 쌓인 바닥에 무언가 끌린 자국이 있습니다.'],
  ['비석에 새겨진 이름이 잠시 자신의 이름처럼 보입니다.','누군가 뒤에서 이름을 불렀지만 아무도 없습니다.','벽 너머의 속삭임이 발걸음을 따라옵니다.'],
  ['부서진 제단 위에 촛불 하나가 타고 있습니다.','돌문에 새겨진 봉인이 희미하게 흔들립니다.','공기 속에서 금속과 향 냄새가 납니다.'],
  ['옥좌를 향해 검은 깃털이 흩어져 있습니다.','바닥의 균열 사이로 뜨거운 바람이 올라옵니다.','미궁의 심장 소리가 점점 커집니다.']
];
const TREASURES = ['은빛 반지','별무늬 부적','달빛 단검','수호자의 방패','오래된 지도','바람의 장화','붉은 보석','지혜의 렌즈','황금 왕관','말하는 검'];
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const particle = (word, withBatchim, withoutBatchim) => {
  const code=word.charCodeAt(word.length-1)-0xAC00;
  return word+(code>=0 && code<=11171 && code%28!==0 ? withBatchim : withoutBatchim);
};

export class Dungeon {
  constructor(seed = Date.now() >>> 0, {deferJob=false}={}) {
    this.s = { version:1, seed:seed>>>0, status:'ready', floor:0, room:0, maxFloor:0, gold:0, potions:2, log:[], queue:[], choice:null, flags:{}, inventory:[], roomsExplored:0, kills:0, choicesMade:0, serial:0, outcome:null };
    const race=this.pick(RACES), job=deferJob?{id:'child',hp:0,power:0,scout:0,luck:0}:this.pick(JOBS), traits=this.shuffle(TRAITS).slice(0,2);
    this.s.character = { name:this.pick(NAMES), race:race.id, job:job.id, traits:traits.map(t=>t.id), maxHp:race.hp+job.hp+this.int(0,6), power:race.power+job.power+this.int(0,3), scout:race.scout+job.scout+this.int(0,3), luck:race.luck+job.luck+this.int(0,3) };
    const c=this.s.character;
    if(this.has('unlucky'))c.luck-=4;
    if(this.has('lucky'))c.luck+=5;
    if(this.has('lost'))c.scout-=3;
    if(this.has('frail')){c.maxHp-=10;c.scout+=2;}
    if(this.has('brave'))c.power+=3;
    if(this.has('sharp'))c.scout+=5;
    if(this.has('blessed'))c.luck+=2;
    c.scout=Math.max(1,c.scout);c.luck=Math.max(1,c.luck);
    this.s.hp=c.maxHp;
    this.s.inventory=deferJob?[]:[this.pick(job.weapons)];
    if(deferJob)this.s.potions=0;
    this.s.id=`${seed.toString(16)}-${c.name}-${race.id}-${job.id}`;
  }
  static restore(raw) {
    const child=raw?.character?.job==='child'&&raw?.world?.mode==='childhood'&&raw?.life?.version===1;
    if(!raw || raw.version!==1 || !['ready','running','choice','ended'].includes(raw.status) || !raw.character || !RACES.some(r=>r.id===raw.character.race) || !(child||JOBS.some(j=>j.id===raw.character.job)) || !Array.isArray(raw.character.traits) || raw.character.traits.length!==2 || !raw.character.traits.every(t=>TRAITS.some(q=>q.id===t)) || !Array.isArray(raw.log) || !Array.isArray(raw.queue) || !Array.isArray(raw.inventory) || !raw.flags || !Number.isFinite(raw.hp) || !Number.isFinite(raw.seed) || !Number.isFinite(raw.character.maxHp) || raw.character.maxHp<=0 || !Number.isInteger(raw.floor) || raw.floor<0 || raw.floor>(raw.world?8:5) || (raw.status==='choice' && !raw.choice?.options?.length)) throw new Error('저장된 모험을 읽을 수 없습니다.');
    const game=Object.create(Dungeon.prototype);game.s=structuredClone(raw);return game;
  }
  random(){this.s.seed=(this.s.seed+0x6D2B79F5)>>>0;let t=this.s.seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  int(a,b){return a+Math.floor(this.random()*(b-a+1));}
  pick(xs){return xs[this.int(0,xs.length-1)];}
  shuffle(xs){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=this.int(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
  chance(p){return this.random()<clamp(p,0,1);}
  has(id){return this.s.character.traits.includes(id);}
  race(){return RACES.find(x=>x.id===this.s.character.race);}
  job(){return JOBS.find(x=>x.id===this.s.character.job);}
  get character(){return this.s.character;}
  floorCount(){return this.floorNames().length;}
  roomCount(){return 6;}
  landmark(){if(this.s.floor===1&&this.s.room===3)return 'chest';if(this.s.floor===3&&this.s.room===3)return 'traveler';return null;}
  floorNames(){return FLOORS;}
  monstersAt(){return MONSTERS[Math.min(this.s.floor-1,MONSTERS.length-1)];}
  sceneAt(){return SCENES[Math.min(this.s.floor-1,SCENES.length-1)];}
  bossName(){return '검은 왕';}
  bossReward(){return 100;}
  bossLoot(){return '검은 왕의 왕관';}
  danger(){return 1.12;}
  bossStrength(){return (9+this.floorCount()*4)*this.danger();}
  bossWinChance(){return clamp(.8+(this.character.power-this.bossStrength())*.018+(this.s.flags.secret?.15:0),.15,.98);}
  enqueue(text,kind='normal',delta={},extra={}){this.s.queue.push({floor:this.s.floor,text,kind,delta,...extra});}
  emit(text,kind='normal',delta={},extra={}){
    const s=this.s;
    s.hp=clamp(s.hp+(delta.hp||0),0,this.character.maxHp);
    if(extra.kill&&s.hp>0)s.kills++;
    s.gold=Math.max(0,s.gold+(delta.gold||0));s.potions=Math.max(0,s.potions+(delta.potions||0));
    if(delta.power)this.character.power=Math.max(1,this.character.power+delta.power);
    if(delta.scout)this.character.scout=Math.max(1,this.character.scout+delta.scout);
    if(delta.luck)this.character.luck=Math.max(1,this.character.luck+delta.luck);
    if(extra.item && !s.inventory.includes(extra.item))s.inventory.push(extra.item);
    if(extra.flag)s.flags[extra.flag]=true;
    s.log.push({floor:extra.floor??s.floor,text:String(text).replace(/[\r\n]+/g,' '),kind,n:s.log.length+1});
    if(extra.finish){this.finish(extra.finish,text);return;}
    if(s.hp===0){
      if(this.has('blessed') && !s.flags.saved){s.hp=1;s.flags.saved=true;s.queue.unshift({floor:s.floor,text:'신의 빛이 치명상을 막았습니다. 체력 1로 살아남았습니다.',kind:'rare',delta:{}});s.choice=null;s.status='running';}
      else{s.queue=[{floor:s.floor,text:`${this.character.name}의 발걸음이 여기서 멈췄습니다. 모험이 끝났습니다.`,kind:'bad',delta:{},finish:'death'}];s.flags.deathCause=text;s.choice=null;s.status='running';}
    }
  }
  finish(type,text){const s=this.s;s.status='ended';s.queue=[];s.choice=null;s.outcome={type,title:this.resultTitle(type),floor:s.maxFloor,recoveredGold:type==='death'?Math.floor(s.gold*.25):s.gold,cause:type==='death'?s.flags.deathCause:text,at:new Date().toISOString()};}
  resultTitle(type){if(type==='clear')return this.has('coward')?'겁을 이겨낸 미궁 정복자':'검은 왕의 옥좌를 넘어선 자';if(type==='return')return this.has('greedy')?'보물을 품고 돌아온 자':'돌아올 때를 알았던 모험가';if(this.s.flags.cursed)return '상자의 유혹을 이기지 못한 자';if(this.s.flags.helped)return '어둠 속에 친절을 남긴 자';if(this.s.maxFloor>=4)return '심연의 문턱에서 멈춘 자';return '미궁에 이름을 남긴 자';}
  start(){if(this.s.status!=='ready')return false;this.s.status='running';this.s.startedAt=new Date().toISOString();this.emit(`${this.race().name} ${this.job().name} ${particle(this.character.name,'이','가')} 미궁의 문을 열었습니다.`,'big');this.enqueue(`특성: ${this.character.traits.map(id=>TRAITS.find(t=>t.id===id).name).join(' · ')}. 운명은 아직 정해지지 않았습니다.`,'note');return true;}
  step(){
    const s=this.s;if(s.status!=='running')return false;
    if(s.queue.length){if(s.queue[0].bossAttack&&s.hp<=this.character.maxHp*.35&&s.potions>0){this.drinkPotion();return true;}const e=s.queue.shift();this.emit(e.text,e.kind,e.delta,e);return true;}
    if(s.floor===0){s.floor=1;s.maxFloor=Math.max(s.maxFloor,1);this.emit(`${this.floorNames()[0]}에 들어섰습니다. 탐험이 시작됩니다.`,'big');return true;}
    if(s.room>=this.roomCount()){if(s.floor>=this.floorCount())this.setChoice('boss');else this.setChoice('stairs');return true;}
    if(s.hp<=this.character.maxHp*.35 && s.potions>0){this.drinkPotion();return true;}
    s.room++;s.roomsExplored++;
    if(this.has('regen'))s.hp=Math.min(this.character.maxHp,s.hp+2);
    if(s.flags.cursed && this.chance(.3)){this.enqueue('상자의 저주가 살갗을 파고듭니다. 체력 -3.','bad',{hp:-3});}
    const landmark=this.landmark();if(landmark){this.setChoice(landmark);return true;}
    if(s.floor===4 && s.flags.helped && !s.flags.repaid){s.flags.repaid=true;s.flags.secret=true;this.emit('살려준 고블린이 비밀 통로와 물약을 건넸습니다. 회복 물약 +1.','rare',{potions:1});return true;}
    if(this.has('lost') && this.chance(.12)){this.lostEvent();return true;}
    if(this.chance(.004+s.floor*.0012+(this.danger()-1)*.002)){this.disaster();return true;}
    const weights=[40,20+(this.has('greedy')?9:0),15+(this.has('unlucky')?8:0),10,10,5+this.character.luck*.15];
    let draw=this.random()*weights.reduce((a,b)=>a+b,0),type=0;for(;type<weights.length-1;type++){draw-=weights[type];if(draw<0)break;}
    [()=>this.combat(),()=>this.loot(),()=>this.trap(),()=>this.rest(),()=>this.encounter(),()=>this.rare()][type]();
    return true;
  }
  combat(){
    const s=this.s,c=this.character,m=this.pick(this.monstersAt()),strength=(7+s.floor*3.2+this.int(-2,3))*this.danger();
    this.emit(`${particle(m,'과','와')} 마주쳤습니다.`);
    if(this.has('coward') && strength>c.power && this.chance(.5)){if(this.chance(.55+c.scout*.012)){this.enqueue(`겁에 질려 샛길로 달아났습니다. ${m}의 추적을 따돌렸습니다.`,'note');return;}this.enqueue('도망치다 발을 헛디뎠습니다. 체력 -4.','bad',{hp:-4});}
    const crit=this.chance(clamp(.06+c.luck*.006,.06,.22)),job=c.job;
    const won=this.chance(clamp(.85+(c.power-strength)*.016,.25,.97));
    const ambush=this.chance(clamp(.045+s.floor*.008-c.scout*.0015,.025,.12));
    let damage=Math.max(2,Math.round(strength*.62-c.power*.34+this.int(-2,4)));
    if(!won)damage=Math.round(damage*1.3);
    if(ambush)damage=Math.round(damage*1.7+this.int(3,8));
    if(crit)damage=Math.max(1,Math.floor(damage*.45));
    if(c.race==='undead' && m.includes('망령'))damage=Math.max(1,damage-3);
    const attack=job==='mage'?'마법으로':job==='priest'?'성스러운 빛으로':job==='rogue'?'빈틈을 찔러':job==='porter'?'도구를 휘둘러':'무기를 휘둘러';
    const gold=this.int(3,8)+s.floor*2;
    this.enqueue(`${ambush?'사각에서 기습을 당했습니다! ':''}${m}의 공격에 맞섰습니다. 체력 -${damage}.`,ambush||!won?'bad':'normal',{hp:-damage});
    if(won)this.enqueue(`${crit?'급소를 노렸습니다! ':''}${attack} ${particle(m,'을','를')} 물리쳤습니다. 금화 +${gold}.`,crit?'good':'normal',{gold},{kill:true});
    else this.enqueue(`${m}에게 밀려 간신히 도망쳤습니다. 전리품을 얻지 못했습니다.`,'bad');
  }
  drinkPotion(){const heal=Math.min(25,this.character.maxHp-this.s.hp);this.emit(`회복 물약을 마셨습니다. 체력 +${heal}.`,'good',{hp:heal,potions:-1});}
  disaster(){
    const c=this.character;
    if(this.chance(clamp(.18+c.scout*.018+c.luck*.004,.2,.75))){this.emit('갑자기 천장이 무너졌습니다! 작은 균열을 알아채고 간신히 피했습니다.','note');return;}
    const damage=Math.round((this.int(24,42)+this.s.floor*2)*this.danger());
    this.emit(`예고 없이 무너진 천장에 휩쓸렸습니다. 체력 -${damage}.`,'bad',{hp:-damage});
  }
  loot(){
    const s=this.s;
    if(this.chance(.12)){this.emit('버려진 배낭에서 회복 물약을 발견했습니다. 회복 물약 +1.','good',{potions:1});return;}
    if(this.chance(.18+this.character.luck*.007)){const item=this.pick(TREASURES.slice(0,s.floor+5));const power=s.inventory.includes(item)?0:['검','단검'].some(w=>item.includes(w))?3:1;this.emit(`「${item}」${particle(item,'을','를').slice(item.length)} 발견했습니다. ${power?`전투력 +${power}.`:'이미 익힌 장비라 전투력은 그대로입니다.'}`,'good',{power},{item});if(item==='말하는 검'&&power)this.enqueue('말하는 검이 자세를 비웃었습니다. 하지만 경고는 제법 쓸 만합니다.','rare',{scout:2});return;}
    const gold=this.int(7,16)+s.floor*3+(this.has('greedy')?5:0);this.emit(`벽 틈에서 금화 ${gold}개를 발견했습니다.`,'good',{gold});
  }
  trap(){const s=this.s;const p=clamp(.2+this.character.scout*.025+(this.character.job==='rogue'?.15:0)-s.floor*.015,.15,.82);if(this.chance(p)){this.emit('바닥의 수상한 틈을 발견했습니다. 함정을 피해 지나갑니다.','good');}else{const damage=Math.round((this.int(5,10)+s.floor*1.5)*this.danger());this.emit(`${this.pick(['숨겨진 가시','천장에서 떨어진 돌','벽에서 튀어나온 화살'])}에 다쳤습니다. 체력 -${damage}.`,'bad',{hp:-damage});}}
  rest(){const heal=Math.min(this.int(7,12)+(this.character.job==='priest'?4:0),this.character.maxHp-this.s.hp);this.emit(heal>0?`안전한 틈새에서 숨을 골랐습니다. 체력 +${heal}.`:'안전한 틈새에서 숨을 골랐습니다. 아직 몸 상태는 좋습니다.',heal>0?'good':'note',{hp:heal});}
  encounter(){
    if(this.s.floor>=2 && !this.s.flags.merchant && this.s.gold>=20 && this.chance(.4)){this.setChoice('merchant');return;}
    if(this.chance(.25)){const gold=this.int(3,8);this.emit(`길을 잃은 유령에게 출구를 알려줬습니다. 답례로 금화 ${gold}개를 받았습니다.`,'good',{gold});return;}
    this.emit(this.pick(this.sceneAt()),'note');
  }
  lostEvent(){if(this.chance(.35+this.character.luck*.01)){const gold=this.int(15,25);this.emit(`길을 잘못 들었다가 숨겨진 방을 발견했습니다. 금화 +${gold}.`,'rare',{gold});}else{this.emit('같은 복도를 맴돌다 지쳤습니다. 체력 -3.','bad',{hp:-3});}}
  rare(){
    const c=this.character,s=this.s;
    if(s.floor>=2 && !s.flags.shrine && this.chance(.35)){this.setChoice('shrine');return;}
    if(c.race==='dwarf'){this.emit('돌벽의 울림으로 숨겨진 광맥을 찾았습니다. 금화 +24.','rare',{gold:24});return;}
    if(c.race==='elf'){this.emit('오래된 숲의 문양이 빛났습니다. 탐색력 +2, 체력 +8.','rare',{scout:2,hp:8});return;}
    if(c.race==='undead'){if(!s.flags.undeadMemory){this.emit('망자의 기억이 스며들었습니다. 전투력 +2.','rare',{power:2},{flag:'undeadMemory'});}else this.emit('이미 떠올린 망자의 기억이 희미하게 스쳐 갑니다.','note');return;}
    if(c.race==='goblin'){this.emit('고블린만 읽을 수 있는 벽 낙서를 발견했습니다. 금화 +20.','rare',{gold:20});return;}
    this.emit('먼저 떠난 모험가의 수첩을 발견했습니다. 탐색력 +2.','rare',{scout:2},{item:'모험가의 수첩'});
  }
  setChoice(kind){
    const s=this.s,c=this.character;let prompt,options;
    const option=(id,label,hint,bias)=>({id,label,hint,bias});
    if(kind==='chest'){
      prompt='봉인된 상자를 발견했습니다. 틈새로 검은 연기가 새어 나옵니다.';
      options=[option('open','상자를 연다','금화 35~60 · 폭발·저주 위험','greed'),option('inspect',c.job==='priest'?'성물로 정화한다':c.job==='rogue'?'봉인을 해제한다':'봉인을 살펴본다',`탐색력 ${c.scout} · 실패 시 체력 -${Math.round(7*this.danger())}`,'smart'),option('skip','지나친다','안전하게 탐험 계속','safe')];
    }else if(kind==='traveler'){
      prompt='빈사 상태의 고블린이 비밀 통로를 알려주겠다고 합니다.';
      options=[option('help','물약으로 치료한다',s.potions>0?'물약 1병 · 나중에 보답 가능':'물약이 없어 선택 불가','kind'),option('threat','위협해 정보를 얻는다',`전투력 ${c.power} · 실패 시 체력 -6`,'bold'),option('skip','지나친다','자원을 아끼고 탐험 계속','safe')];options[0].disabled=s.potions<1;
    }else if(kind==='stairs'){
      prompt=`${s.floor}층의 끝에 도착했습니다. 아래로 이어지는 계단이 보입니다.`;
      options=[option('descend',`${s.floor+1}층으로 내려간다`,'더 큰 보물 · 더 강한 적','bold'),option('return','보물을 챙겨 귀환한다',`금화 ${s.gold}개 전액 회수`,'safe')];
    }else if(kind==='merchant'){
      prompt='수상한 상인이 회복 물약을 내밀었습니다. 가격은 금화 20개입니다.';
      options=[option('buy','물약을 산다','금화 -20 · 물약 +1','smart'),option('skip','거래하지 않는다','금화를 아끼고 지나가기','greed')];s.flags.merchant=true;
    }else if(kind==='shrine'){
      prompt='낡은 제단이 피 한 방울을 요구합니다. 문양이 희미하게 빛납니다.';
      options=[option('offer','피를 바친다','체력 -10 · 전투력 +4','bold'),option('pray','조용히 기도한다',c.job==='priest'?'사제의 기도 · 체력 +15':'신의 응답은 확률에 따라','kind'),option('skip','제단을 떠난다','안전하게 탐험 계속','safe')];s.flags.shrine=true;
    }else{
      prompt=s.flags.secret?`비밀 통로가 ${this.bossName()}의 등 뒤로 이어집니다. 결전의 순간입니다.`:`${this.bossName()}이 모습을 드러냈습니다. 마지막 갈림길입니다.`;
      options=[option('fight',`${this.bossName()}에게 도전한다`,`전투력 ${c.power} · 공격을 버틴 뒤 제압 가능성 ${Math.round(this.bossWinChance()*100)}% · 연속 공격·사망 위험${s.flags.secret?' · 비밀 통로 기습':''}`,'bold'),option('return','지금 귀환한다',`금화 ${s.gold}개 전액 회수`,'safe')];
    }
    s.choice={id:++s.serial,kind,prompt,options};s.status='choice';this.emit(prompt,'choice');
  }
  choose(id){
    const s=this.s,ch=s.choice;if(s.status!=='choice' || !ch)return false;
    const option=ch.options.find(x=>x.id===id);if(!option || option.disabled)return false;
    s.status='running';s.choice=null;s.choicesMade++;this.emit(`선택: ${option.label}.`,'choice');
    const kind=ch.kind;
    if(id==='return'){this.enqueue(`지상으로 돌아왔습니다. 금화 ${s.gold}개와 모험의 기억을 가져왔습니다.`,'good',{}, {finish:'return'});return true;}
    if(kind==='stairs'){s.floor++;s.maxFloor=Math.max(s.maxFloor,s.floor);s.room=0;this.enqueue(`${this.floorNames()[s.floor-1]}에 들어섰습니다. 공기가 더 차가워집니다.`,'big');return true;}
    if(kind==='chest'){
      if(id==='skip')this.enqueue('검은 연기를 뒤로하고 상자를 지나쳤습니다.','note');
      else if(id==='inspect'){
        const p=this.character.job==='priest'?.9:clamp(.35+this.character.scout*.025+(this.character.job==='rogue'?.15:0),.1,.95);
        if(this.chance(p)){const gold=this.int(30,45);this.enqueue(`봉인을 풀고 안전하게 보물을 얻었습니다. 금화 +${gold}.`,'good',{gold});}
        else{const damage=Math.round(7*this.danger());this.enqueue(`봉인이 튀어 올라 손을 다쳤습니다. 체력 -${damage}. 상자는 닫혔습니다.`,'bad',{hp:-damage});}
      }else{const gold=this.int(35,60);if(this.chance(.18*this.danger())){const damage=Math.round(this.int(15,30)*this.danger());this.enqueue(`탐욕에 손을 뻗는 순간 상자의 봉인이 폭발했습니다. 체력 -${damage}.`,'bad',{hp:-damage});}this.enqueue(`상자를 열어 묵직한 금화를 얻었습니다. 금화 +${gold}.`,'good',{gold});if(this.chance(clamp(.55-this.character.luck*.015,.15,.8)))this.enqueue('상자의 저주가 몸에 깃들었습니다. 탐험 중 체력이 깎일 수 있습니다.','bad',{}, {flag:'cursed'});else this.enqueue('검은 연기가 흩어졌습니다. 저주를 피했습니다.','rare');}
    }else if(kind==='traveler'){
      if(id==='help')this.enqueue('물약을 건네자 고블린이 고개를 숙였습니다. 이 친절을 기억하겠다고 합니다.','good',{potions:-1},{flag:'helped'});
      else if(id==='threat'){if(this.chance(.3+this.character.power*.025))this.enqueue('고블린이 비밀 통로의 위치를 알려줬습니다. 왕에게 기습할 수 있습니다.','good',{}, {flag:'secret'});else this.enqueue('고블린이 마지막 힘으로 반격하고 달아났습니다. 체력 -6.','bad',{hp:-6});}
      else this.enqueue('고블린을 뒤로하고 발걸음을 옮겼습니다.','note');
    }else if(kind==='merchant'){
      if(id==='buy' && s.gold>=20)this.enqueue('상인에게 금화를 건네고 물약을 받았습니다. 금화 -20, 물약 +1.','good',{gold:-20,potions:1});
      else this.enqueue('상인이 어깨를 으쓱하며 어둠 속으로 사라졌습니다.','note');
    }else if(kind==='shrine'){
      if(id==='offer')this.enqueue('피를 받은 제단이 힘을 불어넣었습니다. 체력 -10, 전투력 +4.','rare',{hp:-10,power:4});
      else if(id==='pray'){if(this.character.job==='priest' || this.chance(.3+this.character.luck*.02))this.enqueue('은은한 빛이 상처를 감쌌습니다. 체력 +15.','good',{hp:15});else this.enqueue('기도는 고요한 제단에 닿고 흩어졌습니다.','note');}
      else this.enqueue('제단의 빛이 꺼졌습니다. 발걸음을 재촉했습니다.','note');
    }else if(kind==='boss'){
      this.enqueue(`${this.bossName()}이 공격을 준비합니다. 발밑이 거세게 흔들립니다.`,'big');
      const rounds=this.floorCount()>=7?3:2,strength=this.bossStrength(),won=this.chance(this.bossWinChance());
      for(let round=1;round<=rounds;round++){
        const damage=Math.max(3,Math.round(8+strength*.42-this.character.power*.38+this.int(-3,5)-(s.flags.secret?4:0)));
        this.enqueue(`${s.flags.secret&&round===1?'비밀 통로에서 기습했지만 ':''}${this.bossName()}의 ${round}번째 공격에 맞섰습니다. 체력 -${damage}.`,'bad',{hp:-damage},{bossAttack:true});
      }
      if(won){this.enqueue(`마지막 일격이 적을 꿰뚫었습니다. 금화 +${this.bossReward()}.`,'rare',{gold:this.bossReward()},{item:this.bossLoot()});this.enqueue(`${this.bossName()}이 쓰러졌습니다. ${this.floorCount()}층의 던전을 정복했습니다!`,'big',{}, {finish:'clear'});}
      else{const damage=Math.round(this.int(12,24)*this.danger());this.enqueue(`${this.bossName()}의 마지막 반격에 무너졌습니다. 체력 -${damage}.`,'bad',{hp:-damage});this.enqueue('결전을 이기지 못하고 간신히 던전 밖으로 달아났습니다.','bad',{}, {finish:'return'});}
    }
    return true;
  }
  autoChoice(){
    const ch=this.s.choice;if(!ch)return null;
    const opts=ch.options.filter(x=>!x.disabled),danger=this.s.hp/this.character.maxHp<.42;
    if(danger){const safe=opts.find(x=>x.id==='return')||opts.find(x=>x.id==='buy')||opts.find(x=>x.bias==='safe');if(safe)return safe.id;}
    if(this.has('coward')){const safe=opts.find(x=>x.bias==='safe');if(safe)return safe.id;}
    if(this.has('greedy')){const greed=opts.find(x=>x.bias==='greed');if(greed)return greed.id;}
    if(this.has('brave')){const bold=opts.find(x=>x.bias==='bold');if(bold)return bold.id;}
    if(this.character.job==='priest'){const kind=opts.find(x=>x.bias==='kind')||opts.find(x=>x.id==='inspect');if(kind)return kind.id;}
    if(ch.kind==='stairs' && !danger)return 'descend';
    if(ch.kind==='boss')return this.bossWinChance()>=.55&&this.s.hp>this.character.maxHp*.65?'fight':'return';
    return (opts.find(x=>x.bias==='smart')||opts.find(x=>x.bias==='kind')||opts.find(x=>x.bias==='safe')||opts[0]).id;
  }
}
