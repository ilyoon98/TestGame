import {BodyPart} from "../body/BodyPart.js";

// 부위별 내구도와 전체 체력을 가진 전투원. 수녀·동료·적의 공통 기반이다.
export class Fighter {
  constructor(name, health, vitality, partIds){
    this.name = name;
    this.body = Object.fromEntries(partIds.map((id, index) => [id, new BodyPart(health[index])]));
    this.hp = vitality;
    this.maxHp = vitality;
    this.counter = null;
  }

  // 체력이 끝없이 회복되는 훈련용 적만 true다.
  get infinite(){ return false; }

  isDown(){ return !this.hp || !this.body.head.hp; }

  // 공격을 앞에서 가로막는 장치. 기본 전투원에게는 없다.
  gatePhase(){ return null; }
  isGateClosed(){ return false; }
  interceptHit(){ return null; }
  attackBonus(){ return 0; }

  condition(partId){ return this.body[partId].condition; }

  intactParts(){ return Object.keys(this.body).filter(id => this.body[id].hp > 0); }

  woundedParts(){ return Object.entries(this.body).filter(([, part]) => part.isWounded); }

  guardParts(){ return Object.entries(this.body).filter(([, part]) => part.guard > 0).map(([id, part]) => [id, part.guard]); }

  // 정상이 아닌 부위 목록(연출용 이벤트에 담긴다).
  wounds(){
    return Object.entries(this.body).map(([id, {hp, max}]) => ({id, hp, max, level: this.condition(id)}))
      .filter(part => part.level !== "healthy");
  }

  statusLabel(){
    const parts = Object.values(this.body);
    const lost = parts.filter(part => part.isLost).length;
    const injured = parts.filter(part => part.condition === "injured").length;
    return lost ? `결손 ${lost}` : injured ? `부상 ${injured}` : "정상";
  }

  // 배가 부상이면 받는 회복량이 절반, 결손이면 0이다.
  receivableHealing(amount = 2){
    return {healthy: amount, injured: Math.floor(amount / 2), lost: 0}[this.condition("belly")];
  }

  // 부위 회복량만큼 전체 체력도 회복한다.
  healPart(partId, amount){
    const recovered = this.body[partId].restoreDurability(amount);
    this.hp = Math.min(this.maxHp, this.hp + recovered);
    return recovered;
  }

  // 깎인 내구도만큼 전체 체력이 떨어진다.
  loseVitality(amount){ this.hp = Math.max(0, this.hp - amount); }

  clearDefense(){
    for(const part of Object.values(this.body)) part.guard = 0;
    this.counter = null;
  }

  restore(){
    this.hp = this.maxHp;
    for(const part of Object.values(this.body)) part.reset();
    delete this.mark;
    this.clearDefense();
  }
}
