import test from 'node:test';
import assert from 'node:assert/strict';
import {rankedWindow,rankedGroupMode,rankedAttackAllowance,rankedAttackWindow,rankedAttackProgress,fetchRankedTournament} from '../lib/ranked-tournament.mjs';

test('ranked attack allowances follow every current league tier instead of a ten-log cap',()=>{
  const groups=[['Skeleton',1,3,6],['Barbarian',4,6,6],['Archer',7,9,8],['Wizard',10,12,8],
    ['Valkyrie',13,15,10],['Witch',16,18,10],['Golem',19,21,12],['P.E.K.K.A',22,24,12],
    ['Titan',25,27,12],['Dragon',28,30,14],['Electro',31,33,18]];
  for(const [name,start,end,attacks] of groups)for(let tier=start;tier<=end;tier++){
    const league=`${name} ${tier}`;
    assert.deepEqual(rankedAttackAllowance({leagueTier:{name:league}}),{league,attacks,period:'week'});
  }
  for(const [league,attacks,period] of [['Legend III',24,'week'],['Legend II',30,'week'],['Legend I',8,'day']]){
    assert.deepEqual(rankedAttackAllowance({leagueTier:{name:league}}),{league,attacks,period});
  }
  assert.equal(rankedAttackAllowance({league:{name:'Titan I'}}),null,'legacy leagues must not be mistaken for the current ranked tiers');
  assert.equal(rankedAttackAllowance({leagueTier:{name:'Future league'}}),null);
  assert.equal(rankedAttackAllowance(null),null);
});

test('weekly progress uses official completion, independently of the number of detailed logs saved',()=>{
  const now=new Date('2026-10-24T08:00:00Z'),profile={currentLeagueSeasonId:1792386000,leagueTier:{name:'Legend III'}};
  const tournament={status:'available',window:rankedWindow(profile,now),completedAttacks:21};
  const progress=rankedAttackProgress(profile,tournament,10,now);
  assert.equal(progress.completedAttacks,21);assert.equal(progress.attacks,24);assert.equal(progress.source,'official');
  assert.equal(rankedAttackProgress(profile,{...tournament,completedAttacks:0},null,now).completedAttacks,0);
  assert.equal(rankedAttackProgress(profile,{...tournament,window:{start:'2026-10-12T05:00:00Z'}},4,now).completedAttacks,4,'do not use completion from a different tournament');
  assert.equal(rankedAttackProgress(profile,{status:'unavailable'},4,now).source,'recorded');
  assert.equal(rankedAttackProgress(profile,{status:'unavailable'},null,now).completedAttacks,null,'unavailable is not zero');
  assert.equal(rankedAttackProgress({},tournament,10,now),null);
});

test('Legend I progress uses its eight-attack league day while its history retains the full tournament window',()=>{
  const profile={currentLeagueSeasonId:1792386000,leagueTier:{name:'Legend I'}},now=new Date('2026-10-24T08:00:00Z');
  const window=rankedAttackWindow(profile,now);
  assert.equal(window.start,'2026-10-24T05:00:00.000Z');assert.equal(window.resetAt,'2026-10-25T05:00:00.000Z');
  assert.equal(rankedAttackWindow(profile,new Date('2026-10-24T04:59:59Z')).start,'2026-10-23T05:00:00.000Z');
  const progress=rankedAttackProgress(profile,{status:'available',window:rankedWindow(profile,now),completedAttacks:50},3,now);
  assert.equal(progress.completedAttacks,3);assert.equal(progress.attacks,8);assert.equal(progress.source,'recorded');
  assert.equal(rankedWindow(profile,now).start,'2026-10-19T05:00:00.000Z','the daily counter must not reset the tournament history');
});

test('ranked weeks reset at Monday 05:00 UTC and do not reset at local midnight',()=>{
  const before=rankedWindow({},new Date('2026-10-19T04:59:59Z'));
  const after=rankedWindow({},new Date('2026-10-19T05:00:00Z'));
  assert.equal(before.start,'2026-10-12T05:00:00.000Z');
  assert.equal(before.resetAt,'2026-10-19T05:00:00.000Z');
  assert.equal(after.start,'2026-10-19T05:00:00.000Z');
  assert.equal(rankedWindow({},new Date('2026-10-24T16:00:00Z')).start,after.start);
});

test('the player season takes precedence, including inactive seasons and Legend I tournaments',()=>{
  const profile={currentLeagueSeasonId:1792386000,leagueTier:{name:'Legend III'}};
  const window=rankedWindow(profile,new Date('2026-11-02T08:00:00Z'));
  assert.equal(window.source,'player-season');assert.equal(window.start,'2026-10-19T05:00:00.000Z');
  assert.equal(window.end,'2026-10-26T04:59:59.999Z');
  assert.equal(rankedGroupMode(profile),'ranked');
  assert.equal(rankedGroupMode({leagueTier:{name:'Legend II'}}),'ranked');
  const legend={...profile,leagueTier:{name:'Legend I'}};
  assert.equal(rankedGroupMode(legend),'legend');
  assert.equal(rankedWindow(legend,new Date('2026-10-24T08:00:00Z')).resetAt,'2026-11-16T05:00:00.000Z');
  assert.equal(rankedWindow({currentLeagueSeasonId:'bad'},new Date('2026-10-24T08:00:00Z')).source,'weekly-reset');
});

test('the collector fetches the official player tournament, preserves counts and normalizes duplicate timestamps',async()=>{
  const profile={tag:'#P0Y',currentLeagueGroupTag:'#9PP22RQPJ',currentLeagueSeasonId:1792386000,leagueTier:{name:'Legend III'}};
  const config={baseUrl:'https://api.clashofclans.com/v1',token:'test-key'};
  let endpoint;
  const result=await fetchRankedTournament(profile,{config,now:new Date('2026-10-24T08:00:00Z'),fetcher:async(url,init)=>{
    endpoint=url;assert.equal(init.headers.Authorization,'Bearer test-key');
    return Response.json({members:[{playerTag:'#P0Y',leagueTrophies:240,attackWinCount:5,attackLoseCount:1}],attackLogs:[{creationTime:'2026-10-21T08:30:00.775Z',opponentName:'Opponent',stars:3,trophies:40}],defenseLogs:[{creationTime:'2026-10-21T07:30:00.300Z',stars:2}]});
  }});
  assert.ok(endpoint.includes('/leaguegroup/%239PP22RQPJ/1792386000?playerTag=%23P0Y'));
  assert.equal(result.completedAttacks,6);assert.equal(result.battles[0].date,'2026-10-21T08:30:00.000Z');
  assert.equal(result.battles[0].mode,'ranked');assert.equal(result.battles[1].type,'Defense');
  assert.equal(result.battles[0].gold,null);assert.equal(result.battles[0].townHall,null);
  assert.equal((await fetchRankedTournament({tag:'#P0Y'},{now:new Date('2026-10-24T08:00:00Z')})).status,'not_joined');
});
