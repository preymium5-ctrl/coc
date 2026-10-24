/** @param {any} db @param {string[]} tags @param {string} start @param {string} end */
export async function readClanTotals(db,tags,start,end){
  if(!tags.length)return [];
  const placeholders=tags.map(()=>'?').join(',');
  const [totals,syncs]=await Promise.all([
    db.prepare(`SELECT player_tag AS tag,COUNT(*) AS attacks,
      SUM(CASE WHEN mode IN ('ranked','legend') THEN 1 ELSE 0 END) AS rankedAttacks,
      SUM(CASE WHEN mode='farming' THEN 1 ELSE 0 END) AS classicAttacks,
      MAX(CASE WHEN gold IS NOT NULL AND elixir IS NOT NULL THEN gold+elixir END) AS highestLoot,
      SUM(CASE WHEN gold IS NOT NULL AND elixir IS NOT NULL THEN gold+elixir ELSE 0 END) AS loot,
      SUM(CASE WHEN gold IS NOT NULL AND elixir IS NOT NULL THEN 1 ELSE 0 END) AS lootReported,
      SUM(COALESCE(dark,0)) AS dark,
      SUM(CASE WHEN dark IS NOT NULL THEN 1 ELSE 0 END) AS darkReported
      FROM raid_battles WHERE player_tag IN (${placeholders}) AND occurred_at >= ? AND occurred_at <= ? AND is_attack = 1 GROUP BY player_tag`)
      .bind(...tags,new Date(start).getTime(),new Date(end).getTime()).all(),
    db.prepare(`SELECT tag,synced_at,coverage FROM player_sync WHERE tag IN (${placeholders})`).bind(...tags).all(),
  ]);
  return tags.map(tag=>{
    const total=totals.results.find(row=>row.tag===tag),sync=syncs.results.find(row=>row.tag===tag);
    const coverage=sync?JSON.parse(sync.coverage):null,available=!!total||!!coverage?.available;
    return {tag,available,attacks:available?total?.attacks||0:null,
      rankedAttacks:available?total?.rankedAttacks||0:null,classicAttacks:available?total?.classicAttacks||0:null,
      highestLoot:total?.highestLoot??null,
      loot:total?total.lootReported?total.loot:null:available?0:null,lootReported:total?.lootReported||0,
      dark:total?total.darkReported?total.dark:null:available?0:null,darkReported:total?.darkReported||0,
      syncedAt:sync?new Date(sync.synced_at).toISOString():null,coverage};
  });
}
