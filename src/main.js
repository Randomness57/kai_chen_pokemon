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
  const guess = { round: null, score: 0, streak: 0, answered: false, pos: 0 };
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

  function resetBall() {
    const ball = tid('poke-ball');
    const sprite = tid('wild-sprite');
    if (ball) {
      ball.classList.remove('throwing', 'wobble', 'open', 'grabbing');
      ball.style.transform = '';
      ball.style.removeProperty('--arc-dy');
    }
    if (sprite) sprite.classList.remove('captured', 'escape');
  }

  function snapBack() {
    const ball = tid('poke-ball');
    if (!ball) return;
    ball.style.transform = '';
  }

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
    resetBall();
    startRing();
  }

  // --- ENCOUNTER ---
  function showFind() {
    showScreen('game');
    tid('find-area').hidden = false;
    tid('encounter-area').hidden = true;
    stopRing();
    resetBall();
    state.current = null;
  }
  function spawn() {
    const p = PG.spawn.wild(rng);
    if (forced.shiny != null) { p.shiny = forced.shiny; forced.shiny = null; }
    startEncounter(p);
  }

  // --- CATCH ---
  let throwing = false;

  function requestThrow(source) {
    if (!state.current || throwing) return;
    const btn = tid('throw-btn');
    if (btn && btn.disabled) return;
    const quality = forced.quality != null ? forced.quality : PG.catch.qualityFromRing(currentRingScale());
    forced.quality = null;
    beginThrow(quality);
  }

  async function beginThrow(quality) {
    throwing = true;
    let skip = false;
    let skipResolve;
    const skipPromise = new Promise(r => { skipResolve = r; });
    const skipOnce = () => { skip = true; skipResolve(); };
    document.addEventListener('pointerdown', skipOnce, { once: true });
    const sw = ms => (skip || TEST) ? Promise.resolve() : Promise.race([wait(ms), skipPromise]);

    const ball = tid('poke-ball');
    const sprite = tid('wild-sprite');
    const btn = tid('throw-btn');
    if (btn) btn.disabled = true;
    stopRing();
    tid('quality-msg').textContent = PG.data.qualityLabel(quality);
    PG.sound.play('throw');

    // Compute arc offset so the ball travels to the sprite center.
    if (ball && sprite) {
      const bBox = ball.getBoundingClientRect();
      const sBox = sprite.getBoundingClientRect();
      const dy = (sBox.top + sBox.height / 2) - (bBox.top + bBox.height / 2);
      ball.style.setProperty('--arc-dy', dy + 'px');
    }

    // Phase 1: Arc
    if (ball) ball.classList.add('throwing');
    await sw(300);

    // Phase 2: Suck-in
    if (sprite) { sprite.classList.remove('is-shiny'); sprite.classList.add('captured'); }
    if (ball) ball.classList.remove('throwing');
    await sw(350);

    // Phase 3: Wobble x3
    if (ball) ball.classList.add('wobble');
    for (let i = 0; i < 3; i++) { PG.sound.play('tick'); await sw(220); }
    if (ball) ball.classList.remove('wobble');

    document.removeEventListener('pointerdown', skipOnce);

    const chance = PG.catch.chance(state.current.tier, quality);
    const caught = forced.result != null ? forced.result : rng.chance(chance);
    forced.result = null;
    throwing = false;

    if (caught) {
      resolveCaught();
    } else {
      if (ball) ball.classList.add('open');
      if (sprite) { sprite.classList.remove('captured'); sprite.classList.add('escape'); }
      if (state.current && state.current.shiny && sprite) {
        await sw(350);
        sprite.classList.add('is-shiny');
      } else {
        await sw(350);
      }
      if (ball) ball.classList.remove('open');
      resolveMiss();
    }
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

  // --- GUESS MODE (Who's That Pokémon? — typing tutor) ---
  // The kid recognises the silhouette (the fun part) and TYPES the name on a
  // real keyboard. The on-screen board is a guide only — it pulses the next key
  // to press and colours each key by hand (left = blue, right = orange) so he
  // learns key positions and two-handed typing. Tapping it does nothing.
  const KB_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const LEFT_HAND = new Set('12345qwertasdfgzxcvb');
  function handClass(ch) { return LEFT_HAND.has(ch) ? 'hand-left' : 'hand-right'; }
  // Which characters the player actually types (letters/digits); spaces and
  // punctuation in a name auto-fill so he only ever presses real keys.
  function keyOf(ch) { return /[a-z0-9]/i.test(ch) ? ch.toLowerCase() : null; }

  function buildKeyboard() {
    const kb = tid('type-keyboard');
    if (kb.childElementCount) return; // build once
    KB_ROWS.forEach(chars => {
      const row = document.createElement('div');
      row.className = 'key-row';
      for (const ch of chars) {
        const k = document.createElement('div');
        k.className = 'key ' + handClass(ch);
        k.textContent = ch.toUpperCase();
        k.setAttribute('data-testid', 'key-' + ch);
        row.appendChild(k);
      }
      kb.appendChild(row);
    });
  }

  function targetName() { return guess.round.target.name; }

  // Advance past any non-typed characters (spaces, '.', '-', "'") so `pos`
  // always sits on the next key the player must press (or past the end).
  function skipAuto() {
    const name = targetName();
    while (guess.pos < name.length && keyOf(name[guess.pos]) === null) guess.pos++;
  }

  function renderTyped() {
    const el = tid('guess-typed');
    if (guess.pos <= 0) { el.textContent = PG.data.t('guessTypeHint'); el.classList.add('empty'); return; }
    el.classList.remove('empty');
    el.textContent = targetName().slice(0, guess.pos).toUpperCase() + (guess.answered ? '' : '_');
  }

  function highlightNextKey() {
    const kb = tid('type-keyboard');
    kb.querySelectorAll('.key.next').forEach(k => k.classList.remove('next'));
    const name = targetName();
    if (guess.answered || guess.pos >= name.length) return;
    const k = keyOf(name[guess.pos]);
    const el = k && kb.querySelector('[data-testid="key-' + k + '"]');
    if (el) el.classList.add('next');
  }

  function renderGuessScore() {
    tid('guess-score').textContent =
      PG.data.t('guessScore', { x: guess.score, y: guess.streak }) +
      '  ·  ' + PG.data.t('guessBest', { z: state.guessBest });
  }

  function setTypingVisible(on) {
    tid('type-keyboard').hidden = !on;
    tid('guess-skip-btn').hidden = !on;
  }

  function renderGuessRound() {
    guess.answered = false;
    guess.pos = 0;
    buildKeyboard();
    const sprite = tid('guess-sprite');
    sprite.src = PG.data.spritePath(guess.round.target.id, false);
    sprite.classList.add('silhouette');
    sprite.alt = '';
    tid('guess-prompt').textContent = PG.data.t('guessPrompt');
    tid('guess-result').textContent = '';
    tid('guess-next-btn').hidden = true;
    setTypingVisible(true);
    skipAuto();
    renderTyped();
    highlightNextKey();
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

  // Reveal the colored sprite and lock the round. `won` = typed the whole name;
  // a skip still reveals the answer but breaks the streak.
  function revealGuess(won) {
    guess.answered = true;
    const target = guess.round.target;
    const sprite = tid('guess-sprite');
    sprite.classList.remove('silhouette');
    sprite.alt = target.name;
    setTypingVisible(false);
    highlightNextKey();
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
    renderTyped();
    renderGuessScore();
    tid('guess-next-btn').hidden = false;
  }

  // One keystroke. Only the correct next key advances (so he can never get stuck
  // on a wrong path); other keys are gently ignored. Completing the name wins.
  function pressKey(key) {
    if (guess.answered) return;
    const name = targetName();
    if (guess.pos >= name.length) return;
    if (key !== keyOf(name[guess.pos])) { PG.sound.play('tick'); return; }
    guess.pos++;
    skipAuto();
    if (guess.pos >= name.length) { revealGuess(true); return; }
    PG.sound.play('blip');
    renderTyped();
    highlightNextKey();
  }

  function onGuessSkip() {
    if (guess.answered) return;
    revealGuess(false);
  }

  // The kid types on the real keyboard. Enter advances to the next round once solved.
  function onGuessKeydown(e) {
    const active = document.querySelector('[data-screen="guess"]');
    if (!active || !active.classList.contains('active')) return;
    if (e.key === 'Enter') { if (guess.answered) { PG.sound.play('blip'); startGuessRound(); } return; }
    if (/^[a-z0-9]$/i.test(e.key)) { e.preventDefault(); pressKey(e.key.toLowerCase()); }
  }

  function wire() {
    tid('subtitle').textContent = PG.data.t('subtitle');
    tid('play-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('open-pokedex-btn').addEventListener('click', () => { PG.sound.play('blip'); openPokedex(); });
    tid('find-btn').addEventListener('click', () => { PG.sound.play('blip'); spawn(); });
    tid('throw-btn').addEventListener('click', () => requestThrow('button'));
    tid('find-another-btn').addEventListener('click', () => { PG.sound.play('blip'); showFind(); });
    tid('back-btn').addEventListener('click', () => showScreen('title'));
    tid('guess-mode-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuess(); });
    tid('guess-back-btn').addEventListener('click', () => showScreen('title'));
    tid('guess-skip-btn').addEventListener('click', () => { PG.sound.play('blip'); onGuessSkip(); });
    tid('guess-next-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuessRound(); });
    document.addEventListener('keydown', onGuessKeydown);
    tid('dex-back-btn').addEventListener('click', () => showScreen('title'));
    const mb = tid('mute-btn');
    if (mb) mb.addEventListener('click', () => { state.muted = PG.sound.toggleMute(); updateMuteBtn(); });
    const ballEl = tid('poke-ball');
    if (ballEl) {
      const drag = { active: false, startX: 0, startY: 0 };
      const FLICK_THRESHOLD = 24;

      ballEl.addEventListener('pointerdown', e => {
        if (throwing || !state.current) return;
        drag.active = true;
        drag.startX = e.clientX;
        drag.startY = e.clientY;
        ballEl.classList.add('grabbing');
        ballEl.setPointerCapture(e.pointerId);
      });

      ballEl.addEventListener('pointermove', e => {
        if (!drag.active) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        ballEl.style.transform = 'translateX(calc(-50% + ' + dx + 'px)) translateY(' + dy + 'px)';
      });

      ballEl.addEventListener('pointerup', e => {
        if (!drag.active) return;
        drag.active = false;
        ballEl.classList.remove('grabbing');
        const upDelta = drag.startY - e.clientY;
        if (upDelta >= FLICK_THRESHOLD && state.current && !throwing) {
          forced.quality = forced.quality != null ? forced.quality : PG.catch.qualityFromRing(currentRingScale());
          requestThrow('flick');
        } else {
          snapBack();
        }
      });

      ballEl.addEventListener('pointercancel', () => {
        drag.active = false;
        ballEl.classList.remove('grabbing');
        snapBack();
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
        pos: guess.pos,
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
