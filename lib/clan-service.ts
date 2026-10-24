import {ApiError,configuration,normalizeTag,getPlayer,officialGet,communityGet,normalizeBattles,mergeBattle,coalesceBattles} from './coc-service.mjs';
import {periodBounds,collectionStart,decorateProfile,troopUsage,cwlAverages,orientWar} from './clan-analytics.mjs';
import {cached,playerBattles,savedBattlesById,savedRankedBattles,saveBattles,syncInfo,clanTotals,memberAttacks} from './clan-store';
import {rankedWindow,rankedAttackAllowance,rankedAttackWindow,rankedAttackProgress,fetchRankedTournament} from './ranked-tournament.mjs';
import {capitalRaidSummary} from './clan-events.mjs';
import {observeClanGames,readClanGames,verifyClanGamesScore} from './clan-games';

export async function getPublicProfile(input:string){const tag=normalizeTag(input);return cached('profile:'+tag,async()=>decorateProfile(await getPlayer(tag)),90);}
export async function getClan(input:string){
  const tag=normalizeTag(input);
  return cached('clan:'+tag,async()=>{
    const clan=await officialGet('/clans/'+encodeURIComponent(tag),configuration(),undefined);
    if(clan?.tag!==tag||!Array.isArray(clan.memberList))throw new ApiError(502,'invalid_clan','The provider did not return a valid clan roster.');
    return {...clan,memberList:clan.memberList.map((m:{tag:string;townHallLevel?:number;townhallLevel?:number})=>({...m,townHallLevel:m.townHallLevel??m.townhallLevel??null}))};
  },60);
}
async function collectPlayer(tag:string,timeZone:string,knownProfile?:any){
  const baseAfter=collectionStart(timeZone),saved=await syncInfo(tag),prior=saved?JSON.parse(saved.coverage):null;
  if(saved&&Date.now()-saved.synced_at<45000&&prior.ranked&&prior.windowStart<=baseAfter)return {tag,coverage:prior,cached:true};
  const profile=knownProfile||await getPublicProfile(tag).catch(()=>null),window=rankedWindow(profile);
  if(profile)await observeClanGames(profile);
  const after=new Date(Math.min(Date.parse(baseAfter),Date.parse(window.start))).toISOString();
  const result=await cached('combat:v2:'+tag+':'+after,async()=>{
    const [recent,history,tournament]=await Promise.allSettled([
      officialGet('/players/'+encodeURIComponent(tag)+'/battlelog',configuration(),undefined),
      communityGet('/player/'+encodeURIComponent(tag)+'/battlelog/history?time%5Bafter%5D='+encodeURIComponent(after),undefined),
      fetchRankedTournament(profile),
    ]);
    const byId=new Map();
    if(history.status==='fulfilled')for(const b of normalizeBattles(history.value,tag,'clashking'))byId.set(b.id,b);
    if(tournament.status==='fulfilled')for(const b of tournament.value.battles)byId.set(b.id,mergeBattle(byId.get(b.id),b));
    if(recent.status==='fulfilled')for(const b of normalizeBattles(recent.value,tag,'official'))byId.set(b.id,mergeBattle(byId.get(b.id),b));
    const length=(value:{items?:unknown[]}|unknown[])=>Array.isArray(value)?value.length:Array.isArray(value?.items)?value.items.length:0;
    const ranked=tournament.status==='fulfilled'?(({battles,...metadata})=>metadata)(tournament.value):{status:'unavailable',window};
    return {battles:[...byId.values()],coverage:{available:recent.status==='fulfilled'||history.status==='fulfilled'||ranked.status==='available',official:recent.status==='fulfilled'?'available':'unavailable',history:history.status==='fulfilled'?'available':'unavailable',ranked,windowStart:after,truncated:recent.status==='fulfilled'&&length(recent.value)>1000||history.status==='fulfilled'&&length(history.value)>1000}};
  },45);
  const [previous,rankedSaved]=await Promise.all([savedBattlesById(tag,result.battles.map(b=>b.id)),savedRankedBattles(tag,window.start,window.end)]);
  const merged=coalesceBattles([...previous,...rankedSaved,...result.battles]);
  await saveBattles(tag,merged.battles,result.coverage,merged.duplicateIds);
  return {tag,coverage:result.coverage,records:merged.battles.length};
}
function bounds(period:string,timeZone:string){try{return periodBounds(period,timeZone);}catch{throw new ApiError(400,'invalid_period','Choose a valid period and time zone.');}}
export async function getClanLeaderboard(input:string,period='day',timeZone='Asia/Singapore'){
  const window=bounds(period,timeZone),clan=await getClan(input),rankedWeek=rankedWindow(),tags=clan.memberList.map((m:{tag:string})=>m.tag);
  const [totals,weekly]=await Promise.all([clanTotals(tags,window.start,window.end),clanTotals(tags,rankedWeek.start,rankedWeek.end)]);
  const members=clan.memberList.map((member:{tag:string})=>({...member,...totals.find(row=>row.tag===member.tag),rankedAttacks:weekly.find(row=>row.tag===member.tag)?.rankedAttacks??null}));
  return {clanTag:clan.tag,clanName:clan.name,window,rankedWindow:rankedWeek,members,fetchedAt:new Date().toISOString(),synced:members.filter((m:{available?:boolean})=>m.available).length,total:members.length};
}
export async function syncClanMembers(input:string,tags:unknown,timeZone='Asia/Singapore'){
  bounds('month',timeZone);
  if(!Array.isArray(tags)||tags.length<1||tags.length>2||tags.some(tag=>typeof tag!=='string'))throw new ApiError(400,'invalid_members','Sync one or two clan members at a time.');
  const clan=await getClan(input),members=new Set(clan.memberList.map((m:{tag:string})=>m.tag));
  const selected=[...new Set(tags.map(tag=>normalizeTag(tag)))];
  if(selected.some(tag=>!members.has(tag)))throw new ApiError(400,'not_clan_member','One of these players is no longer in this clan. Refresh the roster.');
  const results=await Promise.allSettled(selected.map(tag=>collectPlayer(tag,timeZone)));
  return {members:results.map((result,index)=>result.status==='fulfilled'?result.value:{tag:selected[index],error:'Could not update this member. Their saved records are unchanged.'})};
}
export async function getMemberDetails(input:string,timeZone='Asia/Singapore'){
  const tag=normalizeTag(input);bounds('month',timeZone);
  const profile=await getPublicProfile(tag);
  const [sync,cwl]=await Promise.all([
    collectPlayer(tag,timeZone,profile),
    cached('cwl-player:'+tag,()=>communityGet('/player/'+encodeURIComponent(tag)+'/cwl/history?limit=12',undefined),300).then(data=>({status:'available',items:cwlAverages(data)})).catch(()=>({status:'unavailable',items:[]})),
  ]);
  const battles=await playerBattles(tag,collectionStart(timeZone));
  const month=periodBounds('month',timeZone),current=battles.filter(b=>new Date(b.date)>=new Date(month.start));
  const periods=Object.fromEntries(await Promise.all(['day','week','month'].map(async period=>{const window=periodBounds(period,timeZone),[rows,attacks]=await Promise.all([clanTotals([tag],window.start,window.end),memberAttacks(tag,window.start,window.end)]);return [period,{...rows[0],window,...attacks}];})));
  const now=new Date(),window=rankedWindow(profile,now),allowance=rankedAttackAllowance(profile),attackWindow=rankedAttackWindow(profile,now);
  const [rankedRows,rankedHistory,dailyRows]=await Promise.all([
    clanTotals([tag],window.start,window.end),
    memberAttacks(tag,window.start,window.end,{rankedLimit:allowance?.period==='week'?allowance.attacks:null}),
    allowance?.period==='day'?clanTotals([tag],attackWindow.start,attackWindow.end):Promise.resolve(null),
  ]);
  const progress=rankedAttackProgress(profile,sync.coverage.ranked,(dailyRows||rankedRows)[0]?.rankedAttacks,now);
  const ranked={...rankedRows[0],window,progress,attackHistory:{ranked:rankedHistory.attackHistory.ranked},tournament:sync.coverage.ranked};
  return {profile,periods,ranked,coverage:sync.coverage,usage:{classic:troopUsage(current,'classic'),war:troopUsage(current,'war'),limited:battles.length===3000},cwl,timeZone,fetchedAt:new Date().toISOString()};
}

export async function getCapitalRaids(input:string){
  const clan=await getClan(input);
  const payload=await cached('capital-raids:'+clan.tag,()=>officialGet('/clans/'+encodeURIComponent(clan.tag)+'/capitalraidseasons?limit=2',configuration(),undefined),30);
  return capitalRaidSummary(clan,payload);
}
export async function getClanGames(input:string){
  const clan=await getClan(input);
  // The automatic collector records the whole roster; fill any new member snapshots on demand.
  const current=await readClanGames(clan),missing=current.members.filter((m:any)=>!m.startedAt);
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<missing.length){const member=missing[cursor++];await getPublicProfile(member.tag).then(observeClanGames).catch(()=>null);}}));
  return readClanGames(clan);
}
export async function setClanGamesPoints(clanInput:string,playerInput:string,points:unknown){
  const clan=await getClan(clanInput),tag=normalizeTag(playerInput);
  if(!clan.memberList.some((m:any)=>m.tag===tag))throw new ApiError(400,'not_clan_member','This player is no longer on this clan’s roster.');
  const profile=await getPlayer(tag);
  if(profile.clan?.tag!==clan.tag)throw new ApiError(400,'not_clan_member','Refresh the clan roster before editing this member.');
  await verifyClanGamesScore(profile,points);
  return readClanGames(clan);
}
type War={state?:string;clan?:{tag?:string};opponent?:{tag?:string};startTime?:string;[key:string]:unknown};
export async function getCurrentClanWar(input:string){
  const tag=normalizeTag(input);await getClan(tag);
  return cached('war-view:'+tag,async()=>{
    const current=await officialGet('/clans/'+encodeURIComponent(tag)+'/currentwar',configuration(),undefined).then((data:War)=>({status:'available',data:orientWar(data,tag)})).catch((error:{status?:number})=>({status:error.status===403?'private':'unavailable',data:null}));
    if(current.data?.state&&current.data.state!=='notInWar')return {...current,source:'Supercell',fetchedAt:new Date().toISOString()};
    const group=await communityGet('/cwl/'+encodeURIComponent(tag)+'/group?season='+new Date().toISOString().slice(0,7),undefined).catch(()=>null);
    const embedded:War[]=group?.rounds?.flatMap((round:{warTags?:War[]})=>round.warTags||[]).filter((war:War)=>war.state&&['inWar','preparation'].includes(war.state)).map((war:War)=>orientWar(war,tag)).filter(Boolean)||[];
    if(embedded.length)return {status:'available',data:embedded.at(-1),source:'ClashKing CWL',fetchedAt:new Date().toISOString()};
    const officialGroup=await officialGet('/clans/'+encodeURIComponent(tag)+'/currentwar/leaguegroup',configuration(),undefined).catch(()=>null);
    if(officialGroup?.state&&officialGroup.state!=='ended'){
      const tags:string[]=officialGroup.rounds?.slice(-2).flatMap((r:{warTags?:string[]})=>r.warTags||[]).filter((t:string)=>t!=='#0').slice(0,8)||[];
      const wars=await Promise.all(tags.map(warTag=>officialGet('/clanwarleagues/wars/'+encodeURIComponent(warTag),configuration(),undefined).then((war:War)=>orientWar(war,tag)).catch(()=>null)));
      const active=wars.find(war=>war&&['inWar','preparation'].includes(war.state));
      if(active)return {status:'available',data:active,source:'Supercell CWL',fetchedAt:new Date().toISOString()};
    }
    return {...current,source:'Supercell',fetchedAt:new Date().toISOString()};
  },30);
}
