import {env} from '#raidroom-runtime';
export type PublishedClan={tag:string;name:string;clanLevel:number;badgeUrls:{small?:string;medium?:string;large?:string};timeZone:string;updatedAt:string};
export async function publishedClan():Promise<PublishedClan|null>{
  if(!env.DB)throw new Error('Clan dashboard storage is not configured.');
  const row=await env.DB.prepare("SELECT data FROM site_settings WHERE key='public_clan'").first<{data:string}>();
  return row?JSON.parse(row.data):null;
}

// The owner's extension clan, verified against its official public profile.
export const EXTENSION_CLAN:PublishedClan={tag:'#2J028VPVY',name:'DuRuGiStA 0.1',clanLevel:17,badgeUrls:{small:'https://api-assets.clashofclans.com/badges/70/pLcf62UxfoAdm_Ot_9FU6vQdBUlxkQDwa9nM4QsobAE.png',large:'https://api-assets.clashofclans.com/badges/512/pLcf62UxfoAdm_Ot_9FU6vQdBUlxkQDwa9nM4QsobAE.png'},timeZone:'Asia/Singapore',updatedAt:'2026-10-24T00:00:00.000Z'};
export async function publishedClans():Promise<PublishedClan[]>{
  const main=await publishedClan();
  return main?[main,...(main.tag===EXTENSION_CLAN.tag?[]:[{...EXTENSION_CLAN,timeZone:main.timeZone}])]:[];
}
