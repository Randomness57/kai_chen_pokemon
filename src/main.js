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

  // --- ring animation ---
  let ringScale = 1, ringDir = -1, ringRAF = null;
  function startRing() {
    stopRing(); ringScale = 1; ringDir = -1;
    const ring = tid('catch-ring');
    (function step() {
      ringScale += ringDir * 0.02;
      if (ringScale <= 0.2) { ringScale = 0.2; ringDir = 1; }
      if (ringScale >= 1) { ringScale = 1; ringDir = -1; }
      if (ring) ring.style.transform = 'translate(-50%,-50%) scale(' + ringScale + ')';
      ringRAF = requestAnimationFrame(step);
    })();
  }
  function stopRing() { if (ringRAF) { cancelAnimationFrame(ringRAF); ringRAF = null; } }
  function currentRingScale() { return ringScale; }

  function startEncounter(pokemon) {
    state.current = pokemon;
    showScreen('game');
    tid('find-area').hidden = true;
    tid('encounter-area').hidden = false;
    tid('legendary-alert').hidden = pokemon.tier !== 'legendary';
    tid('shiny-alert').hidden = !pokemon.shiny;
    const sprite = tid('wild-sprite');
    sprite.src = PG.data.spritePath(pokemon.id, pokemon.shiny);
    sprite.classList.toggle('is-shiny', !!pokemon.shiny);
    tid('wild-name').textContent = pokemon.name;
    tid('catch-ring').style.borderColor = PG.data.TIERS[pokemon.tier].ring;
    tid('quality-msg').textContent = '';
    tid('result-msg').textContent = '';
    tid('throw-btn').hidden = false;
    tid('throw-btn').disabled = false;
    tid('find-another-btn').hidden = true;
    startRing();
  }

  // --- ENCOUNTER ---
  function showFind() {
    showScreen('game');
    tid('find-area').hidden = false;
    tid('encounter-area').hidden = true;
    stopRing();
    state.current = null;
  }
  function spawn() {
    const p = PG.spawn.wild(rng);
    if (forced.shiny != null) { p.shiny = forced.shiny; forced.shiny = null; }
    startEncounter(p);
  }

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
    forceSpawn(id, shiny) { const p = PG.data.get(id); startEncounter({ id: p.id, name: p.name, tier: p.tier, shiny: !!shiny }); },
    forceShiny(b) { forced.shiny = b; },
    forceThrowQuality(q) { forced.quality = q; },
    forceCatchResult(b) { forced.result = b; },
    getState() { return { caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, current: state.current }; },
    resetSave() { PG.storage.clear(); state.caught.clear(); state.caughtShiny.clear(); if (tid('pokedex-grid')) PG.pokedex.render(tid('pokedex-grid'), tid('dex-progress'), state); },
  };

  // expose for sibling functions added in later tasks
  PG._app = { tid, wait, showScreen, persist, openPokedex, state, forced, rng, TEST, showFind, startRing, stopRing, currentRingScale, startEncounter };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wire(); showScreen('title'); });
  else { wire(); showScreen('title'); }
})();
