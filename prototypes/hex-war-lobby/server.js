const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const os=require('os');
const QRCode=require('qrcode');

const PORT=process.env.PORT||4173;
const ROOT=__dirname;
const STATE_FILE=path.join(ROOT,'rooms-state.json');
const rooms=new Map();
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const id=()=>crypto.randomBytes(8).toString('hex');
const roomCode=()=>{let code;do code=crypto.randomBytes(2).toString('hex').toUpperCase();while(rooms.has(code));return code;};
const key=(q,r)=>`${q},${r}`;
const neighbors=(q,r)=>DIRS.map(([dq,dr])=>({q:q+dq,r:r+dr}));
const hexDistance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs((a.q+a.r)-(b.q+b.r)))/2;
const shuffle=list=>{const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
const pick=list=>list[Math.floor(Math.random()*list.length)];

function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(Error('invalid json'));}});req.on('error',reject);});}
function cellsForRadius(radius){const cells=[];for(let q=-radius;q<=radius;q++){const minR=Math.max(-radius,-q-radius),maxR=Math.min(radius,-q+radius);for(let r=minR;r<=maxR;r++)cells.push({q,r});}return cells;}
function hasCell(game,q,r){return game.cells.some(cell=>cell.q===q&&cell.r===r);}
function terrainAt(game,q,r){return game.terrain[key(q,r)]||'plain';}
function unitAt(game,q,r){return game.units.find(unit=>unit.hp>0&&unit.q===q&&unit.r===r);}

function generateTerrain(cells,occupiedKeys=new Set()){
  const terrain=Object.fromEntries(cells.map(cell=>[key(cell.q,cell.r),'plain']));
  const available=()=>cells.filter(cell=>!occupiedKeys.has(key(cell.q,cell.r)));
  const paintCluster=(type,seed,count,growth=.72)=>{const frontier=[seed],painted=new Set();while(frontier.length&&painted.size<count){const current=frontier.splice(Math.floor(Math.random()*frontier.length),1)[0],cellKey=key(current.q,current.r);if(painted.has(cellKey)||occupiedKeys.has(cellKey))continue;terrain[cellKey]=type;painted.add(cellKey);for(const next of shuffle(neighbors(current.q,current.r))){if(terrain[key(next.q,next.r)]&&Math.random()<growth)frontier.push(next);}}};
  terrain['0,0']='highland';
  for(const next of shuffle(neighbors(0,0)).slice(0,2))if(terrain[key(next.q,next.r)]&&!occupiedKeys.has(key(next.q,next.r)))terrain[key(next.q,next.r)]='highland';
  for(let i=0;i<2;i++){const seed=pick(available().filter(cell=>hexDistance(cell,{q:0,r:0})>=2&&terrain[key(cell.q,cell.r)]==='plain'));if(seed)paintCluster('highland',seed,2+Math.floor(Math.random()*3),.62);}
  for(let i=0;i<3;i++){const seed=pick(available().filter(cell=>terrain[key(cell.q,cell.r)]==='plain'));if(seed)paintCluster('forest',seed,4+Math.floor(Math.random()*4),.78);}
  const radius=Math.max(...cells.map(cell=>hexDistance(cell,{q:0,r:0}))),axis=Math.floor(Math.random()*3),riverCells=[];
  let drift=Math.floor(Math.random()*3)-1;
  for(let step=-radius;step<=radius;step++){
    if(Math.random()<.28)drift=Math.max(-2,Math.min(2,drift+(Math.random()<.5?-1:1)));
    let cell;if(axis===0)cell={q:step,r:drift};else if(axis===1)cell={q:drift,r:step};else cell={q:step,r:-step-drift};
    if(terrain[key(cell.q,cell.r)]&&!occupiedKeys.has(key(cell.q,cell.r))){terrain[key(cell.q,cell.r)]='river';riverCells.push(cell);}
  }
  const bridge=[...riverCells].sort((a,b)=>hexDistance(a,{q:0,r:0})-hexDistance(b,{q:0,r:0}))[0];if(bridge)terrain[key(bridge.q,bridge.r)]='bridge';
  for(const occupied of occupiedKeys)if(terrain[occupied]==='river')terrain[occupied]='plain';
  return terrain;
}

const UNIT_TYPES={
  infantry:{type:'infantry',typeName:'보병',mark:'보',hp:38,range:2,minRange:1,move:1,vision:1,damageBonus:0},
  artillery:{type:'artillery',typeName:'포병',mark:'포',hp:32,range:4,minRange:2,move:1,vision:1,damageBonus:3},
  scout:{type:'scout',typeName:'정찰',mark:'정',hp:24,range:2,minRange:1,move:2,vision:2,damageBonus:-3}
};

function spawnUnits(players,cells,terrain){
  const radius=Math.max(...cells.map(cell=>hexDistance(cell,{q:0,r:0}))),corners=DIRS.map(([q,r])=>({q:q*radius,r:r*radius})),rotation=Math.floor(Math.random()*6),orderedPlayers=shuffle(players),units=[],occupied=new Set();
  orderedPlayers.forEach((player,index)=>{
    const sector=(index+rotation)%6,corner=corners[sector],zone=shuffle(cells.filter(cell=>hexDistance(cell,{q:0,r:0})>=Math.max(2,radius-2)&&corners.reduce((best,item,cornerIndex)=>hexDistance(cell,item)<best.distance?{cornerIndex,distance:hexDistance(cell,item)}:best,{cornerIndex:-1,distance:Infinity}).cornerIndex===sector&&!occupied.has(key(cell.q,cell.r)))),chosen=[];
    for(const minimumGap of [2,1])for(const cell of zone){if(chosen.length>=3)break;if(!chosen.includes(cell)&&chosen.every(other=>hexDistance(cell,other)>=minimumGap))chosen.push(cell);}
    const fallback=shuffle(cells.filter(cell=>!occupied.has(key(cell.q,cell.r))&&hexDistance(cell,corner)<=Math.ceil(radius/2)));for(const cell of fallback){if(chosen.length>=3)break;if(!chosen.includes(cell))chosen.push(cell);}
    shuffle(['infantry','artillery','scout']).forEach((typeName,unitIndex)=>{const stats=UNIT_TYPES[typeName],cell=chosen[unitIndex],scale=Math.max(0,players.length-2)*2,maxHp=stats.hp+scale;occupied.add(key(cell.q,cell.r));terrain[key(cell.q,cell.r)]='plain';units.push({id:`unit-${player.id.slice(0,5)}-${typeName}`,ownerId:player.id,ownerName:player.name,q:cell.q,r:cell.r,hp:maxHp,maxHp,...stats});});
  });
  return units;
}

function freshPlayerActions(game,playerId){return Object.fromEntries(game.units.filter(unit=>unit.ownerId===playerId&&unit.hp>0).map(unit=>[unit.id,{move:null,attack:null}]));}
function playerActions(game,playerId){
  const current=game.actions[playerId]||{};
  if(Object.prototype.hasOwnProperty.call(current,'move')||Object.prototype.hasOwnProperty.call(current,'attack')){const upgraded=freshPlayerActions(game,playerId);for(const type of ['move','attack'])if(current[type]?.unitId&&upgraded[current[type].unitId])upgraded[current[type].unitId][type]=current[type];game.actions[playerId]=upgraded;}
  else{game.actions[playerId]=current;for(const unit of game.units.filter(item=>item.ownerId===playerId&&item.hp>0))game.actions[playerId][unit.id]??={move:null,attack:null};}
  return game.actions[playerId];
}

function initGame(room){
  const players=[...room.members.values()].filter(member=>member.role==='player'),radius=Math.max(4,Math.min(5,Number(room.settings.radius)||4)),cells=cellsForRadius(radius),terrain=generateTerrain(cells),units=spawnUnits(players,cells,terrain),actions={},lastKnown={},scores={};
  for(const player of players){actions[player.id]=Object.fromEntries(units.filter(unit=>unit.ownerId===player.id).map(unit=>[unit.id,{move:null,attack:null}]));lastKnown[player.id]={};scores[player.id]={damageDealt:0};}
  for(const screen of [...room.members.values()].filter(member=>member.role==='screen'))lastKnown[screen.id]={};
  room.game={turn:1,maxTurns:Number(room.settings.turns)||10,phase:'planning',radius,cells,terrain,units,actions,submitted:{},lastEvent:'명령을 입력하세요.',animation:null,revealedThisTurn:[],lastKnown,scores,winner:null,scoreBoard:[]};
}

function memberVision(game,member){
  const visible=new Set();if(!member)return visible;
  if(member.role==='player'){
    const own=game.units.filter(unit=>unit.ownerId===member.id&&unit.hp>0);own.forEach(unit=>visible.add(unit.id));
    for(const enemy of game.units.filter(unit=>unit.ownerId!==member.id&&unit.hp>0))if(own.some(unit=>hexDistance(unit,enemy)<=unit.vision+(terrainAt(game,unit.q,unit.r)==='highland'?1:0)))visible.add(enemy.id);
  }
  for(const revealed of game.revealedThisTurn||[])visible.add(revealed.unitId);return visible;
}

function updateLastKnown(room){
  if(!room.game)return;
  for(const member of room.members.values()){
    room.game.lastKnown[member.id]??={};const visible=memberVision(room.game,member);
    for(const unit of room.game.units.filter(unit=>unit.hp>0&&visible.has(unit.id)&&unit.ownerId!==member.id))room.game.lastKnown[member.id][unit.id]={unitId:unit.id,ownerName:unit.ownerName,typeName:unit.typeName,mark:unit.mark,q:unit.q,r:unit.r,turn:room.game.turn};
    for(const unitId of Object.keys(room.game.lastKnown[member.id]))if(!room.game.units.some(unit=>unit.id===unitId&&unit.hp>0))delete room.game.lastKnown[member.id][unitId];
  }
}

function publicGame(room,viewerId){
  const game=room.game;if(!game)return null;const member=room.members.get(viewerId),visible=memberVision(game,member),ownId=member?.role==='player'?member.id:null,animatedDead=new Set(game.phase==='attack'?(game.animation?.attacks||[]).filter(attack=>attack.hit).map(attack=>attack.targetUnitId):[]),units=game.units.filter(unit=>(unit.hp>0||animatedDead.has(unit.id))&&(unit.ownerId===ownId||visible.has(unit.id))),visibleIds=new Set(units.map(unit=>unit.id)),lastKnown=Object.values(game.lastKnown?.[viewerId]||{}).filter(item=>!visibleIds.has(item.unitId)),actions=ownId?{[ownId]:playerActions(game,ownId)}:{};
  const safe={...game,units,actions,lastKnown,visibleUnitIds:[...visible]};delete safe.scores;delete safe.lastKnownByPlayer;return safe;
}
function publicRoom(room,viewerId){return{code:room.code,hostId:room.hostId,status:room.status,settings:room.settings,players:[...room.members.values()].filter(member=>member.role==='player').map(({id,name,isHost,ready,connected=true})=>({id,name,isHost,ready,connected})),screens:[...room.members.values()].filter(member=>member.role==='screen').map(({id,name,connected=true})=>({id,name,role:'screen',connected})),game:publicGame(room,viewerId)};}

function localAddresses(){return Object.values(os.networkInterfaces()).flat().filter(item=>item&&item.family==='IPv4'&&!item.internal).map(item=>`http://${item.address}:${PORT}`);}
function inviteOrigin(req){
  const requested=`http://${req.headers.host}`;
  try{const hostname=new URL(requested).hostname;if(hostname!=='localhost'&&hostname!=='127.0.0.1')return requested;}catch{}
  return localAddresses()[0]||requested;
}
function roomSummary(room){
  const players=[...room.members.values()].filter(member=>member.role==='player');
  const host=players.find(player=>player.id===room.hostId);
  return{roomId:room.code,hostName:host?.name||'이름 없는 방장',players:players.length,maxPlayers:6,screenConnected:[...room.members.values()].some(member=>member.role==='screen'),createdAt:room.createdAt||0};
}
function roomIsJoinable(room){const players=[...room.members.values()].filter(member=>member.role==='player');const host=room.members.get(room.hostId);return room.status==='lobby'&&players.length<6&&host?.connected;}

function persist(){try{const serial=[...rooms.values()].map(room=>({...room,members:[...room.members.entries()]}));fs.writeFileSync(STATE_FILE,JSON.stringify(serial));}catch(error){console.error('state save failed',error.message);}}
function loadPersisted(){try{if(!fs.existsSync(STATE_FILE))return;const stored=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));for(const raw of stored){raw.members=new Map(raw.members);for(const member of raw.members.values())member.connected=false;if(raw.game&&!['planning','gameover'].includes(raw.game.phase)){raw.game.phase='planning';raw.game.animation=null;raw.game.submitted={};raw.game.revealedThisTurn=[];raw.game.actions={};for(const member of raw.members.values())if(member.role==='player')raw.game.actions[member.id]=freshPlayerActions(raw.game,member.id);raw.game.lastEvent='서버가 재시작되어 현재 턴의 명령을 다시 받습니다.';}else if(raw.game?.phase==='planning')for(const member of raw.members.values())if(member.role==='player')playerActions(raw.game,member.id);rooms.set(raw.code,raw);}}catch(error){console.error('state load failed',error.message);}}
loadPersisted();

function reachable(game,unit,target){
  if(hexDistance(unit,target)>unit.move)return false;const targetKey=key(target.q,target.r),seen=new Set([key(unit.q,unit.r)]),queue=[{q:unit.q,r:unit.r,steps:0}];
  while(queue.length){const current=queue.shift();if(key(current.q,current.r)===targetKey)return current.steps>0;for(const next of neighbors(current.q,current.r)){const nextKey=key(next.q,next.r);if(seen.has(nextKey)||!hasCell(game,next.q,next.r)||terrainAt(game,next.q,next.r)==='river'||current.steps>=unit.move)continue;seen.add(nextKey);queue.push({...next,steps:current.steps+1});}}return false;
}

// 근접 보정 — 포병은 붙으면 약하고 보병은 강하다. "포병을 지켜라"가 성립하게 만든다.
const MELEE_BONUS = { infantry: 3, scout: 0, artillery: -3 };

// 해결 연출 페이싱. 명령은 동시에 받지만 재생은 한 명씩 보여 줘야 따라갈 수 있다.
const ENCOUNTER_MS = 2600;   // 조우 1건(VS 연출)
const MOVE_SLOT_MS = 1000;   // 플레이어 한 명의 부대가 함께 미끄러지는 시간
const VOLLEY_GAP_MS = 1500;  // 다음 사람의 포격이 시작되기까지
const SHOT_GAP_MS = 260;     // 같은 사람이 연달아 쏠 때
const SHOT_TAIL_MS = 4910;   // 마지막 포탄의 비행~주사위~피해 반영
const SKIP_MS = 350;         // 아무 일도 없는 단계는 빠르게 넘긴다

// 같은 칸을 노린 적 부대끼리 주사위를 굴려 승부를 낸다.
// 높은 쪽이 차액만큼 피해를 주고, 지키던 적을 쓰러뜨렸을 때만 그 칸을 차지한다.
function resolveEncounter(game, contenders, to, occupier) {
  const rolls = contenders.map(unit => {
    const roll = 1 + Math.floor(Math.random() * 20);
    const bonus = MELEE_BONUS[unit.type] || 0;
    return { unitId: unit.id, ownerId: unit.ownerId, ownerName: unit.ownerName, typeName: unit.typeName,
             mark: unit.mark, roll, bonus, total: roll + bonus, damage: 0,
             hpBefore: unit.hp, hpAfter: unit.hp, maxHp: unit.maxHp };
  });
  const best = Math.max(...rolls.map(entry => entry.total));
  const leaders = rolls.filter(entry => entry.total === best);
  const draw = leaders.length > 1;
  const encounter = { at: to, rolls, draw, winnerUnitId: draw ? null : leaders[0].unitId,
                      defenderUnitId: occupier ? occupier.id : null };
  if (draw) return encounter;

  const winner = game.units.find(unit => unit.id === encounter.winnerUnitId);
  for (const entry of rolls) {
    if (entry.unitId === winner.id || entry.ownerId === winner.ownerId) continue;
    const loser = game.units.find(unit => unit.id === entry.unitId);
    const damage = Math.max(1, best - entry.total);
    entry.damage = damage;
    entry.hpBefore = loser.hp;
    loser.hp = Math.max(0, loser.hp - damage);
    entry.hpAfter = loser.hp;
    game.scores[winner.ownerId].damageDealt += entry.hpBefore - entry.hpAfter;
  }
  return encounter;
}

function beginResolution(room){
  const game = room.game;
  const players = [...room.members.values()].filter(member => member.role === 'player');
  const candidates = [];
  game.phase = 'movement';

  for (const player of players)
    for (const [unitId, orders] of Object.entries(playerActions(game, player.id))) {
      const command = orders.move;
      if (!command) continue;
      const unit = game.units.find(item => item.id === unitId && item.ownerId === player.id && item.hp > 0);
      if (unit && reachable(game, unit, command.target)) candidates.push({ unit, to: command.target, from: { q: unit.q, r: unit.r } });
    }

  // 목표 칸별로 묶어서, 겹친 칸만 따로 판정한다.
  const byTile = new Map();
  for (const candidate of candidates) {
    const tile = key(candidate.to.q, candidate.to.r);
    if (!byTile.has(tile)) byTile.set(tile, []);
    byTile.get(tile).push(candidate);
  }

  const moves = [], blocked = [], encounters = [], events = [];
  game.revealedThisTurn = [];

  for (const group of byTile.values()) {
    const to = group[0].to;
    const occupier = unitAt(game, to.q, to.r);

    // 아무도 없는 칸에 혼자 들어간다 — 평범한 이동
    if (group.length === 1 && !occupier) { moves.push({ unitId: group[0].unit.id, from: group[0].from, to }); continue; }

    const contenders = [...group.map(candidate => candidate.unit), ...(occupier ? [occupier] : [])];
    // 같은 편끼리 몰린 경우엔 싸우지 않고 예전처럼 전부 제자리
    if (new Set(contenders.map(unit => unit.ownerId)).size < 2) {
      for (const candidate of group) blocked.push({ unitId: candidate.unit.id, to });
      continue;
    }

    const encounter = resolveEncounter(game, contenders, to, occupier);
    encounters.push(encounter);
    for (const entry of encounter.rolls) {
      const unit = game.units.find(item => item.id === entry.unitId);
      game.revealedThisTurn.push({ unitId: unit.id, q: unit.q, r: unit.r });
    }

    if (encounter.draw) {
      events.push(`${encounter.rolls.map(entry => entry.ownerName).join(' · ')} 조우 무승부`);
      for (const candidate of group) blocked.push({ unitId: candidate.unit.id, to, encounter: encounters.length - 1 });
      continue;
    }

    const winner = game.units.find(unit => unit.id === encounter.winnerUnitId);
    const hurt = encounter.rolls.filter(entry => entry.damage > 0);
    events.push(`${winner.ownerName} ${winner.typeName} 조우 승리 · ${hurt.map(entry => `${entry.ownerName} -${entry.damage}`).join(' · ')}`);

    // 지키던 적이 살아남으면 아무도 들어가지 못한다.
    const occupierHolds = occupier && occupier.hp > 0 && occupier.id !== winner.id;
    const winnerMove = group.find(candidate => candidate.unit.id === winner.id);
    for (const candidate of group) {
      if (candidate.unit.id === winner.id && winnerMove && !occupierHolds) continue;
      blocked.push({ unitId: candidate.unit.id, to, encounter: encounters.length - 1 });
    }
    if (winnerMove && !occupierHolds) moves.push({ unitId: winner.id, from: winnerMove.from, to });
  }

  for (const move of moves) { const unit = game.units.find(item => item.id === move.unitId); unit.q = move.to.q; unit.r = move.to.r; }
  game.revealedThisTurn = [...new Map(game.revealedThisTurn.map(item => [item.unitId, item])).values()];
  updateLastKnown(room);

  // 플레이어 차례대로 재생한다. 같은 사람의 부대는 함께 움직이고, 조우는 그다음에 하나씩.
  const ownerOf = unitId => (game.units.find(item => item.id === unitId) || {}).ownerId;
  const slotOf = new Map();
  for (const move of [...moves, ...blocked]) {
    const owner = ownerOf(move.unitId);
    if (!slotOf.has(owner)) slotOf.set(owner, slotOf.size);
  }
  const moveSpan = slotOf.size * MOVE_SLOT_MS;
  for (const move of [...moves, ...blocked]) move.startAt = slotOf.get(ownerOf(move.unitId)) * MOVE_SLOT_MS;
  encounters.forEach((encounter, index) => { encounter.startAt = moveSpan + index * ENCOUNTER_MS; });
  // 조우에 휘말린 부대는 자기 이동 슬롯이 아니라 그 조우가 재생될 때 부딪힌다.
  for (const item of blocked) if (Number.isInteger(item.encounter)) item.startAt = encounters[item.encounter].startAt;

  const busy = moves.length || blocked.length || encounters.length;
  const duration = busy ? moveSpan + encounters.length * ENCOUNTER_MS + 400 : SKIP_MS;
  game.animation = { type: 'movement', startedAt: Date.now(), duration, moves, blocked, encounters };
  game.lastEvent = events.length ? events.join(' · ')
    : blocked.length ? `이동 충돌 ${blocked.length}건`
    : moves.length ? '부대 이동 중' : '이동 없음';
  persist();
  setTimeout(() => beginAttack(room), duration + 100);
}

function beginAttack(room){
  const game=room.game;if(!game||game.phase!=='movement')return;const players=[...room.members.values()].filter(member=>member.role==='player'),alive=game.units.filter(unit=>unit.hp>0),attacks=[],events=[];game.phase='attack';game.revealedThisTurn=[];
  for(const player of players)for(const [unitId,orders] of Object.entries(playerActions(game,player.id))){const command=orders.attack;if(!command)continue;const unit=alive.find(item=>item.id===unitId&&item.ownerId===player.id);if(!unit)continue;const target=alive.find(item=>item.q===command.target.q&&item.r===command.target.r),range=unit.range+(terrainAt(game,unit.q,unit.r)==='highland'?1:0),distance=hexDistance(unit,command.target),result={unitId:unit.id,from:{q:unit.q,r:unit.r},to:command.target,hit:false,damage:0,roll:null,reason:'empty',targetUnitId:null,hpBefore:null,hpAfter:null};game.revealedThisTurn.push({unitId:unit.id,q:unit.q,r:unit.r});
    if(target&&target.ownerId!==unit.ownerId&&distance>=unit.minRange&&distance<=range){const roll=1+Math.floor(Math.random()*20),heightBonus=terrainAt(game,unit.q,unit.r)==='highland'?2:0,forestCover=terrainAt(game,target.q,target.r)==='forest'?3:0,damage=Math.max(1,roll+unit.damageBonus+heightBonus-forestCover);Object.assign(result,{hit:true,roll,damage,reason:'hit',targetUnitId:target.id});game.revealedThisTurn.push({unitId:target.id,q:target.q,r:target.r});events.push(`${unit.ownerName} ${unit.typeName} 명중 · ${target.ownerName} -${damage} · d20 ${roll}`);}else if(target&&target.ownerId!==unit.ownerId){result.reason='out-of-range';events.push(`${unit.ownerName} 사격 실패 · 유효 사거리 밖`);}else events.push(`${unit.ownerName} 예측 사격 · 목표 없음`);attacks.push(result);}
  game.revealedThisTurn=[...new Map(game.revealedThisTurn.map(item=>[item.unitId,item])).values()];
  for(const attack of attacks.filter(item=>item.hit)){const target=game.units.find(unit=>unit.id===attack.targetUnitId);attack.hpBefore=target.hp;target.hp=Math.max(0,target.hp-attack.damage);attack.hpAfter=target.hp;const effective=attack.hpBefore-attack.hpAfter,shooter=game.units.find(unit=>unit.id===attack.unitId);game.scores[shooter.ownerId].damageDealt+=effective;}
  // 같은 사람의 포탄은 연달아 날리고, 사람이 바뀔 때 한 박자 쉰다.
  let cursor = 0, previousOwner = null;
  for (const attack of attacks) {
    const owner = (game.units.find(unit => unit.id === attack.unitId) || {}).ownerId;
    if (previousOwner !== null) cursor += owner === previousOwner ? SHOT_GAP_MS : VOLLEY_GAP_MS;
    attack.startAt = cursor;
    previousOwner = owner;
  }
  const attackDuration = attacks.length ? cursor + SHOT_TAIL_MS : SKIP_MS;
  updateLastKnown(room);
  game.animation = { type: 'attack', startedAt: Date.now(), duration: attackDuration, attacks };
  game.lastEvent = events.join(' · ') || '공격 없음';
  persist();
  setTimeout(() => finishTurn(room), attackDuration + 100);
}

function scoreBoard(room){const game=room.game,players=[...room.members.values()].filter(member=>member.role==='player');return players.map(player=>{const aliveUnits=game.units.filter(unit=>unit.ownerId===player.id&&unit.hp>0),hp=aliveUnits.reduce((sum,unit)=>sum+unit.hp,0),damage=game.scores[player.id]?.damageDealt||0;return{playerId:player.id,name:player.name,alive:aliveUnits.length,hp,damage,score:damage+hp};}).sort((a,b)=>b.score-a.score);}
function finishTurn(room){
  const game=room.game;if(!game||game.phase!=='attack')return;game.phase='result';game.animation={type:'result',startedAt:Date.now(),duration:1800};game.scoreBoard=scoreBoard(room);persist();
  setTimeout(()=>{if(!room.game)return;const active=game.scoreBoard.filter(entry=>entry.alive>0),turnLimit=game.turn>=game.maxTurns;if(active.length<=1||turnLimit){const contenders=active.length?active:game.scoreBoard,best=Math.max(...contenders.map(entry=>entry.score)),winners=contenders.filter(entry=>entry.score===best);game.phase='gameover';game.animation=null;game.winner=winners.length===1?winners[0].name:null;game.lastEvent=winners.length===1?`${winners[0].name} 승리 · ${winners[0].score}점`:'동점 무승부';room.status='finished';persist();return;}game.turn++;game.phase='planning';game.actions={};for(const member of room.members.values())if(member.role==='player')game.actions[member.id]=freshPlayerActions(game,member.id);game.submitted={};game.animation=null;game.revealedThisTurn=[];game.terrain=generateTerrain(game.cells,new Set(game.units.filter(unit=>unit.hp>0).map(unit=>key(unit.q,unit.r))));game.lastEvent='지형이 변했습니다. 새 명령을 입력하세요.';updateLastKnown(room);persist();},1900);
}
const allSubmitted=room=>{const active=[...room.members.values()].filter(member=>member.role==='player'&&room.game.units.some(unit=>unit.ownerId===member.id&&unit.hp>0));return active.length>0&&active.every(member=>room.game.submitted[member.id]);};

async function api(req,res,url){
  try{
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,rooms:rooms.size});
    if(req.method==='GET'&&url.pathname==='/api/network')return json(res,200,{addresses:localAddresses()});
    if(req.method==='GET'&&url.pathname==='/api/rooms'){const open=[...rooms.values()].filter(roomIsJoinable).map(roomSummary).sort((a,b)=>b.createdAt-a.createdAt);return json(res,200,{rooms:open});}
    if(req.method==='GET'&&url.pathname==='/api/local-room'){const active=[...rooms.values()].reverse().find(roomIsJoinable);return active?json(res,200,{code:active.code,players:[...active.members.values()].filter(member=>member.role==='player').length}):json(res,404,{error:'참가할 수 있는 로컬 방이 없습니다.'});}
    if(req.method==='POST'&&url.pathname==='/api/rooms'){const data=await body(req);if(!data.name?.trim())return json(res,400,{error:'닉네임을 입력해 주세요.'});const hostId=id(),token=id(),room={code:roomCode(),hostId,status:'lobby',createdAt:Date.now(),settings:{map:'절차적 전장',turns:10,actions:2,radius:4},members:new Map([[hostId,{id:hostId,name:data.name.trim(),role:'player',isHost:true,ready:true,reconnectToken:token,connected:true}]])};rooms.set(room.code,room);persist();return json(res,201,{room:publicRoom(room,hostId),playerId:hostId,reconnectToken:token});}
    const inviteMatch=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/invite$/);if(inviteMatch&&req.method==='GET'){const room=rooms.get(inviteMatch[1]);if(!room)return json(res,404,{error:'초대할 방을 찾을 수 없습니다.'});const inviteUrl=`${inviteOrigin(req)}/join/${room.code}`,svg=await QRCode.toString(inviteUrl,{type:'svg',margin:1,width:220,color:{dark:'#111312',light:'#f4f1e8'}});return json(res,200,{url:inviteUrl,svg});}
    const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|reconnect|leave|kick|settings|ready|start|command|submit))?$/);if(!match)return json(res,404,{error:'요청을 찾을 수 없습니다.'});const[,code,action]=match,room=rooms.get(code);if(!room)return json(res,404,{error:'방 코드를 확인해 주세요.'});
    if(req.method==='GET'&&!action){const viewerId=url.searchParams.get('playerId');const viewer=room.members.get(viewerId);if(viewer&&!viewer.connected){viewer.connected=true;persist();}return json(res,200,{room:publicRoom(room,viewerId)});}const data=await body(req);
    if(action==='join'&&req.method==='POST'){if(!data.name?.trim())return json(res,400,{error:'닉네임을 입력해 주세요.'});if(room.status!=='lobby')return json(res,409,{error:'이미 게임이 시작된 방입니다.'});const role=data.role==='screen'?'screen':'player';if(role==='screen'&&[...room.members.values()].some(member=>member.role==='screen'))return json(res,409,{error:'이미 연결된 전광판이 있습니다.'});if(role==='player'&&[...room.members.values()].filter(member=>member.role==='player').length>=6)return json(res,409,{error:'플레이어는 최대 6명까지 입장할 수 있습니다.'});if(role==='player'&&[...room.members.values()].some(member=>member.role==='player'&&member.name.toLowerCase()===data.name.trim().toLowerCase()))return json(res,409,{error:'이미 사용 중인 닉네임입니다.'});const playerId=id(),token=id();room.members.set(playerId,{id:playerId,name:data.name.trim(),role,isHost:false,ready:role==='screen',reconnectToken:token,connected:true});persist();return json(res,201,{room:publicRoom(room,playerId),playerId,reconnectToken:token});}
    if(action==='reconnect'&&req.method==='POST'){const member=room.members.get(data.playerId);if(!member||member.reconnectToken!==data.reconnectToken)return json(res,403,{error:'재접속 정보가 만료되었습니다.'});member.connected=true;persist();return json(res,200,{room:publicRoom(room,member.id),playerId:member.id,reconnectToken:member.reconnectToken});}
    if(action==='leave'&&req.method==='POST'){const leaving=room.members.get(data.playerId);room.members.delete(data.playerId);if(leaving?.role==='player'&&room.game)for(const unit of room.game.units.filter(unit=>unit.ownerId===data.playerId))unit.hp=0;if(data.playerId===room.hostId){const next=[...room.members.values()].find(member=>member.role==='player');if(next){next.isHost=true;room.hostId=next.id;}else{rooms.delete(code);persist();return json(res,200,{deleted:true});}}persist();return json(res,200,{room:publicRoom(room,data.playerId)});}
    if(action==='kick'&&req.method==='POST'){if(data.hostId!==room.hostId)return json(res,403,{error:'방장만 추방할 수 있습니다.'});if(data.playerId===room.hostId)return json(res,400,{error:'방장은 자기 자신을 추방할 수 없습니다.'});room.members.delete(data.playerId);persist();return json(res,200,{room:publicRoom(room,data.hostId)});}
    if(action==='ready'&&req.method==='POST'){const player=room.members.get(data.playerId);if(!player||player.role!=='player')return json(res,404,{error:'플레이어를 찾을 수 없습니다.'});if(player.isHost)return json(res,400,{error:'방장은 자동으로 준비된 상태입니다.'});player.ready=Boolean(data.ready);persist();return json(res,200,{room:publicRoom(room,data.playerId)});}
    if(action==='settings'&&req.method==='POST'){if(data.hostId!==room.hostId)return json(res,403,{error:'방장만 설정을 바꿀 수 있습니다.'});room.settings={...room.settings,...data.settings};persist();return json(res,200,{room:publicRoom(room,data.hostId)});}
    if(action==='start'&&req.method==='POST'){if(data.hostId!==room.hostId)return json(res,403,{error:'방장만 게임을 시작할 수 있습니다.'});const players=[...room.members.values()].filter(member=>member.role==='player');if(players.length<2)return json(res,400,{error:'최소 2명의 플레이어가 모여야 시작할 수 있습니다.'});if(players.some(player=>!player.isHost&&!player.ready))return json(res,400,{error:'아직 준비하지 않은 플레이어가 있습니다.'});room.status='playing';initGame(room);persist();return json(res,200,{room:publicRoom(room,data.hostId)});}
    if(action==='command'&&req.method==='POST'){
      const game=room.game;if(room.status!=='playing'||game.phase!=='planning')return json(res,409,{error:'지금은 명령을 수정할 수 없습니다.'});const player=room.members.get(data.playerId);if(!player||player.role!=='player')return json(res,403,{error:'플레이어만 명령할 수 있습니다.'});if(game.submitted[data.playerId])return json(res,409,{error:'이미 턴을 제출했습니다.'});if(!['move','attack'].includes(data.action))return json(res,400,{error:'행동 종류가 필요합니다.'});const unit=game.units.find(item=>item.id===data.unitId&&item.ownerId===data.playerId&&item.hp>0);if(!unit)return json(res,400,{error:'해당 유닛을 선택할 수 없습니다.'});const target=data.target;if(!target||!Number.isInteger(target.q)||!Number.isInteger(target.r)||!hasCell(game,target.q,target.r))return json(res,400,{error:'전장 안의 칸을 선택해 주세요.'});
      if(data.action==='move'&&!reachable(game,unit,target))return json(res,400,{error:`${unit.typeName}은 이동 가능한 칸만 선택할 수 있습니다.`});
      const orders=playerActions(game,data.playerId),unitOrders=orders[unit.id]??={move:null,attack:null};
      if(data.action==='attack'){const origin=unitOrders.move?.target||unit,range=unit.range+(terrainAt(game,origin.q,origin.r)==='highland'?1:0),distance=hexDistance(origin,target);if(distance<unit.minRange)return json(res,400,{error:`${unit.typeName}의 최소 사거리는 ${unit.minRange}칸입니다.`});if(distance>range)return json(res,400,{error:`사거리 밖입니다. 최대 ${range}칸입니다.`});}
      unitOrders[data.action]={unitId:data.unitId,target};let notice=null;if(data.action==='move'&&unitOrders.attack){const range=unit.range+(terrainAt(game,target.q,target.r)==='highland'?1:0),distance=hexDistance(target,unitOrders.attack.target);if(distance<unit.minRange||distance>range){unitOrders.attack=null;notice='이동 위치가 바뀌어 이 유닛의 기존 공격 명령을 취소했습니다.';}}persist();return json(res,200,{room:publicRoom(room,data.playerId),notice});
    }
    if(action==='submit'&&req.method==='POST'){if(room.status!=='playing'||room.game.phase!=='planning')return json(res,409,{error:'지금은 턴을 제출할 수 없습니다.'});const player=room.members.get(data.playerId);if(!player||player.role!=='player')return json(res,403,{error:'플레이어만 제출할 수 있습니다.'});room.game.submitted[data.playerId]=true;persist();if(allSubmitted(room))beginResolution(room);return json(res,200,{room:publicRoom(room,data.playerId)});}
    return json(res,405,{error:'지원하지 않는 요청입니다.'});
  }catch(error){return json(res,400,{error:error.message});}
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/'))return api(req,res,url);const appRoute=url.pathname==='/'||/^\/join\/[A-Z0-9]+$/i.test(url.pathname),file=path.normalize(path.join(ROOT,appRoute?'/index.html':url.pathname));if(!file.startsWith(ROOT))return json(res,403,{error:'forbidden'});fs.readFile(file,(error,data)=>{if(error)return json(res,404,{error:'파일을 찾을 수 없습니다.'});res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(PORT,'0.0.0.0',()=>console.log(`Hex War Lobby running at http://0.0.0.0:${PORT}`));
