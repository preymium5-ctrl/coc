import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {libsqlStorage} from '../lib/libsql-storage.mjs';
import {migrate} from '../scripts/migrate-vercel.mjs';
import {readClanTotals} from '../lib/clan-totals.mjs';
import {periodBounds} from '../lib/clan-analytics.mjs';

test('member activity counts canonical modes and takes the best complete single attack within the selected window',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),tag='#P0Y',now=new Date('2026-10-24T08:00:00Z');
    const day=periodBounds('day','Asia/Singapore',now),inside=Date.parse(day.start),outside=inside-1;
    const records=[
      ['ranked',1,100,200,inside],['legend',1,500,20,inside],['farming',1,200,900,inside],
      ['war',1,null,null,inside],['cwl',1,null,null,inside],['friendly',1,null,null,inside],['other',1,null,null,inside],
      ['ranked',0,9000,9000,inside],['farming',0,9000,9000,inside],
      ['farming',1,8000,8000,outside],['ranked',1,10000,10000,now.getTime()+1],
      ['farming',1,90000,null,inside],
    ];
    for(const [i,row] of records.entries())await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,is_attack,gold,elixir,occurred_at,data) VALUES (?,?,?,?,?,?,?,?)').bind('battle:'+i,tag,...row,'{}').run();
    const [today]=await readClanTotals(db,[tag],day.start,day.end);
    assert.equal(today.attacks,8);assert.equal(today.rankedAttacks,2);assert.equal(today.classicAttacks,2);
    assert.equal(today.loot,1920);assert.equal(today.highestLoot,1100);assert.equal(today.lootReported,3);
    for(const period of ['week','month']){const window=periodBounds(period,'Asia/Singapore',now),[row]=await readClanTotals(db,[tag],window.start,window.end);assert.equal(row.classicAttacks,3);assert.equal(row.highestLoot,16000);}
    assert.deepEqual(await readClanTotals(db,[],day.start,day.end),[]);
    assert.equal((await readClanTotals(db,['#OTHER'],day.start,day.end))[0].highestLoot,null);
    const many=Array.from({length:3002},(_,i)=>({id:'many:'+i,at:inside+i,gold:i?1:1000000,elixir:i?1:2000000}));
    await db.prepare("INSERT INTO raid_battles (id,player_tag,mode,is_attack,gold,elixir,occurred_at,data) SELECT json_extract(value,'$.id'),'#LARGE','farming',1,json_extract(value,'$.gold'),json_extract(value,'$.elixir'),json_extract(value,'$.at'),value FROM json_each(?)").bind(JSON.stringify(many)).run();
    const [large]=await readClanTotals(db,['#LARGE'],day.start,day.end);
    assert.equal(large.classicAttacks,3002);assert.equal(large.highestLoot,3000000,'the best hit can be older than the latest 3,000 records');
  }finally{client.close();}
});

test('unavailable feeds, no attacks, and reported zero loot remain distinct',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),start='2026-10-24T00:00:00Z',end='2026-10-24T12:00:00Z';
    for(const [tag,available] of [['#EMPTY',true],['#FAILED',false]])await db.prepare('INSERT INTO player_sync VALUES (?,?,?)').bind(tag,Date.now(),JSON.stringify({available})).run();
    for(const [tag,gold,elixir] of [['#ZERO',0,0],['#UNKNOWN',100,null]])await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,is_attack,gold,elixir,occurred_at,data) VALUES (?,?,?,?,?,?,?,?)').bind(tag,tag,'farming',1,gold,elixir,Date.parse(start),'{}').run();
    const [empty,failed,zero,unknown]=await readClanTotals(db,['#EMPTY','#FAILED','#ZERO','#UNKNOWN'],start,end);
    assert.equal(empty.classicAttacks,0);assert.equal(empty.rankedAttacks,0);assert.equal(empty.highestLoot,null);
    assert.equal(failed.classicAttacks,null);assert.equal(failed.rankedAttacks,null);assert.equal(failed.highestLoot,null);
    assert.equal(zero.classicAttacks,1);assert.equal(zero.highestLoot,0);
    assert.equal(unknown.classicAttacks,1);assert.equal(unknown.highestLoot,null);
  }finally{client.close();}
});
