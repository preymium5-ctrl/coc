import {env} from '#raidroom-runtime';
import {communityGet} from './coc-service.mjs';
import {cached} from './clan-store';
import {advanceGames,clanGamesWindow,gamesLifetime,confirmGames} from './clan-events.mjs';
const keyFor=(clan:string,season:string,tag:string)=>'clan-games:'+clan+':'+season+':'+tag;
export async function observeClanGames(profile:any){
  const db=env.DB,clan=profile?.clan?.tag,window=clanGamesWindow();
  if(!db||!clan||gamesLifetime(profile)===null)return null;
  const key=keyFor(clan,window.season,profile.tag);
  const history=window.state==='upcoming'?null:await cached('clan-games-history:'+profile.tag+':'+window.season,()=>communityGet('/player/'+encodeURIComponent(profile.tag)+'/history/stats?type=clan_games&time%5Bafter%5D='+encodeURIComponent(window.start)+'&time%5Bbefore%5D='+encodeURIComponent(window.end)+'&limit=1000'),300).catch(()=>null);
  for(let attempt=0;attempt<4;attempt++){
    const old=await db.prepare('SELECT data,updated_at FROM site_settings WHERE key=?').bind(key).first<{data:string;updated_at:number}>();
    const prior=old?JSON.parse(old.data):null;
    if(prior?.lifetime>gamesLifetime(profile))return prior;
    const next=advanceGames(prior,profile,history),at=Math.max(Date.now(),(old?.updated_at||0)+1);
    const row=await db.prepare('INSERT INTO site_settings (key,data,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE site_settings.updated_at=? RETURNING data').bind(key,JSON.stringify(next),at,old?.updated_at??0).first<{data:string}>();
    if(row)return JSON.parse(row.data);
  }
  throw new Error('Clan Games observations could not be saved.');
}
export async function readClanGames(clan:any){
  const window=clanGamesWindow(),prefix='clan-games:'+clan.tag+':'+window.season+':';
  const saved=await env.DB.prepare('SELECT data FROM site_settings WHERE key LIKE ?').bind(prefix+'%').all<{data:string}>();
  const snapshots=new Map(saved.results.map(row=>{const data=JSON.parse(row.data);return [data.tag,data];}));
  const members=clan.memberList.map((member:any)=>{const score:any=snapshots.get(member.tag);return {tag:member.tag,name:member.name,townHallLevel:member.townHallLevel??null,points:score?.points??null,observedPoints:score?.observedPoints??null,exact:!!score?.exact,startedAt:score?.startedAt??null,updatedAt:score?.lastObservedAt??null,verifiedAt:score?.verifiedAt??null};}).sort((a:any,b:any)=>(b.points??b.observedPoints??-1)-(a.points??a.observedPoints??-1)||a.name.localeCompare(b.name));
  return {clanTag:clan.tag,clanName:clan.name,window,members,tracked:members.filter((m:any)=>m.startedAt).length,exact:members.filter((m:any)=>m.exact).length,totalRecorded:members.reduce((n:number,m:any)=>n+(m.points??m.observedPoints??0),0),fetchedAt:new Date().toISOString()};
}
export async function verifyClanGamesScore(profile:any,points:unknown){
  const window=clanGamesWindow(),next=confirmGames(profile,points);
  await env.DB.prepare('INSERT INTO site_settings (key,data,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(keyFor(profile.clan.tag,window.season,profile.tag),JSON.stringify(next),Date.now()).run();
  return next;
}
