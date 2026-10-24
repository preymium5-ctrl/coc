import {configuration,normalizeTag,officialGet,normalizeGroup} from './coc-service.mjs';

const DAY=86400000;
// Supercell's current ranked league rules:
// https://support.supercell.com/clash-of-clans/en/articles/ranked-leagues-4.html
/** @type {Array<[RegExp,number]>} */
const WEEKLY_ATTACKS=[
  [/^Skeleton [1-3]$/i,6],[/^Barbarian [4-6]$/i,6],
  [/^Archer [7-9]$/i,8],[/^Wizard (?:10|11|12)$/i,8],
  [/^Valkyrie (?:13|14|15)$/i,10],[/^Witch (?:16|17|18)$/i,10],
  [/^Golem (?:19|20|21)$/i,12],[/^P\.?E\.?K\.?K\.?A\.? (?:22|23|24)$/i,12],
  [/^Titan (?:25|26|27)$/i,12],[/^Dragon (?:28|29|30)$/i,14],
  [/^Electro (?:31|32|33)$/i,18],[/^Legend(?: League)? (?:III|3)$/i,24],
  [/^Legend(?: League)? (?:II|2)$/i,30],
];
export function rankedAttackAllowance(profile){
  const league=profile?.leagueTier?.name?.trim()||profile?.league?.name?.trim()||'';
  if(/^Legend(?: League)?(?: I| 1)?$/i.test(league))return {league,attacks:8,period:'day'};
  const rule=WEEKLY_ATTACKS.find(([name])=>name.test(league));
  return rule?{league,attacks:rule[1],period:'week'}:null;
}

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

export function rankedAttackWindow(profile={},now=new Date()){
  const tournament=rankedWindow(profile,now);
  if(rankedAttackAllowance(profile)?.period!=='day')return tournament;
  const day=new Date(now);day.setUTCHours(5,0,0,0);
  if(day>now)day.setUTCDate(day.getUTCDate()-1);
  const start=day.getTime(),reset=start+DAY;
  return {period:'day',label:'Legend league day',timeZone:'UTC',start:new Date(start).toISOString(),
    end:new Date(now).toISOString(),resetAt:new Date(reset).toISOString(),source:'daily-reset'};
}

export function rankedAttackProgress(profile,tournament,recordedAttacks,now=new Date()){
  const allowance=rankedAttackAllowance(profile);
  if(!allowance)return null;
  const window=rankedAttackWindow(profile,now);
  // Tournament totals span four weeks in Legend I, so cannot stand in for a daily count.
  const official=allowance.period==='week'&&tournament?.status==='available'&&tournament.window?.start===window.start&&Number.isInteger(tournament.completedAttacks)&&tournament.completedAttacks>=0;
  const recorded=Number.isInteger(recordedAttacks)&&recordedAttacks>=0;
  return {...allowance,window,completedAttacks:official?tournament.completedAttacks:recorded?recordedAttacks:null,
    source:official?'official':recorded?'recorded':'unavailable'};
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
