const configuredInterval=Number(process.env.RAIDROOM_SYNC_INTERVAL_SECONDS);
export const SYNC_INTERVAL_MS=(Number.isFinite(configuredInterval)&&configuredInterval>=60&&configuredInterval<=86400?configuredInterval:process.env.VERCEL==='1'?86400:60)*1000;
export const SYNC_LEASE_MS=120_000;

export function readJob(db,tag){return db.prepare('SELECT * FROM clan_auto_sync WHERE clan_tag=?').bind(tag).first();}
export async function touchCollector(db,tag,now=Date.now()){
  await db.prepare("INSERT INTO clan_auto_sync (clan_tag,status,last_seen_at) VALUES (?,'idle',?) ON CONFLICT(clan_tag) DO UPDATE SET last_seen_at=excluded.last_seen_at").bind(tag,now).run();
}
export function claimJob(db,tag,runId,now=Date.now()){
  return db.prepare(`UPDATE clan_auto_sync SET run_id=?,status='running',started_at=?,next_at=?,lease_until=?,completed=0,total=0,failed=0,roster_tags='[]',completed_tags='[]',failed_tags='[]',version=version+1,last_seen_at=?
    WHERE clan_tag=? AND (status<>'running' OR lease_until<=?) AND next_at<=? RETURNING *`).bind(runId,now,now+SYNC_INTERVAL_MS,now+SYNC_LEASE_MS,now,tag,now,now).first();
}
export async function setJobRoster(db,tag,runId,tags,now=Date.now()){
  return db.prepare("UPDATE clan_auto_sync SET roster_tags=?,total=?,version=version+1,last_seen_at=? WHERE clan_tag=? AND run_id=? AND status='running' RETURNING *").bind(JSON.stringify(tags),tags.length,now,tag,runId).first();
}
export async function completeMembers(db,tag,runId,members,now=Date.now()){
  for(let attempt=0;attempt<8;attempt++){
    const row=await readJob(db,tag);
    if(!row||row.run_id!==runId||row.status!=='running')return row;
    const roster=new Set(JSON.parse(row.roster_tags)),done=new Set(JSON.parse(row.completed_tags)),failed=new Set(JSON.parse(row.failed_tags));
    for(const member of members){if(!roster.has(member.tag)||done.has(member.tag))continue;done.add(member.tag);if(member.failed)failed.add(member.tag);}
    const finished=done.size>=row.total,status=finished?(failed.size?'partial':'complete'):'running';
    const result=await db.prepare(`UPDATE clan_auto_sync SET completed_tags=?,failed_tags=?,completed=?,failed=?,status=?,finished_at=?,last_success_at=?,next_at=?,lease_until=?,last_seen_at=?,version=version+1
      WHERE clan_tag=? AND run_id=? AND status='running' AND version=? RETURNING *`).bind(JSON.stringify([...done]),JSON.stringify([...failed]),done.size,failed.size,status,finished?now:null,finished&&!failed.size?now:row.last_success_at,finished?Math.max(row.started_at+SYNC_INTERVAL_MS,now+10_000):row.next_at,finished?0:now+SYNC_LEASE_MS,now,tag,runId,row.version).first();
    if(result)return result;
  }
  throw new Error('Activity sync progress could not be saved.');
}
export async function failJob(db,tag,runId,now=Date.now()){
  await db.prepare("UPDATE clan_auto_sync SET status='failed',finished_at=?,next_at=?,lease_until=0,version=version+1 WHERE clan_tag=? AND run_id=? AND status='running'").bind(now,now+SYNC_INTERVAL_MS,tag,runId).run();
}
export async function queueJob(db,tag,now=Date.now()){
  // A manual request never steals an active run or impersonates its heartbeat.
  await db.prepare("INSERT INTO clan_auto_sync (clan_tag,status,next_at) VALUES (?,'idle',0) ON CONFLICT(clan_tag) DO UPDATE SET next_at=CASE WHEN status='running' AND lease_until>? THEN next_at ELSE 0 END").bind(tag,now).run();
}
export function publicJob(row,now=Date.now()){
  if(!row)return {state:'waiting',online:false,intervalSeconds:SYNC_INTERVAL_MS/1000,completed:0,total:0,failed:0,lastSyncedAt:null,nextSyncAt:null};
  const online=row.last_seen_at>0&&now-row.last_seen_at<Math.max(90_000,SYNC_INTERVAL_MS*1.5);
  const state=row.status==='running'&&row.lease_until<=now?'interrupted':row.status;
  const iso=value=>value?new Date(value).toISOString():null;
  return {state,online,intervalSeconds:SYNC_INTERVAL_MS/1000,completed:row.completed,total:row.total,failed:row.failed,lastSyncedAt:iso(row.finished_at),lastSuccessfulAt:iso(row.last_success_at),nextSyncAt:iso(row.next_at),startedAt:iso(row.started_at)};
}
