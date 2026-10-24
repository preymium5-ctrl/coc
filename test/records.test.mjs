import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const code = await readFile(new URL('../public/records.js', import.meta.url), 'utf8');
const records = runInNewContext(code + '\nRaidroomRecords;');
const stored = { version:1, demo:false, source:'live', player:{tag:'#80YQJ0RQQ',name:'Real player'}, battles:[{id:'official-1',source:'official'},{id:'manual-1'},{id:'demo-2'},{id:'legacy-sample',demo:true}], snapshots:[{trophies:5000}], replays:[{id:'personal-video'}], live:{activity:{rankings:{homeVillage:{localRank:17}}}} };

test('a new browser starts without a player, statistics, battles, or trophy history', () => {
  const s=records.emptyState();
  assert.equal(s.source,'empty');
  assert.equal(s.player.tag,'');
  assert.equal(s.player.townHallLevel,null);
  assert.equal(s.player.trophies,null);
  assert.equal(s.battles.length,0);
  assert.equal(s.snapshots.length,0);
});

test('existing sample villages are removed while personal recordings survive', () => {
  const s=records.migrateState({...stored,demo:true,source:'demo',player:{tag:'#DEMO'}});
  assert.equal(s.player.tag,'');
  assert.equal(s.battles.length,0);
  assert.equal(s.snapshots.length,0);
  assert.equal(s.replays[0].id,'personal-video');
});

test('mixed journals lose only marked sample battles and retain real API and manual records', () => {
  const s=records.migrateState(stored);
  assert.equal(s.player.tag,stored.player.tag);
  assert.deepEqual(Array.from(s.battles,b=>b.id),['official-1','manual-1']);
  assert.equal(s.snapshots[0].trophies,5000);
  assert.equal(s.live.activity.rankings.homeVillage.localRank,17);
  assert.equal(stored.battles.length,4);
});
