import {env} from '#raidroom-runtime';
import {readClanTotals} from './clan-totals.mjs';
import {readMemberAttacks} from './member-attacks.mjs';
type Battle={id:string;date:string;type:string;mode:string;gold:number|null;elixir:number|null;dark:number|null;[key:string]:unknown};
function database(){if(!env.DB)throw new Error('Clan storage is not configured.');return env.DB;}
export async function cached<T>(key:string,loader:()=>Promise<T>,seconds=60):Promise<T>{
  const db=database();const saved=await db.prepare('SELECT data, expires_at FROM public_cache WHERE key = ?').bind(key).first<{data:string;expires_at:number}>();
  if(saved&&saved.expires_at>Date.now())return JSON.parse(saved.data) as T;
  const value=await loader();await db.prepare('INSERT INTO public_cache (key,data,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data, expires_at=excluded.expires_at').bind(key,JSON.stringify(value),Date.now()+seconds*1000).run();return value;
}
export async function playerBattles(tag:string,start:string){
  const rows=await database().prepare('SELECT data FROM raid_battles WHERE player_tag = ? AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 3000').bind(tag,new Date(start).getTime()).all<{data:string}>();
  return rows.results.map(row=>JSON.parse(row.data) as Battle);
}
export async function saveBattles(tag:string,battles:Battle[],coverage:unknown){
  const db=database();
  for(let offset=0;offset<battles.length;offset+=100){
    const rows=battles.slice(offset,offset+100).map(b=>({...b,playerTag:tag,occurredAt:new Date(b.date).getTime(),isAttack:b.type==='Defense'?0:1}));
    await db.prepare(`INSERT INTO raid_battles (id,player_tag,occurred_at,mode,is_attack,gold,elixir,dark,data)
      SELECT json_extract(value,'$.id'),json_extract(value,'$.playerTag'),json_extract(value,'$.occurredAt'),json_extract(value,'$.mode'),json_extract(value,'$.isAttack'),json_extract(value,'$.gold'),json_extract(value,'$.elixir'),json_extract(value,'$.dark'),value FROM json_each(?) WHERE 1
      ON CONFLICT(id) DO UPDATE SET gold=excluded.gold,elixir=excluded.elixir,dark=excluded.dark,data=excluded.data WHERE raid_battles.data IS NOT excluded.data`).bind(JSON.stringify(rows)).run();
  }
  await db.prepare('INSERT INTO player_sync (tag,synced_at,coverage) VALUES (?,?,?) ON CONFLICT(tag) DO UPDATE SET synced_at=excluded.synced_at,coverage=excluded.coverage').bind(tag,Date.now(),JSON.stringify(coverage)).run();
}
export async function syncInfo(tag:string){return database().prepare('SELECT synced_at,coverage FROM player_sync WHERE tag = ?').bind(tag).first<{synced_at:number;coverage:string}>();}
export async function clanTotals(tags:string[],start:string,end:string){
  return readClanTotals(database(),tags,start,end);
}
export async function memberAttacks(tag:string,start:string,end:string){return readMemberAttacks(database(),tag,start,end);}
