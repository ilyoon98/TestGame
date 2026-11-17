const invitePath=location.pathname.match(/^\/join\/([A-Z0-9]+)$/i);
if(invitePath){state.invitedRoomId=invitePath[1].toUpperCase();document.body.classList.add('invite-entry');document.querySelector('.rooms-panel .panel-kicker').textContent='02 / 초대받은 작전실';document.querySelector('.rooms-panel h2').textContent='닉네임을 입력하고 합류';$('homeName').focus();}
api('/api/network').then(data=>{if(data.addresses?.length)$('localAddress').textContent=`로컬 접속 주소 · ${data.addresses[0]}`;}).catch(()=>{});
async function restoreSession(){
  if(invitePath)return;
  let saved=sessionStorage.getItem('hexLobby');
  if(!saved){saved=localStorage.getItem('hexLobby');if(saved){sessionStorage.setItem('hexLobby',saved);localStorage.removeItem('hexLobby');}}
  if(!saved)return;
  try{const session=JSON.parse(saved),data=await api(`/api/rooms/${session.room}/reconnect`,{method:'POST',body:JSON.stringify({playerId:session.playerId,reconnectToken:session.reconnectToken})}),room=data.room;state.room=room;state.playerId=data.playerId;state.reconnectToken=data.reconnectToken;state.role=session.role;state.mode=session.mode;saveSession();if(['playing','finished'].includes(room.status))showGame();else renderLobby();}catch{sessionStorage.removeItem('hexLobby');}
}
restoreSession().finally(()=>{if(!state.room){loadRooms();clearInterval(state.roomListTimer);state.roomListTimer=setInterval(loadRooms,3000);}});
