/** @param {any} db @param {string} tag @param {string} start @param {string} end */
export async function readMemberAttacks(db,tag,start,end){
  const columns='id,occurred_at,mode,gold,elixir,dark,data';
  const scope='FROM raid_battles WHERE player_tag=? AND occurred_at>=? AND occurred_at<=? AND is_attack=1';
  // Bound each list in SQLite; the best hit searches the entire saved period.
  const result=await db.prepare(`
    SELECT 'classic' AS section,* FROM (SELECT ${columns} ${scope} AND mode='farming' ORDER BY occurred_at DESC,id ASC LIMIT 10)
    UNION ALL
    SELECT 'ranked' AS section,* FROM (SELECT ${columns} ${scope} AND mode IN ('ranked','legend') ORDER BY occurred_at DESC,id ASC LIMIT 10)
    UNION ALL
    SELECT 'best' AS section,* FROM (SELECT ${columns} ${scope} AND gold IS NOT NULL AND elixir IS NOT NULL ORDER BY gold+elixir DESC,occurred_at DESC,id ASC LIMIT 1)
  `).bind(...Array.from({length:3},()=>[tag,Date.parse(start),Date.parse(end)]).flat()).all();
  const project=row=>{
    const battle=JSON.parse(row.data);
    return {id:row.id,date:new Date(row.occurred_at).toISOString(),mode:row.mode,
      opponent:battle.opponentKnown&&typeof battle.opponent==='string'?battle.opponent:null,
      opponentTag:typeof battle.opponentTag==='string'?battle.opponentTag:null,
      townHall:Number.isInteger(battle.townHall)&&battle.townHall>0?battle.townHall:null,
      gold:row.gold,elixir:row.elixir,dark:row.dark,
      loot:row.gold!==null&&row.elixir!==null?row.gold+row.elixir:null,
      stars:battle.stars??null,destruction:battle.destruction??null};
  };
  const best=result.results.find(row=>row.section==='best');
  return {attackHistory:{classic:result.results.filter(row=>row.section==='classic').map(project),ranked:result.results.filter(row=>row.section==='ranked').map(project)},highestLootAttack:best?project(best):null};
}
