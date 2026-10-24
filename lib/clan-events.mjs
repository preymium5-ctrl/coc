import {parseBattleDate,ApiError} from './coc-service.mjs';

export function capitalRaidSummary(clan,payload,now=new Date()){
  const seasons=(payload?.items||[]).filter(s=>parseBattleDate(s.startTime)).sort((a,b)=>Date.parse(parseBattleDate(b.startTime))-Date.parse(parseBattleDate(a.startTime)));
  const season=seasons[0]||null,participants=new Map((season?.members||[]).map(m=>[m.tag,m]));
  const roster=new Map((clan.memberList||[]).map(m=>[m.tag,m]));
  const tags=new Set([...roster.keys(),...participants.keys()]);
  const members=[...tags].map(tag=>{
    const current=roster.get(tag),raid=participants.get(tag);
    return {tag,name:current?.name||raid?.name||tag,townHallLevel:current?.townHallLevel??current?.townhallLevel??null,currentMember:!!current,
      attacks:season?raid?.attacks||0:null,attackLimit:raid?raid.attackLimit+(raid.bonusAttackLimit||0):null,capitalGold:season?raid?.capitalResourcesLooted||0:null};
  }).sort((a,b)=>(b.capitalGold??-1)-(a.capitalGold??-1)||(b.attacks??-1)-(a.attacks??-1)||a.name.localeCompare(b.name));
  let rank=0;
  for(const member of members)member.rank=member.attacks>0?++rank:null;
  const start=season?parseBattleDate(season.startTime):null,end=season?parseBattleDate(season.endTime):null;
  return {clanTag:clan.tag,clanName:clan.name,capitalHallLevel:clan.clanCapital?.capitalHallLevel??null,districts:clan.clanCapital?.districts||[],
    weekend:season?{start,end,state:Date.parse(start)>now?'upcoming':Date.parse(end)>now?'ongoing':'ended',totalLoot:season.capitalTotalLoot??null,totalAttacks:season.totalAttacks??null,raidsCompleted:season.raidsCompleted??null,districtsDestroyed:season.enemyDistrictsDestroyed??null,offensiveReward:season.offensiveReward??null,defensiveReward:season.defensiveReward??null}:null,
    members,participants:members.filter(m=>m.attacks>0).length,source:'Supercell',fetchedAt:now.toISOString()};
}

export function clanGamesWindow(now=new Date()){
  const year=now.getUTCFullYear(),month=now.getUTCMonth(),start=new Date(Date.UTC(year,month,22,8)),end=new Date(Date.UTC(year,month,28,8));
  return {season:`${year}-${String(month+1).padStart(2,'0')}`,start:start.toISOString(),end:end.toISOString(),state:now<start?'upcoming':now<end?'ongoing':'ended'};
}
export function gamesLifetime(profile){const value=profile?.achievements?.find(a=>a.name==='Games Champion')?.value;return Number.isFinite(value)&&value>=0?value:null;}
export function advanceGames(previous,profile,history,now=new Date()){
  const window=clanGamesWindow(now),lifetime=gamesLifetime(profile),same=previous?.season===window.season&&previous?.clanTag===profile.clan?.tag;
  const prior=same?previous:null,start=Date.parse(window.start),end=Date.parse(window.end);
  const events=(history?.items||[]).filter(e=>e.statType==='clan_games'&&e.clanTag===profile.clan?.tag&&Date.parse(e.eventTime)>=start&&Date.parse(e.eventTime)<end&&Number.isFinite(e.delta)&&e.delta>0);
  const recorded=events.reduce((n,e)=>n+e.delta,0);
  const before=now.getTime()<start,baseline=before?lifetime:prior?.baselineLifetime??lifetime;
  const exact=before||!!prior?.exact;
  const delta=lifetime!==null&&baseline!==null&&lifetime>=baseline?lifetime-baseline:null;
  const observedPoints=delta===null?recorded||null:Math.max(delta,recorded,prior?.observedPoints||0);
  return {season:window.season,tag:profile.tag,clanTag:profile.clan?.tag||null,name:profile.name,lifetime,
    baselineLifetime:baseline,startedAt:before?now.toISOString():prior?.startedAt||now.toISOString(),lastObservedAt:now.toISOString(),
    exact:exact&&delta!==null,points:exact&&delta!==null?delta:null,observedPoints,verifiedAt:prior?.verifiedAt||null,historyEvents:events.length};
}
export function confirmGames(profile,points,now=new Date()){
  const lifetime=gamesLifetime(profile),window=clanGamesWindow(now);
  if(!Number.isInteger(points)||Number(points)<0||Number(points)>1_000_000||lifetime===null||Number(points)>lifetime||(window.state==='upcoming'&&points!==0))throw new ApiError(400,'invalid_games_points','Enter the current points shown in the game.');
  return {...advanceGames(null,profile,null,now),baselineLifetime:lifetime-points,points,observedPoints:points,exact:true,verifiedAt:now.toISOString()};
}
