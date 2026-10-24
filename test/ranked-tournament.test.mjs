import test from 'node:test';
import assert from 'node:assert/strict';
import {rankedWindow,rankedGroupMode,fetchRankedTournament} from '../lib/ranked-tournament.mjs';

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
