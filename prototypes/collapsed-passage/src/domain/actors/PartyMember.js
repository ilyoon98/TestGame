import {Fighter} from "./Fighter.js";

// 플레이어 쪽 대원. 진영·직업 특성과 무기를 가진다.
export class PartyMember extends Fighter {
  constructor(profile, kind, partIds){
    super(profile.name, profile.health, profile.vitality, partIds);
    this.kind = kind;
    this.weapon = profile.weapon;
    this.factions = profile.factions;
    this.jobs = profile.jobs;
  }

  get skillSlots(){ return 2; }

  // 수녀가 쓰러지면 판이 끝난다. 동료는 기술 발동만 멈춘다.
  get endsRunWhenDown(){ return false; }

  traits(){ return new Set([...this.factions, ...this.jobs]); }

  hasTrait(id){ return this.factions.includes(id) || this.jobs.includes(id); }
}

export class Nun extends PartyMember {
  constructor(profile, partIds){ super(profile, "nun", partIds); }
  get skillSlots(){ return 3; }
  get endsRunWhenDown(){ return true; }
}

export class Companion extends PartyMember {
  constructor(profile, kind, partIds, loadout){
    super(profile, kind, partIds);
    this.loadout = loadout;
  }
}
