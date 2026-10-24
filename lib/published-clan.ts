import {env} from '#raidroom-runtime';
export type PublishedClan={tag:string;name:string;clanLevel:number;badgeUrls:{small?:string;medium?:string;large?:string};timeZone:string;updatedAt:string};
export async function publishedClan():Promise<PublishedClan|null>{
  if(!env.DB)throw new Error('Clan dashboard storage is not configured.');
  const row=await env.DB.prepare("SELECT data FROM site_settings WHERE key='public_clan'").first<{data:string}>();
  return row?JSON.parse(row.data):null;
}
