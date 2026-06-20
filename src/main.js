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
    ball: 'poke',
    inventory: saved.inventory || PG.storage.defaultInventory(),
    guessBest: saved.guessBest || 0,
    animalBest: saved.animalBest || 0,
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
    PG.storage.save({ caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, inventory: Object.assign({}, state.inventory), guessBest: state.guessBest, animalBest: state.animalBest });
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
    if (sprite) sprite.classList.remove('captured', 'escape', 'flee');
  }

  function snapBack() {
    const ball = tid('poke-ball');
    if (!ball) return;
    ball.style.transform = '';
  }

  let missCount = 0;
  const MAX_MISSES = 4; // the wild Pokémon flees on this many misses
  const MISS_HINTS = [
    '',
    '🤫',
    '🤫 Hmm...',
    'Ada rahasianya... 👀',
    'Perhatikan lingkarannya! 👀',
    '💡 Lingkaran kecil = waktu terbaik!',
  ];

  // --- POKÉ BALLS ---
  // The kid picks a ball before each throw. A stronger ball multiplies the catch
  // chance (see PG.catch.chance), so a tough Pokémon becomes catchable — and the
  // Master Ball never fails. Each throw spends one ball from the inventory; plain
  // Poké Balls are unlimited so he can never get stuck. The picker is built once,
  // data-driven from BALLS, then refreshed with live counts.
  function ballCount(key) {
    if (PG.data.BALLS[key] && PG.data.BALLS[key].unlimited) return Infinity;
    return state.inventory[key] || 0;
  }
  function ballAvailable(key) { return ballCount(key) > 0; }

  function buildBallTray() {
    const tray = tid('ball-tray');
    if (!tray || tray.childElementCount) return;
    PG.data.BALL_ORDER.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'ball-btn ball-' + key;
      btn.setAttribute('data-testid', 'ball-btn-' + key);
      btn.setAttribute('data-ball', key);
      const icon = document.createElement('span');
      icon.className = 'ball-icon ball-icon-' + key;
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'ball-name';
      label.textContent = PG.data.ballName(key);
      const count = document.createElement('span');
      count.className = 'ball-count';
      count.setAttribute('data-testid', 'ball-count-' + key);
      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(count);
      btn.addEventListener('click', () => { if (ballAvailable(key)) { PG.sound.play('blip'); selectBall(key); } });
      tray.appendChild(btn);
    });
  }

  // Update the count badges + disabled state of each ball button.
  function refreshBallTray() {
    const tray = tid('ball-tray');
    if (!tray) return;
    PG.data.BALL_ORDER.forEach(key => {
      const n = ballCount(key);
      const badge = tid('ball-count-' + key);
      if (badge) badge.textContent = n === Infinity ? '∞' : ('×' + n);
      const btn = tray.querySelector('[data-ball="' + key + '"]');
      if (btn) { const empty = n <= 0; btn.disabled = empty; btn.classList.toggle('empty', empty); }
    });
  }

  function selectBall(key) {
    if (throwing || !PG.data.BALLS[key] || !ballAvailable(key)) return;
    state.ball = key;
    const tray = tid('ball-tray');
    if (tray) tray.querySelectorAll('.ball-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-ball') === key));
    const ball = tid('poke-ball');
    if (ball) { PG.data.BALL_ORDER.forEach(k => ball.classList.remove('ball-' + k)); ball.classList.add('ball-' + key); }
    const btn = tid('throw-btn');
    if (btn) btn.textContent = PG.data.t('throwNamed', { ball: PG.data.ballName(key) });
  }

  // Spend one of the thrown ball. Unlimited balls (Poké Ball) are never deducted.
  // (Falling back to the Poké Ball when one runs out is handled once the throw
  // finishes — see resolveMiss / the next requestThrow — since selectBall is
  // intentionally inert while a throw is animating.)
  function consumeBall(key) {
    if (PG.data.BALLS[key] && PG.data.BALLS[key].unlimited) return;
    state.inventory[key] = Math.max(0, (state.inventory[key] || 0) - 1);
    persist();
    refreshBallTray();
  }

  function startEncounter(pokemon) {
    state.current = pokemon;
    missCount = 0;
    showScreen('game');
    tid('find-area').hidden = true;
    tid('encounter-area').hidden = false;
    buildBallTray();
    refreshBallTray();
    selectBall('poke'); // every encounter starts on the basic ball
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
    if (!ballAvailable(state.ball)) selectBall('poke'); // never throw an empty ball
    const quality = forced.quality != null ? forced.quality : PG.catch.qualityFromRing(currentRingScale());
    forced.quality = null;
    beginThrow(quality);
  }

  async function beginThrow(quality) {
    throwing = true;
    const thrownBall = state.ball;
    consumeBall(thrownBall); // spend the ball as it leaves his hand
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

    const chance = PG.catch.chance(state.current.tier, quality, thrownBall);
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
    if (missCount >= MAX_MISSES) { resolveFled(); return; }
    tid('result-msg').textContent = PG.data.t('miss');
    const hm = tid('hint-msg');
    // On the last allowed miss, warn that it's about to bolt instead of a hint.
    if (hm) hm.textContent = (missCount === MAX_MISSES - 1)
      ? PG.data.t('fleeWarn')
      : MISS_HINTS[Math.min(missCount, MISS_HINTS.length - 1)];
    if (!ballAvailable(state.ball)) selectBall('poke'); // ran out mid-encounter
    tid('throw-btn').disabled = false;
    startRing();
  }

  // Too many misses: the wild Pokémon bolts. No more throws — go find another.
  function resolveFled() {
    const p = state.current;
    stopRing();
    const sprite = tid('wild-sprite');
    if (sprite) { sprite.classList.remove('escape', 'is-shiny'); sprite.classList.add('flee'); }
    tid('result-msg').textContent = PG.data.t('fled', { name: p.name });
    const hm = tid('hint-msg'); if (hm) hm.textContent = '';
    tid('throw-btn').hidden = true;
    tid('find-another-btn').hidden = false;
    PG.sound.play('flee');
    state.current = null; // can't throw at a Pokémon that's gone (also blocks flicks)
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

  // --- TYPING ENGINE (shared by "Tebak Pokémon!" and "Tebak Hewan!") ---
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

  // A reusable typing round. `opts` wires it to a specific screen's elements:
  //   keyboardId, keyPrefix, typedId, emptyHintKey, getName(round), onWin().
  function createTyper(opts) {
    const s = { round: null, answered: false, pos: 0 };
    function name() { return opts.getName(s.round); }
    function board() { return tid(opts.keyboardId); }

    function build() {
      const kb = board();
      if (kb.childElementCount) return; // build once
      KB_ROWS.forEach(chars => {
        const row = document.createElement('div');
        row.className = 'key-row';
        for (const ch of chars) {
          const k = document.createElement('div');
          k.className = 'key ' + handClass(ch);
          k.textContent = ch.toUpperCase();
          k.setAttribute('data-testid', opts.keyPrefix + ch);
          row.appendChild(k);
        }
        kb.appendChild(row);
      });
    }

    // Advance past any non-typed characters (spaces, '.', '-', "'") so `pos`
    // always sits on the next key the player must press (or past the end).
    function skipAuto() {
      const nm = name();
      while (s.pos < nm.length && keyOf(nm[s.pos]) === null) s.pos++;
    }

    function renderTyped() {
      const el = tid(opts.typedId);
      if (s.pos <= 0) { el.textContent = PG.data.t(opts.emptyHintKey); el.classList.add('empty'); return; }
      el.classList.remove('empty');
      el.textContent = name().slice(0, s.pos).toUpperCase() + (s.answered ? '' : '_');
    }

    function highlightNextKey() {
      const kb = board();
      kb.querySelectorAll('.key.next').forEach(k => k.classList.remove('next'));
      const nm = name();
      if (s.answered || s.pos >= nm.length) return;
      const k = keyOf(nm[s.pos]);
      const el = k && kb.querySelector('[data-testid="' + opts.keyPrefix + k + '"]');
      if (el) el.classList.add('next');
    }

    // Begin a fresh round on `target`; resets state and draws the board.
    function start(target) {
      s.round = { target };
      s.answered = false;
      s.pos = 0;
      build();
      skipAuto();
      renderTyped();
      highlightNextKey();
    }

    // Lock the round (reveal): drop the caret and clear the key highlight.
    function finish() {
      s.answered = true;
      renderTyped();
      highlightNextKey();
    }

    // One keystroke. Only the correct next key advances (so he can never get
    // stuck on a wrong path); other keys are gently ignored. Completing wins.
    function press(key) {
      if (s.answered) return;
      const nm = name();
      if (s.pos >= nm.length) return;
      if (key !== keyOf(nm[s.pos])) { PG.sound.play('tick'); return; }
      s.pos++;
      skipAuto();
      if (s.pos >= nm.length) { opts.onWin(); return; }
      PG.sound.play('blip');
      renderTyped();
      highlightNextKey();
    }

    return { state: s, start, finish, press };
  }

  // The kid types on the real keyboard. Enter advances to the next round once
  // solved. Only fires while the matching screen is active.
  function makeKeydown(screenName, typer, nextRound) {
    return function (e) {
      const active = document.querySelector('[data-screen="' + screenName + '"]');
      if (!active || !active.classList.contains('active')) return;
      if (e.key === 'Enter') { if (typer.state.answered) { PG.sound.play('blip'); nextRound(); } return; }
      if (/^[a-z0-9]$/i.test(e.key)) { e.preventDefault(); typer.press(e.key.toLowerCase()); }
    };
  }

  // --- GUESS MODE (Who's That Pokémon?) ---
  const guessMode = { score: 0, streak: 0 };
  const guessTyper = createTyper({
    keyboardId: 'type-keyboard', keyPrefix: 'key-', typedId: 'guess-typed',
    emptyHintKey: 'guessTypeHint',
    getName: r => r.target.name,
    onWin: () => revealGuess(true),
  });

  function renderGuessScore() {
    tid('guess-score').textContent =
      PG.data.t('guessScore', { x: guessMode.score, y: guessMode.streak }) +
      '  ·  ' + PG.data.t('guessBest', { z: state.guessBest });
  }

  function setGuessTypingVisible(on) {
    tid('type-keyboard').hidden = !on;
    tid('guess-skip-btn').hidden = !on;
  }

  function startGuessRoundWith(target) {
    const sprite = tid('guess-sprite');
    sprite.src = PG.data.spritePath(target.id, false);
    sprite.classList.add('silhouette');
    sprite.alt = '';
    tid('guess-prompt').textContent = PG.data.t('guessPrompt');
    tid('guess-result').textContent = '';
    tid('guess-next-btn').hidden = true;
    setGuessTypingVisible(true);
    guessTyper.start(target);
    renderGuessScore();
  }

  function startGuessRound() { startGuessRoundWith(PG.guess.round(rng).target); }

  function startGuess() {
    guessMode.score = 0;
    guessMode.streak = 0;
    showScreen('guess');
    startGuessRound();
  }

  // Reveal the colored sprite and lock the round. `won` = typed the whole name;
  // a skip still reveals the answer but breaks the streak.
  function revealGuess(won) {
    const target = guessTyper.state.round.target;
    const sprite = tid('guess-sprite');
    sprite.classList.remove('silhouette');
    sprite.alt = target.name;
    setGuessTypingVisible(false);
    guessTyper.finish();
    if (won) {
      guessMode.score += 1;
      guessMode.streak += 1;
      if (guessMode.streak > state.guessBest) { state.guessBest = guessMode.streak; persist(); }
      tid('guess-result').textContent = PG.data.t('guessCorrect', { name: target.name });
      PG.sound.play('catch');
      celebrate(false);
    } else {
      guessMode.streak = 0;
      tid('guess-result').textContent = PG.data.t('guessWrong', { name: target.name });
      PG.sound.play('throw');
    }
    renderGuessScore();
    tid('guess-next-btn').hidden = false;
  }

  function onGuessSkip() {
    if (guessTyper.state.answered) return;
    revealGuess(false);
  }

  const onGuessKeydown = makeKeydown('guess', guessTyper, startGuessRound);

  // --- ANIMAL MODE (Tebak Hewan! — same typing tutor, animal silhouettes) ---
  // Identical mechanic, but the "sprite" is an emoji animal blacked out into a
  // silhouette (no downloaded artwork needed) and the names are everyday animals.
  const animalMode = { score: 0, streak: 0 };
  const animalTyper = createTyper({
    keyboardId: 'animal-keyboard', keyPrefix: 'akey-', typedId: 'animal-typed',
    emptyHintKey: 'animalTypeHint',
    getName: r => r.target.name,
    onWin: () => revealAnimal(true),
  });

  function renderAnimalScore() {
    tid('animal-score').textContent =
      PG.data.t('animalScore', { x: animalMode.score, y: animalMode.streak }) +
      '  ·  ' + PG.data.t('animalBest', { z: state.animalBest });
  }

  function setAnimalTypingVisible(on) {
    tid('animal-keyboard').hidden = !on;
    tid('animal-skip-btn').hidden = !on;
  }

  function startAnimalRoundWith(target) {
    const sprite = tid('animal-sprite');
    sprite.textContent = target.emoji;
    sprite.classList.add('silhouette');
    tid('animal-prompt').textContent = PG.data.t('animalPrompt');
    tid('animal-result').textContent = '';
    tid('animal-next-btn').hidden = true;
    setAnimalTypingVisible(true);
    animalTyper.start(target);
    renderAnimalScore();
  }

  function startAnimalRound() { startAnimalRoundWith(PG.animals.round(rng).target); }

  function startAnimals() {
    animalMode.score = 0;
    animalMode.streak = 0;
    showScreen('animals');
    startAnimalRound();
  }

  function revealAnimal(won) {
    const target = animalTyper.state.round.target;
    const sprite = tid('animal-sprite');
    sprite.classList.remove('silhouette');
    setAnimalTypingVisible(false);
    animalTyper.finish();
    if (won) {
      animalMode.score += 1;
      animalMode.streak += 1;
      if (animalMode.streak > state.animalBest) { state.animalBest = animalMode.streak; persist(); }
      tid('animal-result').textContent = PG.data.t('animalCorrect', { name: target.name });
      PG.sound.play('catch');
      celebrate(false);
    } else {
      animalMode.streak = 0;
      tid('animal-result').textContent = PG.data.t('animalWrong', { name: target.name });
      PG.sound.play('throw');
    }
    renderAnimalScore();
    tid('animal-next-btn').hidden = false;
  }

  function onAnimalSkip() {
    if (animalTyper.state.answered) return;
    revealAnimal(false);
  }

  const onAnimalKeydown = makeKeydown('animals', animalTyper, startAnimalRound);

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
    tid('animal-mode-btn').addEventListener('click', () => { PG.sound.play('blip'); startAnimals(); });
    tid('animal-back-btn').addEventListener('click', () => showScreen('title'));
    tid('animal-skip-btn').addEventListener('click', () => { PG.sound.play('blip'); onAnimalSkip(); });
    tid('animal-next-btn').addEventListener('click', () => { PG.sound.play('blip'); startAnimalRound(); });
    document.addEventListener('keydown', onAnimalKeydown);
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
    getState() { return { caught: [...state.caught], caughtShiny: [...state.caughtShiny], muted: state.muted, current: state.current, ball: state.ball, inventory: Object.assign({}, state.inventory), misses: missCount, maxMisses: MAX_MISSES }; },
    selectBall(key) { selectBall(key); },
    setInventory(inv) { Object.assign(state.inventory, inv); persist(); refreshBallTray(); if (!ballAvailable(state.ball)) selectBall('poke'); },
    startGuess() { startGuess(); },
    forceGuessRound(targetId) {
      showScreen('guess');
      startGuessRoundWith(PG.data.get(targetId));
    },
    getGuessState() {
      const r = guessTyper.state.round;
      return {
        score: guessMode.score, streak: guessMode.streak, best: state.guessBest,
        answered: guessTyper.state.answered, pos: guessTyper.state.pos,
        targetId: r ? r.target.id : null,
        targetName: r ? r.target.name : null,
      };
    },
    startAnimals() { startAnimals(); },
    forceAnimalRound(animalId) {
      showScreen('animals');
      startAnimalRoundWith(PG.animals.get(animalId));
    },
    getAnimalState() {
      const r = animalTyper.state.round;
      return {
        score: animalMode.score, streak: animalMode.streak, best: state.animalBest,
        answered: animalTyper.state.answered, pos: animalTyper.state.pos,
        targetId: r ? r.target.id : null,
        targetName: r ? r.target.name : null,
      };
    },
    resetSave() { PG.storage.clear(); state.caught.clear(); state.caughtShiny.clear(); state.guessBest = 0; state.animalBest = 0; state.inventory = PG.storage.defaultInventory(); refreshBallTray(); if (tid('pokedex-grid')) PG.pokedex.render(tid('pokedex-grid'), tid('dex-progress'), state); },
  };

  // expose for sibling functions added in later tasks
  PG._app = { tid, wait, showScreen, persist, openPokedex, state, forced, rng, TEST, showFind, startRing, stopRing, currentRingScale, startEncounter };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wire(); showScreen('title'); });
  else { wire(); showScreen('title'); }
})();
