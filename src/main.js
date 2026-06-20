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
    guessBest: saved.guessBest || 0,
  };
  // Runtime-only state for the guess mode (not persisted beyond guessBest).
  const guess = { round: null, score: 0, streak: 0, answered: false, typed: '' };
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
    PG.storage.save({ caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, guessBest: state.guessBest });
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
      if (ring) {
        ring.style.transform = 'translate(-50%,-50%) scale(' + ringScale + ')';
        ring.classList.toggle('ring-hot', ringScale <= 0.3);
      }
      ringRAF = requestAnimationFrame(step);
    })();
  }
  function stopRing() { if (ringRAF) { cancelAnimationFrame(ringRAF); ringRAF = null; } }
  function currentRingScale() { return ringScale; }

  let missCount = 0;
  const MISS_HINTS = [
    '',
    '🤫',
    '🤫 Hmm...',
    'Ada rahasianya... 👀',
    'Perhatikan lingkarannya! 👀',
    '💡 Lingkaran kecil = waktu terbaik!',
  ];

  function startEncounter(pokemon) {
    state.current = pokemon;
    missCount = 0;
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
    const hm = tid('hint-msg'); if (hm) hm.textContent = '';
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

  // --- CATCH ---
  async function onThrow() {
    if (!state.current) return;
    const btn = tid('throw-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    stopRing();
    const quality = forced.quality != null ? forced.quality : PG.catch.qualityFromRing(currentRingScale());
    forced.quality = null;
    tid('quality-msg').textContent = PG.data.qualityLabel(quality);
    PG.sound.play('throw');
    await wait(400);
    for (let i = 0; i < 3; i++) { PG.sound.play('tick'); await wait(220); }
    const chance = PG.catch.chance(state.current.tier, quality);
    const caught = forced.result != null ? forced.result : rng.chance(chance);
    forced.result = null;
    if (caught) resolveCaught(); else resolveMiss();
  }

  function resolveCaught() {
    const p = state.current;
    state.caught.add(p.id);
    if (p.shiny) state.caughtShiny.add(p.id);
    persist();
    let msg;
    if (p.shiny) { msg = PG.data.t('caughtShiny', { name: p.name }); PG.sound.play('sparkle'); }
    else if (p.tier === 'legendary') { msg = PG.data.t('caughtLegendary', { name: p.name }); PG.sound.play('fanfare'); }
    else { msg = PG.data.t('caught', { name: p.name }); PG.sound.play('catch'); }
    tid('result-msg').textContent = msg;
    tid('throw-btn').hidden = true;
    tid('find-another-btn').hidden = false;
    celebrate(p.shiny || p.tier === 'legendary');
  }

  function resolveMiss() {
    missCount += 1;
    tid('result-msg').textContent = PG.data.t('miss');
    const hm = tid('hint-msg');
    if (hm) hm.textContent = MISS_HINTS[Math.min(missCount, MISS_HINTS.length - 1)];
    tid('throw-btn').disabled = false;
    startRing();
  }

  function celebrate(big) {
    const layer = tid('confetti');
    if (!layer) return;
    layer.innerHTML = '';
    const colors = ['#ef4444', '#facc15', '#4ade80', '#60a5fa', '#f472b6'];
    const n = big ? 44 : 18;
    for (let i = 0; i < n; i++) {
      const bit = document.createElement('div');
      bit.className = 'confetti-bit';
      bit.style.left = (rng.float() * 100) + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (rng.float() * 0.3) + 's';
      layer.appendChild(bit);
    }
    layer.setAttribute('data-active', '1');
    setTimeout(() => { layer.innerHTML = ''; layer.removeAttribute('data-active'); }, TEST ? 50 : 1600);
  }

  // --- GUESS MODE (Who's That Pokémon? — tap-to-type) ---
  // The name stays hidden (recognising it is the fun part); an on-screen
  // keyboard lets a kid who can't touch-type build the answer one finger-tap
  // at a time. Letters are laid out A→Z so they're easy to find.
  const KEY_ROWS = ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz', '0123456789'];

  function buildKeyboard() {
    const kb = tid('type-keyboard');
    if (kb.childElementCount) return; // build once
    const addKey = (row, ch, label, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.setAttribute('data-testid', 'key-' + ch);
      b.addEventListener('click', fn);
      row.appendChild(b);
    };
    KEY_ROWS.forEach(chars => {
      const row = document.createElement('div');
      row.className = 'key-row';
      for (const ch of chars) addKey(row, ch, ch.toUpperCase(), null, () => onKeyTap(ch));
      kb.appendChild(row);
    });
    const last = document.createElement('div');
    last.className = 'key-row';
    addKey(last, 'backspace', '⌫ Hapus', 'key-wide', onBackspace);
    kb.appendChild(last);
  }

  function renderTyped() {
    const el = tid('guess-typed');
    if (guess.typed) { el.textContent = guess.typed.toUpperCase(); el.classList.remove('empty'); }
    else { el.textContent = PG.data.t('guessTypeHint'); el.classList.add('empty'); }
  }

  function onKeyTap(ch) {
    if (guess.answered || guess.typed.length >= 16) return;
    guess.typed += ch;
    PG.sound.play('blip');
    if (tid('guess-result').textContent) tid('guess-result').textContent = '';
    renderTyped();
  }
  function onBackspace() {
    if (guess.answered || !guess.typed) return;
    guess.typed = guess.typed.slice(0, -1);
    PG.sound.play('tick');
    renderTyped();
  }

  function renderGuessScore() {
    tid('guess-score').textContent =
      PG.data.t('guessScore', { x: guess.score, y: guess.streak }) +
      '  ·  ' + PG.data.t('guessBest', { z: state.guessBest });
  }

  function setTypingVisible(on) {
    tid('type-keyboard').hidden = !on;
    document.querySelector('.type-actions').hidden = !on;
  }

  function renderGuessRound() {
    guess.answered = false;
    guess.typed = '';
    buildKeyboard();
    const sprite = tid('guess-sprite');
    sprite.src = PG.data.spritePath(guess.round.target.id, false);
    sprite.classList.add('silhouette');
    sprite.alt = '';
    tid('guess-prompt').textContent = PG.data.t('guessPrompt');
    tid('guess-result').textContent = '';
    tid('guess-next-btn').hidden = true;
    setTypingVisible(true);
    renderTyped();
    renderGuessScore();
  }

  function startGuessRound() {
    guess.round = PG.guess.round(rng);
    renderGuessRound();
  }

  function startGuess() {
    guess.score = 0;
    guess.streak = 0;
    showScreen('guess');
    startGuessRound();
  }

  // Reveal the colored sprite and lock the round. `won` distinguishes a correct
  // guess from a skip (which still reveals the answer but breaks the streak).
  function revealGuess(won) {
    guess.answered = true;
    const target = guess.round.target;
    const sprite = tid('guess-sprite');
    sprite.classList.remove('silhouette');
    sprite.alt = target.name;
    setTypingVisible(false);
    if (won) {
      guess.score += 1;
      guess.streak += 1;
      if (guess.streak > state.guessBest) { state.guessBest = guess.streak; persist(); }
      tid('guess-result').textContent = PG.data.t('guessCorrect', { name: target.name });
      PG.sound.play('catch');
      celebrate(false);
    } else {
      guess.streak = 0;
      tid('guess-result').textContent = PG.data.t('guessWrong', { name: target.name });
      PG.sound.play('throw');
    }
    renderGuessScore();
    tid('guess-next-btn').hidden = false;
  }

  function onGuessSubmit() {
    if (guess.answered) return;
    if (PG.guess.isCorrect(guess.typed, guess.round.target.name)) {
      revealGuess(true);
    } else {
      // Wrong: let the kid keep trying — the streak only breaks on skip.
      tid('guess-result').textContent = PG.data.t('guessTryAgain');
      PG.sound.play('throw');
    }
  }

  function onGuessSkip() {
    if (guess.answered) return;
    revealGuess(false);
  }

  // Physical keyboard works too (for whoever can reach it), but is never required.
  function onGuessKeydown(e) {
    const active = document.querySelector('[data-screen="guess"]');
    if (!active || !active.classList.contains('active')) return;
    if (e.key === 'Enter') { e.preventDefault(); onGuessSubmit(); }
    else if (e.key === 'Backspace') { e.preventDefault(); onBackspace(); }
    else if (/^[a-z0-9]$/i.test(e.key)) { onKeyTap(e.key.toLowerCase()); }
  }

  function wire() {
    tid('subtitle').textContent = PG.data.t('subtitle');
    tid('play-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('open-pokedex-btn').addEventListener('click', () => { PG.sound.play('blip'); openPokedex(); });
    tid('find-btn').addEventListener('click', () => { PG.sound.play('blip'); spawn(); });
    tid('throw-btn').addEventListener('click', onThrow);
    tid('find-another-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('back-btn').addEventListener('click', () => showScreen('title'));
    tid('guess-mode-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuess(); });
    tid('guess-back-btn').addEventListener('click', () => showScreen('title'));
    tid('guess-submit-btn').addEventListener('click', () => onGuessSubmit());
    tid('guess-skip-btn').addEventListener('click', () => { PG.sound.play('blip'); onGuessSkip(); });
    tid('guess-next-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuessRound(); });
    document.addEventListener('keydown', onGuessKeydown);
    tid('dex-back-btn').addEventListener('click', () => showScreen('title'));
    const mb = tid('mute-btn');
    if (mb) mb.addEventListener('click', () => { state.muted = PG.sound.toggleMute(); updateMuteBtn(); });
    const stage = tid('stage');
    if (stage) {
      let startY = null;
      stage.addEventListener('pointerdown', e => { startY = e.clientY; });
      stage.addEventListener('pointerup', e => {
        const tb = tid('throw-btn');
        if (startY != null && (startY - e.clientY) > 30 && state.current && !tb.disabled && !tb.hidden) onThrow();
        startY = null;
      });
    }
    updateMuteBtn();
  }

  window.GAME = {
    forceSpawn(id, shiny) { const p = PG.data.get(id); startEncounter({ id: p.id, name: p.name, tier: p.tier, shiny: !!shiny }); },
    forceShiny(b) { forced.shiny = b; },
    forceThrowQuality(q) { forced.quality = q; },
    forceCatchResult(b) { forced.result = b; },
    getState() { return { caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, current: state.current }; },
    startGuess() { startGuess(); },
    forceGuessRound(targetId) {
      guess.round = { target: PG.data.get(targetId) };
      showScreen('guess');
      renderGuessRound();
    },
    getGuessState() {
      return {
        score: guess.score, streak: guess.streak, best: state.guessBest, answered: guess.answered,
        targetId: guess.round ? guess.round.target.id : null,
        targetName: guess.round ? guess.round.target.name : null,
      };
    },
    resetSave() { PG.storage.clear(); state.caught.clear(); state.caughtShiny.clear(); state.guessBest = 0; if (tid('pokedex-grid')) PG.pokedex.render(tid('pokedex-grid'), tid('dex-progress'), state); },
  };

  // expose for sibling functions added in later tasks
  PG._app = { tid, wait, showScreen, persist, openPokedex, state, forced, rng, TEST, showFind, startRing, stopRing, currentRingScale, startEncounter };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wire(); showScreen('title'); });
  else { wire(); showScreen('title'); }
})();
