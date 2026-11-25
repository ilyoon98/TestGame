import {seededRandom, shuffle} from "../random.js";

// 시드 지도. 같은 시드와 설정은 같은 방과 연결을 만든다.
// 격리문·승강기실·출구는 고정이고, 그 사이 구간에 방을 배치한다.
export class MapGenerator {
  #standardAreas;
  #mysteryEvents;

  constructor({standardAreas, mysteryEvents}){
    this.#standardAreas = standardAreas;
    this.#mysteryEvents = mysteryEvents;
  }

  generate({seed, widths, shops, rests, elites, mysteries = 0}){
    const standardAreas = this.#standardAreas;
    const random = seededRandom(seed);
    const total = widths.reduce((sum, width) => sum + width, 0);
    const counts = {shop: shops, rest: rests, elite: elites, mystery: mysteries, battle: total - shops - rests - elites - mysteries};
    const map = {threshold: {...standardAreas.threshold, next: []}};
    const battleRooms = ["duct", "infirmary", "landing"].map(id => {
      const {name, foe, arena} = standardAreas[id];
      return {name, foe, arena};
    });
    const specialRooms = {shop: {name: "암시장"}, rest: {name: "휴게소"}, elite: {name: "독방", arena: "solitary", foe: "sentinel"}, mystery: {name: "?"}};
    const eventIds = Object.keys(this.#mysteryEvents);
    const stages = [["threshold"], ...widths.map((width, stage) => {
      const rows = width === 1 ? [2] : shuffle([1, 2, 3], random).slice(0, width).sort((a, b) => a - b);
      return rows.map(row => {
        const id = `room-${stage + 1}-${row}`;
        map[id] = {col: stage + 2, row, next: []};
        return id;
      });
    }), ["lift"], ["exit"]];
    map.lift = {...standardAreas.lift, type: "boss", col: stages.length - 1, next: []};
    map.exit = {...standardAreas.exit, col: stages.length, next: []};
    // 구간을 차례로 걸으며 연결해서 모든 방이 이어지고 연결선이 교차하지 않게 한다.
    for(let stage = 0; stage < stages.length - 1; stage++){
      const from = stages[stage], to = stages[stage + 1];
      let left = 0, right = 0;
      while(true){
        map[from[left]].next.push(to[right]);
        const lastLeft = left === from.length - 1, lastRight = right === to.length - 1;
        if(lastLeft && lastRight) break;
        const choice = random();
        if(!lastLeft && (lastRight || choice < .67)) left++;
        if(!lastRight && (lastLeft || choice > .33)) right++;
      }
    }
    const rooms = stages.slice(1, -2).flat();
    const placement = this.placeRooms(map, rooms, counts, widths[0], seededRandom(JSON.stringify(["placement", seed])));
    rooms.forEach((id, index) => {
      const type = placement[index];
      const roomRandom = seededRandom(JSON.stringify(["room", seed, id]));
      const room = type === "battle" ? battleRooms[Math.floor(roomRandom() * battleRooms.length)] : specialRooms[type];
      Object.assign(map[id], room, {type});
      if(type === "mystery") map[id].event = eventIds[Math.floor(roomRandom() * eventIds.length)];
      if(room.foe === "medic") map[id].companions = standardAreas.infirmary.companions;
      if(room.foe === "crawler" || room.foe === "sentinel") map[id].companion = "archer";
    });
    return map;
  }

  // 첫 구간의 엘리트와 서로 이어진 같은 종류의 특수 방을 피한다. 막히면 가장 가까운 대안이 있는 방으로
  // 되돌아가고, 반복 연결은 필요한 최소만 허용한다.
  placeRooms(map, rooms, counts, firstWidth, random){
    const pool = Object.entries(counts).flatMap(([type, count]) => Array(count).fill(type));
    const choices = rooms.map(() => [...new Set(shuffle(pool, random))]);
    const previous = rooms.map(id => rooms.flatMap((other, index) => map[other].next.includes(id) ? [index] : []));
    const placement = [];
    const firstElites = Math.max(0, counts.elite - (rooms.length - firstWidth));
    function place(index, repeatBudget, earlyElites){
      if(index === rooms.length) return true;
      const early = index < firstWidth;
      for(const type of choices[index]){
        if(!counts[type] || (early && type === "elite" && !earlyElites)) continue;
        if(early && type !== "elite" && firstWidth - index === earlyElites) continue;
        const repeats = type === "battle" ? 0 : previous[index].filter(neighbor => placement[neighbor] === type).length;
        if(repeats > repeatBudget) continue;
        placement[index] = type;
        counts[type]--;
        const placed = place(index + 1, repeatBudget - repeats, earlyElites - Number(early && type === "elite"));
        counts[type]++;
        if(placed) return true;
      }
      return false;
    }
    let repeatBudget = 0;
    while(!place(0, repeatBudget, firstElites)) repeatBudget++;
    return placement;
  }
}
