import {env} from '#raidroom-runtime';
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
  if(!tags.length)return [];
  const placeholders=tags.map(()=>'?').join(',');
  const [totals,syncs]=await Promise.all([
    database().prepare(`SELECT player_tag AS tag,COUNT(*) AS attacks, SUM(CASE WHEN gold IS NOT NULL AND elixir IS NOT NULL THEN gold+elixir ELSE 0 END) AS loot, SUM(CASE WHEN gold IS NOT NULL AND elixir IS NOT NULL THEN 1 ELSE 0 END) AS lootReported, SUM(COALESCE(dark,0)) AS dark, SUM(CASE WHEN dark IS NOT NULL THEN 1 ELSE 0 END) AS darkReported FROM raid_battles WHERE player_tag IN (${placeholders}) AND occurred_at >= ? AND occurred_at <= ? AND is_attack = 1 GROUP BY player_tag`).bind(...tags,new Date(start).getTime(),new Date(end).getTime()).all<{tag:string;attacks:number;loot:number;lootReported:number;dark:number;darkReported:number}>(),
    database().prepare(`SELECT tag,synced_at,coverage FROM player_sync WHERE tag IN (${placeholders})`).bind(...tags).all<{tag:string;synced_at:number;coverage:string}>(),
  ]);
  return tags.map(tag=>{const total=totals.results.find(row=>row.tag===tag),sync=syncs.results.find(row=>row.tag===tag);const coverage=sync?JSON.parse(sync.coverage):null;const available=!!total||coverage?.available;
    return {tag,available,attacks:available?total?.attacks||0:null,loot:total?total.lootReported?total.loot:null:available?0:null,lootReported:total?.lootReported||0,dark:total?total.darkReported?total.dark:null:available?0:null,darkReported:total?.darkReported||0,syncedAt:sync?new Date(sync.synced_at).toISOString():null,coverage};});
}
