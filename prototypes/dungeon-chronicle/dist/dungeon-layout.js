// A separate random stream keeps terrain independent from encounter rolls.
export function createLayout(identity,dungeon){
  let seed=2166136261;
  for(const c of `${identity}:${dungeon.id}`)seed=Math.imul(seed^c.charCodeAt(0),16777619);
  const roll=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  const count=dungeon.floors.length-1+roll(3),middle=dungeon.floors.slice(0,-1);
  const floors=Array.from({length:count-1},(_,i)=>middle[i%middle.length]+(i>=middle.length?' · 안쪽':''));
  floors.push(dungeon.floors.at(-1));
  return {version:1,floors,rooms:floors.map(()=>4+roll(5)),visited:0};
}
export function legacyLayout(dungeon){return {version:1,floors:[...dungeon.floors],rooms:dungeon.floors.map(()=>6),visited:0};}
export function validLayout(layout){return layout?.version===1&&Array.isArray(layout.floors)&&layout.floors.length>=2&&layout.floors.length<=8&&layout.floors.every(n=>typeof n==='string')&&Array.isArray(layout.rooms)&&layout.rooms.length===layout.floors.length&&layout.rooms.every(n=>Number.isInteger(n)&&n>=4&&n<=8)&&Number.isInteger(layout.visited)&&layout.visited>=0&&layout.visited<=layout.floors.length;}
