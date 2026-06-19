(function () {
  const params = new URLSearchParams(location.search);
  const TEST = params.has('test');
  const seedParam = params.get('seed');
  const rng = PG.rng.create(seedParam != null ? Number(seedParam) : undefined);

  const saved = PG.storage.load();
  const state = {
    caught: new Set(saved.caught || []),
    caughtShiny: new Set(saved.caughtShiny || []),
    muted: saved.muted || false,
    current: null,
  };
  const forced = { shiny: null, quality: null, result: null };

  function tid(id) { return document.querySelector('[data-testid="' + id + '"]'); }
  function wait(ms) { return new Promise(r => setTimeout(r, TEST ? 0 : ms)); }

  function showScreen(name) {
    document.querySelectorAll('[data-screen]').forEach(s => {
      const on = s.getAttribute('data-screen') === name;
      s.classList.toggle('active', on);
      s.hidden = !on;
    });
  }

  function persist() {
    PG.storage.save({ caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted });
  }

  function openPokedex() {
    PG.pokedex.render(tid('pokedex-grid'), tid('dex-progress'), state);
    showScreen('pokedex');
  }

  function updateMuteBtn() { const b = tid('mute-btn'); if (b) b.textContent = state.muted ? '🔇' : '🔊'; }

  // --- ENCOUNTER (extended in Task 11) ---
  function showFind() {
    showScreen('game');
    tid('find-area').hidden = false;
    tid('encounter-area').hidden = true;
    state.current = null;
  }
  function spawn() { /* Task 11 */ }

  // --- CATCH (extended in Task 12) ---
  function onThrow() { /* Task 12 */ }

  function wire() {
    tid('subtitle').textContent = PG.data.t('subtitle');
    tid('play-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('open-pokedex-btn').addEventListener('click', () => { PG.sound.play('blip'); openPokedex(); });
    tid('find-btn').addEventListener('click', () => { PG.sound.play('blip'); spawn(); });
    tid('throw-btn').addEventListener('click', onThrow);
    tid('find-another-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('back-btn').addEventListener('click', () => showScreen('title'));
    tid('dex-back-btn').addEventListener('click', () => showScreen('title'));
    const mb = tid('mute-btn');
    if (mb) mb.addEventListener('click', () => { state.muted = PG.sound.toggleMute(); updateMuteBtn(); });
    updateMuteBtn();
  }

  window.GAME = {
    forceSpawn(id, shiny) { /* Task 11 fills this in */ },
    forceShiny(b) { forced.shiny = b; },
    forceThrowQuality(q) { forced.quality = q; },
    forceCatchResult(b) { forced.result = b; },
    getState() { return { caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, current: state.current }; },
    resetSave() { PG.storage.clear(); state.caught.clear(); state.caughtShiny.clear(); if (tid('pokedex-grid')) PG.pokedex.render(tid('pokedex-grid'), tid('dex-progress'), state); },
  };

  // expose for sibling functions added in later tasks
  PG._app = { tid, wait, showScreen, persist, openPokedex, state, forced, rng, TEST, showFind };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wire(); showScreen('title'); });
  else { wire(); showScreen('title'); }
})();
