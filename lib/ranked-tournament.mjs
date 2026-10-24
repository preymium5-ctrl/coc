import {configuration,normalizeTag,officialGet,normalizeGroup} from './coc-service.mjs';

const DAY=86400000;
export function rankedGroupMode(profile){
  const name=profile?.leagueTier?.name||profile?.league?.name||'';
  return /^Legend(?: League)?(?: I| 1)?$/i.test(name)?'legend':'ranked';
}

export function rankedWindow(profile={},now=new Date()){
  const legend=rankedGroupMode(profile)==='legend',duration=(legend?28:7)*DAY;
  const season=profile?.currentLeagueSeasonId;
  const supplied=Number.isInteger(season)&&season>=1_000_000_000&&season<2_000_000_000?season*1000:null;
  const monday=new Date(now);
  monday.setUTCHours(5,0,0,0);
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  if(monday>now)monday.setUTCDate(monday.getUTCDate()-7);
  const start=supplied??monday.getTime(),reset=start+duration;
  return {period:'ranked',label:legend?'Legend I tournament':'Ranked week',timeZone:'UTC',
    start:new Date(start).toISOString(),end:new Date(Math.min(now.getTime(),reset-1)).toISOString(),
    resetAt:new Date(reset).toISOString(),source:supplied?'player-season':'weekly-reset'};
}

export async function fetchRankedTournament(profile,options={}){
  const window=rankedWindow(profile,options.now||new Date());
  if(!profile)return {status:'unavailable',window,battles:[]};
  const seasonId=profile.currentLeagueSeasonId,groupTag=profile.currentLeagueGroupTag;
  if(!groupTag||groupTag==='#0'||window.source!=='player-season')return {status:'not_joined',window,battles:[]};
  const tag=normalizeTag(profile.tag),group=normalizeTag(groupTag);
  const data=await officialGet(`/leaguegroup/${encodeURIComponent(group)}/${seasonId}?playerTag=${encodeURIComponent(tag)}`,options.config||configuration(),options.fetcher);
  return {status:'available',window,groupTag:group,seasonId,...normalizeGroup(data,tag,rankedGroupMode(profile))};
}
