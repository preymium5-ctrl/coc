'use strict';

const RaidroomRecords = (() => {
  function emptyState() {
    return {
      version: 1, demo: false, source: 'empty', updatedAt: null,
      player: { name: 'Connect your village', tag: '', townHallLevel: null, expLevel: null, trophies: null, heroes: [], troops: [], spells: [] },
      battles: [], snapshots: [], replays: [],
    };
  }

  function isSampleBattle(battle) {
    return !battle || battle.demo === true || String(battle.id || '').startsWith('demo-');
  }

  function migrateState(saved) {
    if (!saved || saved.version !== 1 || !saved.player || !Array.isArray(saved.battles) || !Array.isArray(saved.snapshots) || !Array.isArray(saved.replays)) return emptyState();
    const replays = saved.replays.filter(record => record && !record.demo && !String(record.id || '').startsWith('demo-'));
    if (saved.demo || saved.source === 'demo' || saved.player.tag === '#DEMO' || !saved.player.tag) return { ...emptyState(), replays };
    return { ...saved, demo: false, battles: saved.battles.filter(record => !isSampleBattle(record)), snapshots: saved.snapshots.filter(record => record && !record.demo), replays };
  }

  return { emptyState, isSampleBattle, migrateState };
})();
