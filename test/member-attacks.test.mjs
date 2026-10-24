import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {libsqlStorage} from '../lib/libsql-storage.mjs';
import {migrate} from '../scripts/migrate-vercel.mjs';
import {readMemberAttacks} from '../lib/member-attacks.mjs';
import {rankedWindow} from '../lib/ranked-tournament.mjs';
import {periodBounds} from '../lib/clan-analytics.mjs';

test('ranked histories expand to the league allowance and retain full Legend I tournament logs; classic stays at ten',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),tag='#P0Y',start='2026-10-19T05:00:00Z',end='2026-10-26T04:59:59Z',at=Date.parse(start);
    for(let i=0;i<40;i++)for(const mode of ['farming','ranked'])await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,occurred_at,is_attack,data) VALUES (?,?,?,?,?,?)').bind(mode+':'+i,tag,mode,at+i*3600000,1,'{}').run();
    await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,occurred_at,is_attack,data) VALUES (?,?,?,?,?,?)').bind('defense',tag,'ranked',at+41*3600000,0,'{}').run();
    for(const limit of [6,8,10,12,14,18,24,30]){
      const result=await readMemberAttacks(db,tag,start,end,{rankedLimit:limit});
      assert.equal(result.attackHistory.ranked.length,limit);assert.equal(result.attackHistory.classic.length,10);
      assert.equal(result.attackHistory.ranked[0].id,'ranked:39');
      assert.equal(result.attackHistory.ranked.at(-1).id,'ranked:'+(40-limit));
    }
    assert.equal((await readMemberAttacks(db,tag,start,end,{rankedLimit:null})).attackHistory.ranked.length,40,'full tournament history includes earlier league days');
    await assert.rejects(readMemberAttacks(db,tag,start,end,{rankedLimit:0}),RangeError);
    await assert.rejects(readMemberAttacks(db,tag,start,end,{rankedLimit:NaN}),RangeError);
  }finally{client.close();}
});

test('classic and ranked histories return the newest ten attacks per mode, with opponent and exact loot details',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),tag='#P0Y',start='2026-10-24T00:00:00Z',end='2026-10-24T23:00:00Z',at=Date.parse(start);
    async function insert(id,mode,offset,isAttack=1,gold=100,elixir=200,fields={}){
      await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,occurred_at,is_attack,gold,elixir,dark,data) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,tag,mode,at+offset,isAttack,gold,elixir,12,JSON.stringify({opponent:'Cesar',opponentKnown:true,opponentTag:'#QVRGGP2LC',townHall:16,stars:3,destruction:100,...fields})).run();
    }
    for(let i=0;i<15;i++){await insert('classic:'+i,'farming',i);await insert('ranked:'+i,i%2?'legend':'ranked',i);}
    await insert('defense','farming',100,0,999999,999999);
    await insert('before','farming',-1,1,999999,999999);
    await insert('after','ranked',24*3600000,1,999999,999999);
    await insert('war','war',100);
    await insert('unknown','other',100);
    await insert('partial','farming',101,1,999999,null,{opponent:'Farming raid',opponentKnown:false,townHall:null,stars:null});
    await insert('best','farming',0,1,1831120,1829843);
    const result=await readMemberAttacks(db,tag,start,end);
    assert.equal(result.attackHistory.classic.length,10);assert.equal(result.attackHistory.ranked.length,10);
    assert.deepEqual(result.attackHistory.ranked.map(b=>b.id),Array.from({length:10},(_,i)=>'ranked:'+(14-i)));
    assert.equal(result.attackHistory.classic[0].id,'partial');assert.equal(result.attackHistory.classic[0].opponent,null);assert.equal(result.attackHistory.classic[0].townHall,null);assert.equal(result.attackHistory.classic[0].loot,null);
    assert.equal(result.attackHistory.classic.some(b=>b.id==='best'),false,'the best hit need not be in the ten newest attacks');
    assert.deepEqual(result.highestLootAttack,{id:'best',date:new Date(start).toISOString(),mode:'farming',opponent:'Cesar',opponentTag:'#QVRGGP2LC',townHall:16,gold:1831120,elixir:1829843,dark:12,loot:3660963,stars:3,destruction:100});
    assert.deepEqual(await readMemberAttacks(db,'#OTHER',start,end),{attackHistory:{classic:[],ranked:[]},highestLootAttack:null});
  }finally{client.close();}
});

test('a zero-loot attack can be the best hit; defense and incomplete loot cannot',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),start='2026-10-24T00:00:00Z',end='2026-10-24T23:00:00Z';
    for(const [id,gold,elixir,attack] of [['partial',999,null,1],['defense',999,999,0],['zero',0,0,1]])await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,occurred_at,is_attack,gold,elixir,data) VALUES (?,?,?,?,?,?,?,?)').bind(id,'#P0Y','farming',Date.parse(start),attack,gold,elixir,'{}').run();
    const result=await readMemberAttacks(db,'#P0Y',start,end);
    assert.equal(result.highestLootAttack.id,'zero');assert.equal(result.highestLootAttack.loot,0);assert.equal(result.highestLootAttack.opponent,null);
    await db.prepare("DELETE FROM raid_battles WHERE id='zero'").run();
    assert.equal((await readMemberAttacks(db,'#P0Y',start,end)).highestLootAttack,null);
  }finally{client.close();}
});

test('ranked history retains earlier days in its tournament while classic history follows Today',async()=>{
  const client=createClient({url:':memory:'});
  try{
    await migrate(client);const db=libsqlStorage(client),now=new Date('2026-10-24T08:00:00Z');
    const week=rankedWindow({currentLeagueSeasonId:1792386000},now),day=periodBounds('day','Asia/Singapore',now);
    for(const [id,mode,date,attack] of [
      ['earlier-ranked','ranked','2026-10-20T08:00:00Z',1],['today-classic','farming','2026-10-24T07:00:00Z',1],
      ['old-classic','farming','2026-10-20T08:00:00Z',1],['before-season','ranked','2026-10-19T04:59:59Z',1],
      ['ranked-defense','ranked','2026-10-22T08:00:00Z',0],['future','ranked','2026-10-26T05:00:00Z',1],
    ])await db.prepare('INSERT INTO raid_battles (id,player_tag,mode,occurred_at,is_attack,data) VALUES (?,?,?,?,?,?)').bind(id,'#P0Y',mode,Date.parse(date),attack,'{}').run();
    const classic=await readMemberAttacks(db,'#P0Y',day.start,day.end),ranked=await readMemberAttacks(db,'#P0Y',week.start,week.end);
    assert.deepEqual(classic.attackHistory.classic.map(b=>b.id),['today-classic']);
    assert.deepEqual(ranked.attackHistory.ranked.map(b=>b.id),['earlier-ranked']);
    assert.equal(classic.attackHistory.ranked.length,0,'the daily filter would have hidden the completed ranked attack');
  }finally{client.close();}
});
