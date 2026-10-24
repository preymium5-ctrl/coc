import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readJob,touchCollector,claimJob,setJobRoster,completeMembers,failJob,queueJob,publicJob,SYNC_INTERVAL_MS,SYNC_LEASE_MS} from '../lib/activity-store.mjs';

function fixture(t){
  const sql=new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(new URL('../drizzle/0002_slippery_blade.sql',import.meta.url),'utf8'));
  t.after(()=>sql.close());
  const db={
    prepare(query){
      const statement=sql.prepare(query);
      return {bind(...values){return {
        async first(){return statement.get(...values)||null;},
        async run(){const result=statement.run(...values);return {meta:{changes:result.changes}};},
      };}};
    },
  };
  return db;
}
const tag='#V822RGUG',now=1_800_000_000_000;

test('main and extension clans maintain independent rosters, leases, progress, and sync schedules',async t=>{
  const db=fixture(t),extension='#2J028VPVY';
  for(const clan of [tag,extension])await touchCollector(db,clan,now);
  assert.ok(await claimJob(db,tag,'main-run',now));assert.ok(await claimJob(db,extension,'extension-run',now));
  await setJobRoster(db,tag,'main-run',['#MAIN'],now);await setJobRoster(db,extension,'extension-run',['#EXT'],now);
  await completeMembers(db,tag,'main-run',[{tag:'#MAIN'}],now+100);
  assert.equal((await readJob(db,tag)).status,'complete');assert.equal((await readJob(db,extension)).completed,0);
  await completeMembers(db,extension,'main-run',[{tag:'#EXT'}],now+200);
  assert.equal((await readJob(db,extension)).completed,0,'another clan’s run cannot acknowledge this roster');
  await completeMembers(db,extension,'extension-run',[{tag:'#EXT'}],now+300);
  assert.equal((await readJob(db,extension)).status,'complete');
  assert.deepEqual(JSON.parse((await readJob(db,extension)).roster_tags),['#EXT']);
});
test('the database lease allows one collector to claim a due run',async t=>{
  const db=fixture(t);await touchCollector(db,tag,now);
  const runs=await Promise.all([claimJob(db,tag,'one',now),claimJob(db,tag,'two',now)]);
  assert.equal(runs.filter(Boolean).length,1);
  assert.equal((await readJob(db,tag)).status,'running');
});
test('concurrent member completions and repeated acknowledgements never overcount progress',async t=>{
  const db=fixture(t);await touchCollector(db,tag,now);await claimJob(db,tag,'one',now);
  await setJobRoster(db,tag,'one',['#A','#B','#C','#D'],now);
  await Promise.all([
    completeMembers(db,tag,'one',[{tag:'#A'},{tag:'#B'}],now+1000),
    completeMembers(db,tag,'one',[{tag:'#C'},{tag:'#D'}],now+1000),
  ]);
  await completeMembers(db,tag,'one',[{tag:'#A'},{tag:'#B'}],now+2000);
  const job=await readJob(db,tag);
  assert.equal(job.completed,4);assert.equal(job.failed,0);assert.equal(job.status,'complete');
  assert.equal(new Set(JSON.parse(job.completed_tags)).size,4);
  assert.equal(job.last_success_at,now+1000);
  assert.equal(await claimJob(db,tag,'early',now+2000),null);
  const next=await claimJob(db,tag,'next',now+SYNC_INTERVAL_MS);
  assert.ok(next);
  assert.equal(publicJob(next,now+SYNC_INTERVAL_MS).lastSyncedAt,new Date(now+1000).toISOString());
});
test('lost collectors recover after their lease; stale runs cannot overwrite a new run',async t=>{
  const db=fixture(t);await touchCollector(db,tag,now);await claimJob(db,tag,'old',now);
  assert.equal(await claimJob(db,tag,'too-early',now+SYNC_INTERVAL_MS),null);
  assert.ok(await claimJob(db,tag,'replacement',now+SYNC_LEASE_MS));
  await setJobRoster(db,tag,'replacement',['#B'],now+SYNC_LEASE_MS);
  await completeMembers(db,tag,'old',[{tag:'#A'}],now+SYNC_LEASE_MS+100);
  const job=await readJob(db,tag);assert.equal(job.run_id,'replacement');assert.equal(job.completed,0);
});
test('a partial sync retains an honest result and is due for automatic retry',async t=>{
  const db=fixture(t);await touchCollector(db,tag,now);await claimJob(db,tag,'one',now);
  await setJobRoster(db,tag,'one',['#A','#B'],now);
  const result=await completeMembers(db,tag,'one',[{tag:'#A',failed:false},{tag:'#B',failed:true}],now+1000);
  assert.equal(result.status,'partial');assert.equal(result.completed,2);assert.equal(result.failed,1);assert.equal(result.last_success_at,null);
  assert.equal(result.next_at,now+SYNC_INTERVAL_MS);
  assert.ok(await claimJob(db,tag,'retry',now+SYNC_INTERVAL_MS));
});
test('manual requests queue a sync without stealing active work or faking a heartbeat',async t=>{
  const db=fixture(t);await queueJob(db,tag,now);
  assert.equal(publicJob(await readJob(db,tag),now).online,false);
  await touchCollector(db,tag,now);await claimJob(db,tag,'one',now);
  await queueJob(db,tag,now+1000);
  assert.equal((await readJob(db,tag)).next_at,now+SYNC_INTERVAL_MS);
  assert.equal(await claimJob(db,tag,'steal',now+1000),null);
});
test('failed runs are retried, and public status distinguishes an offline collector',async t=>{
  const db=fixture(t);await touchCollector(db,tag,now);await claimJob(db,tag,'one',now);
  await failJob(db,tag,'one',now+1000);
  const job=await readJob(db,tag),status=publicJob(job,now+2000);
  assert.equal(status.state,'failed');assert.equal(status.online,true);assert.equal(status.lastSuccessfulAt,null);
  assert.equal(publicJob(job,now+91000).online,false);
  assert.equal(await claimJob(db,tag,'early',now+SYNC_INTERVAL_MS),null);
  assert.ok(await claimJob(db,tag,'retry',now+SYNC_INTERVAL_MS+1000));
});
