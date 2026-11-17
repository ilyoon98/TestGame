// Suspension is independent from the player's manual pause and automatic setting.
export function playbackBlocked({hidden=false,guide=false,result=false,cemetery=false}={}){return hidden||guide||result||cemetery;}
