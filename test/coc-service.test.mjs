import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, normalizeTag, getPlayer, getActivity, normalizeBattles, errorResponse } from '../lib/coc-service.mjs';

const config = { token: 'test-secret-never-for-clashking', baseUrl: 'https://cocproxy.royaleapi.dev/v1' };
const tag = '#80YQJ0RQQ';
const officialEntry = {
  attack: true, battleType: 'ranked', battleTimestamp: '20261024T061530.000Z', battleTime: 148,
  opponentPlayerTag: '#9PP22RQPJ', opponentName: 'Test opponent', opponentTownHallLevel: 18,
  stars: 3, destructionPercentage: 100,
  lootedResources: [{ name: 'gold', amount: 1000000 }, { name: 'elixir', amount: 900000 }, { name: 'darkElixir', amount: 8000 }],
  extraLootedResources: [{ name: 'gold', amount: 300000 }],
};
const json = data => Response.json(data);

test('player input is normalized and rejects paths before any upstream request', async () => {
  assert.equal(normalizeTag(' 80yqj0rqq '), tag);
  let called = false;
  await assert.rejects(getPlayer('../../secret', { config, fetcher: async () => { called = true; return json({}); } }), e => e.status === 400);
  assert.equal(called, false);
});

test('missing configuration is an actionable error, never a fabricated profile', async () => {
  await assert.rejects(getPlayer(tag, { config: { baseUrl: config.baseUrl }, fetcher: async () => json({}) }), e => e.code === 'setup_required');
});

test('a malformed upstream profile is a provider error rather than a player-tag error', async () => {
  await assert.rejects(getPlayer(tag,{config,fetcher:async()=>json({name:'Incomplete',townHallLevel:18})}),e=>e.status===502&&e.code==='invalid_profile');
});

test('official compact timestamps, durations, and resource arrays are mapped without counting bonuses twice', () => {
  const [battle] = normalizeBattles([officialEntry], tag);
  assert.equal(battle.date, '2026-10-24T06:15:30.000Z');
  assert.equal(battle.type, 'Ranked');
  assert.equal(battle.duration, 148);
  assert.equal(battle.gold, 1000000);
  assert.equal(battle.bonus.gold, 300000);
  assert.equal(battle.trophyChange, null);
});

test('unreported history fields remain unknown rather than becoming zero or a made-up opponent', () => {
  const [battle] = normalizeBattles({ items: [{ battleMode: 'farming', battleTime: '2026-10-24T06:00:00Z', stars: 2, destructionPercentage: 87, lootedResources: { gold: 1, elixir: 2, darkElixir: 3 } }] }, tag, 'clashking');
  assert.equal(battle.opponentKnown, false);
  assert.equal(battle.townHall, null);
  assert.equal(battle.trophyChange, null);
  assert.equal(battle.opponent, 'Farming raid');
  assert.equal(battle.gold, 1);
});

test('unavailable supplemental providers do not hide the official battle log, and receive no credential', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/battlelog') && !url.includes('/history')) return json([officialEntry]);
    if (url.includes('/leaguehistory')) return json([]);
    return new Response('down', { status: 503 });
  };
  const data = await getActivity(tag, { config, fetcher });
  assert.equal(data.battles.length, 1);
  assert.equal(data.coverage.recent.status, 'available');
  assert.equal(data.coverage.history.status, 'unavailable');
  for (const call of calls.filter(c => c.url.startsWith('https://api.clashk.ing/'))) assert.equal(call.init.headers.Authorization, undefined);
  for (const call of calls.filter(c => c.url.startsWith(config.baseUrl))) assert.equal(call.init.headers.Authorization, `Bearer ${config.token}`);
});

test('official group trophy deltas survive a duplicate entry from the main battle log', async () => {
  const fetcher = async url => {
    if (url.includes('/leaguegroup/')) return json({ members: [{playerTag:tag,leagueTrophies:300},{playerTag:'#9PP22RQPJ',leagueTrophies:400}], attackLogs: [{ creationTime:officialEntry.battleTimestamp,opponentName:officialEntry.opponentName,opponentPlayerTag:officialEntry.opponentPlayerTag,stars:3,destructionPercentage:100,trophies:40 }] });
    if (url.endsWith('/battlelog')) return json([officialEntry]);
    if (url.includes('/rankings')) return json({tag,homeVillage:{globalRank:12}});
    return json({items:[]});
  };
  const data = await getActivity(tag,{config,fetcher,groupTag:'#9PP22RQPJ',seasonId:123,groupMode:'ranked'});
  assert.equal(data.battles.length,1);
  assert.equal(data.battles[0].trophyChange,40);
  assert.equal(data.battles[0].gold,1000000);
  assert.equal(data.currentGroup.position,2);
});

test('upstream errors do not echo credentials or arbitrary upstream bodies', async () => {
  try {
    await getPlayer(tag, {config,fetcher:async()=>new Response(config.token,{status:403})});
    assert.fail('Expected a rejected credential error');
  } catch(error) {
    assert.ok(error instanceof ApiError);
    const response=errorResponse(error);
    assert.equal(response.status,403);
    assert.equal((await response.text()).includes(config.token),false);
  }
});

test('league group results remain available when the general battle feed is down', async () => {
  const fetcher=async url=>url.includes('/leaguegroup/')?json({members:[],attackLogs:[{creationTime:officialEntry.battleTimestamp,stars:3,destructionPercentage:100,trophies:40}]}):new Response('down',{status:503});
  const data=await getActivity(tag,{config,fetcher,groupTag:'#9PP22RQPJ',seasonId:123});
  assert.equal(data.battles.length,1);
  assert.equal(data.coverage.recent.status,'available');
  assert.equal(data.coverage.recent.message,undefined);
});
