import test from 'node:test';
import assert from 'node:assert/strict';
import {hallMaximum,periodBounds,parseArmy,troopUsage,cwlAverages,orientWar,summarizeBattles} from '../lib/clan-analytics.mjs';

test('Town Hall caps are specific to the hall, and Builder Base heroes use Builder Hall',()=>{
  assert.equal(hallMaximum({name:'Barbarian King',village:'home'},'heroes',17,10),100);
  assert.equal(hallMaximum({name:'Barbarian King',village:'home'},'heroes',18,10),110);
  assert.equal(hallMaximum({name:'Battle Machine',village:'builderBase'},'heroes',18,9),30);
  assert.equal(hallMaximum({name:'Unicorn'},'pets',14,10),10);
});
test('calendar periods respect local midnight, Monday weeks, month boundaries, and DST',()=>{
  const now=new Date('2026-10-24T08:00:00Z');
  assert.equal(periodBounds('day','Asia/Singapore',now).start,'2026-10-23T16:00:00.000Z');
  assert.equal(periodBounds('week','Asia/Singapore',now).start,'2026-10-18T16:00:00.000Z');
  assert.equal(periodBounds('month','Asia/Singapore',now).start,'2026-09-30T16:00:00.000Z');
  assert.equal(periodBounds('day','America/New_York',new Date('2026-11-01T18:00:00Z')).start,'2026-11-01T04:00:00.000Z');
  assert.throws(()=>periodBounds('year','UTC',now));
});
test('army decoding counts actual troops, excludes donated/defending units, and never treats missing codes as empty armies',()=>{
  const army=parseArmy('h0p1e2_3d5x0u10x0-2x1s1x0');
  assert.deepEqual(army,[{name:'Barbarian',quantity:10},{name:'Archer',quantity:2}]);
  const b={type:'Multiplayer',mode:'farming',armyShareCode:'u10x0-2x1'};
  const usage=troopUsage([b,{...b,armyShareCode:null},{...b,type:'Defense'},{...b,mode:'war'}],'classic');
  assert.equal(usage.armies,1);assert.equal(usage.recordedAttacks,2);assert.equal(usage.units[0].quantity,10);
});
test('CWL averages use attacks made, show missed hits separately, and leave no-attack seasons unknown',()=>{
  const [row]=cwlAverages({items:[{season:'2026-10',attacks:[{stars:3},{stars:2},{stars:0}],missedAttacks:4}]});
  assert.equal(row.averageStars,5/3);assert.equal(row.attacks,3);assert.equal(row.missedAttacks,4);
  assert.equal(cwlAverages({items:[{season:'2026-09',attacks:[]}]})[0].averageStars,null);
});
test('war orientation follows the requested clan even when it is returned as the opponent',()=>{
  const war=orientWar({state:'inWar',clan:{tag:'#OTHER',stars:10},opponent:{tag:'#OURS',stars:20}},'#OURS');
  assert.equal(war.clan.stars,20);assert.equal(war.opponent.stars,10);
});
test('period totals exclude defenses and attacks outside the window, without inventing unknown loot',()=>{
  const window=periodBounds('day','Asia/Singapore',new Date('2026-10-24T08:00:00Z'));
  const b={type:'Legend',date:'2026-10-24T02:00:00Z',gold:10,elixir:20,dark:null};
  const result=summarizeBattles([b,{...b,type:'Defense'},{...b,date:'2026-10-23T15:59:59Z'},{...b,gold:null}],window);
  assert.equal(result.attacks,2);assert.equal(result.loot,30);assert.equal(result.lootReported,1);assert.equal(result.dark,null);
});
