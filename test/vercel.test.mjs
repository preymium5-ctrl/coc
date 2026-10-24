import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {libsqlStorage} from '../lib/libsql-storage.mjs';
import {migrate} from '../scripts/migrate-vercel.mjs';
import {touchCollector,claimJob,setJobRoster,completeMembers} from '../lib/activity-store.mjs';
import {scheduledAccess,runScheduledSync} from '../lib/scheduled-sync.mjs';

test('libSQL runs real migrations, battle JSON queries, atomic batches, and collector leases',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);await migrate(client);
    assert.equal((await client.execute('SELECT COUNT(*) AS n FROM raidroom_migrations')).rows[0].n,3);
    const db=libsqlStorage(client);
    await db.prepare("INSERT INTO raid_battles (id,player_tag,occurred_at,mode,is_attack,gold,elixir,dark,data) SELECT json_extract(value,'$.id'),'#V822RGUG',1000,'classic',1,123,456,NULL,value FROM json_each(?)").bind(JSON.stringify([{id:'observed:test',date:'2026-10-24'}])).run();
    assert.equal(await db.prepare('SELECT SUM(gold+elixir) AS loot FROM raid_battles').first('loot'),579);
    assert.equal((await db.prepare('SELECT data FROM raid_battles').all()).results.length,1);
    await assert.rejects(db.batch([db.prepare("INSERT INTO site_settings VALUES ('test','{}',1)"),db.prepare("INSERT INTO site_settings VALUES ('test','{}',2)")]));
    assert.equal(await db.prepare("SELECT * FROM site_settings WHERE key='test'").first(),null,'a failing batch rolls back');
    const now=Date.now();await touchCollector(db,'#V822RGUG',now);
    assert.equal((await claimJob(db,'#V822RGUG','one',now)).run_id,'one');
    assert.equal(await claimJob(db,'#V822RGUG','two',now),null);
    await setJobRoster(db,'#V822RGUG','one',['#P0Y'],now);
    assert.equal((await completeMembers(db,'#V822RGUG','one',[{tag:'#P0Y',failed:false}],now)).status,'complete');
  }finally{client.close();}
});
test('scheduler rejects missing and forged credentials',async()=>{
  const secret='a'.repeat(43),request=token=>new Request('https://raidroom.vercel.app/api/cron/activity',{headers:token?{authorization:'Bearer '+token}:{}});
  assert.equal(await scheduledAccess(request(secret),{CRON_SECRET:secret}),true);
  assert.equal(await scheduledAccess(request('b'.repeat(43)),{CRON_SECRET:secret}),false);
  assert.equal(await scheduledAccess(request(),{CRON_SECRET:secret}),false);
  assert.equal(await scheduledAccess(request(secret),{}),false);
});
test('scheduled sync awaits every member batch and stops cancelled work',async()=>{
  const tags=Array.from({length:9},(_,i)=>'#P'+i),seen=[];
  const result=await runScheduledSync(async()=>({job:{runId:'one',memberTags:tags},status:{completed:0}}),async input=>{
    await new Promise(resolve=>setTimeout(resolve,2));seen.push(...input.memberTags);
    assert.ok(input.memberTags.length<=2);return {status:{completed:seen.length}};
  });
  assert.deepEqual([...seen].sort(),[...tags].sort());assert.equal(result.completed,9);
  let batches=0;await runScheduledSync(async()=>({job:{runId:'one',memberTags:tags},status:{completed:0}}),async()=>{batches++;return {cancelled:true};});
  assert.equal(batches,2);
});
