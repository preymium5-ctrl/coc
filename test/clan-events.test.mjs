import test from 'node:test';
import assert from 'node:assert/strict';
import {capitalRaidSummary,clanGamesWindow,advanceGames,confirmGames} from '../lib/clan-events.mjs';

const clan={tag:'#V822RGUG',name:'Marine',clanCapital:{capitalHallLevel:10,districts:[{id:1,name:'Capital Peak',districtHallLevel:10}]},memberList:[{tag:'#A',name:'Alpha',townHallLevel:17},{tag:'#B',name:'Bravo',townHallLevel:18},{tag:'#C',name:'Charlie',townHallLevel:15}]};
const season={startTime:'20261023T070000.000Z',endTime:'20261026T070000.000Z',capitalTotalLoot:35000,totalAttacks:11,raidsCompleted:1,enemyDistrictsDestroyed:8,members:[{tag:'#A',name:'Alpha',attacks:5,attackLimit:5,bonusAttackLimit:1,capitalResourcesLooted:10000},{tag:'#LEFT',name:'Former',attacks:6,attackLimit:5,bonusAttackLimit:1,capitalResourcesLooted:25000}]};
test('Capital raids rank actual participants and include current non-attackers and former participants',()=>{
  const d=capitalRaidSummary(clan,{items:[season]},new Date('2026-10-24T00:00:00Z'));
  assert.equal(d.capitalHallLevel,10);assert.equal(d.participants,2);assert.equal(d.weekend.state,'ongoing');
  assert.equal(d.weekend.totalLoot,35000);assert.equal(d.members.length,4);
  assert.deepEqual(d.members.map(m=>[m.tag,m.rank]),[['#LEFT',1],['#A',2],['#B',null],['#C',null]]);
  assert.equal(d.members[0].currentMember,false);assert.equal(d.members[0].townHallLevel,null);
  assert.equal(d.members[1].attackLimit,6);assert.equal(d.members[2].attacks,0);
  assert.equal(capitalRaidSummary(clan,{items:[season]},new Date('2026-10-27')).weekend.state,'ended');
});
test('missing raid weekends remain unknown and unsorted results use the most recent weekend',()=>{
  const empty=capitalRaidSummary(clan,{items:[]});assert.equal(empty.weekend,null);
  assert.equal(empty.members[0].capitalGold,null);assert.equal(empty.members[0].attacks,null);
  const old={...season,startTime:'20261016T070000.000Z',endTime:'20261019T070000.000Z',capitalTotalLoot:1};
  assert.equal(capitalRaidSummary(clan,{items:[old,season]}).weekend.totalLoot,35000);
});
const profile=(value,clanTag='#V822RGUG')=>({tag:'#P0Y',name:'Player',clan:{tag:clanTag},achievements:[{name:'Games Champion',value}]});
test('joining Games tracking mid-event never passes lifetime points off as event points',()=>{
  const first=advanceGames(null,profile(205655),{items:[]},new Date('2026-10-24T01:00:00Z'));
  assert.equal(first.points,null);assert.equal(first.observedPoints,0);assert.equal(first.exact,false);
  const next=advanceGames(first,profile(206655),null,new Date('2026-10-24T02:00:00Z'));
  assert.equal(next.points,null);assert.equal(next.observedPoints,1000);
  const moved=advanceGames(next,profile(206655,'#2J028VPVY'),null,new Date('2026-10-24T03:00:00Z'));
  assert.equal(moved.observedPoints,0);assert.equal(moved.exact,false,'a new clan must not inherit another clan’s score');
});
test('a pre-event observation yields exact current Games points and new months start independently',()=>{
  const first=advanceGames(null,profile(10000),null,new Date('2026-10-21T08:00:00Z'));
  const next=advanceGames(first,profile(12300),null,new Date('2026-10-24T08:00:00Z'));
  assert.equal(next.exact,true);assert.equal(next.points,2300);
  const reset=advanceGames(next,profile(12300),null,new Date('2026-11-24T08:00:00Z'));
  assert.equal(reset.points,null);assert.equal(reset.observedPoints,0);
  assert.equal(clanGamesWindow(new Date('2026-10-22T07:59:59Z')).state,'upcoming');
  assert.equal(clanGamesWindow(new Date('2026-10-22T08:00:00Z')).state,'ongoing');
  assert.equal(clanGamesWindow(new Date('2026-10-28T08:00:00Z')).state,'ended');
});
test('Games history only counts positive increases in this clan and event, keeping partial coverage explicit',()=>{
  const event=(delta,clanTag='#V822RGUG',eventTime='2026-10-23T09:00:00Z',statType='clan_games')=>({delta,clanTag,eventTime,statType});
  const result=advanceGames(null,profile(20000),{items:[event(1000),event(1500),event(-500),event(9000,'#OTHER'),event(9000,undefined,'2026-09-23'),event(9000,undefined,undefined,'donations')]},new Date('2026-10-24'));
  assert.equal(result.observedPoints,2500);assert.equal(result.points,null);assert.equal(result.exact,false);
});
test('admin-confirmed Games scores continue increasing automatically and invalid scores cannot be stored',()=>{
  const now=new Date('2026-10-24T08:00:00Z'),confirmed=confirmGames(profile(205655),3000,now);
  assert.equal(confirmed.points,3000);assert.equal(confirmed.baselineLifetime,202655);
  const next=advanceGames(confirmed,profile(206655),null,new Date('2026-10-24T09:00:00Z'));
  assert.equal(next.points,4000);assert.equal(next.exact,true);assert.equal(next.verifiedAt,now.toISOString());
  for(const bad of [-1,3.5,'3000',3000000,205656])assert.throws(()=>confirmGames(profile(205655),bad,now),e=>e.status===400);
  assert.throws(()=>confirmGames(profile(20000),100,new Date('2026-10-01')),e=>e.status===400);
});
