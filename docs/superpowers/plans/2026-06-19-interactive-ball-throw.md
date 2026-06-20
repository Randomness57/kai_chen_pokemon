# Interactive Poké Ball Throw — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invisible sound-only throw with a draggable, flickable Poké Ball that arcs to the wild Pokémon and resolves with wobble + catch/miss animation, while also completing the in-progress on-screen keyboard redesign of the guess mode (which is currently crashing the app).

**Architecture:** Six tasks: (1) fix the guess mode JS crash by implementing the on-screen keyboard UI and updating test 17; (2) add the Poké Ball DOM element + rest CSS; (3) refactor `onThrow` into `requestThrow`/`beginThrow`; (4) add animation CSS keyframes + throw timeline with skip; (5) add drag-and-flick pointer handlers; (6) add new interaction tests. Every task ends with all existing tests green.

**Tech Stack:** Vanilla JS (IIFE, `window.PG` namespace), CSS animations, Pointer Events API, Playwright (Chromium). No build step. Runs from `file://` and `localhost`.

## Global Constraints

- No ES modules, no npm deps, no build step — all `.js` files are classic `<script>` tags.
- All player-facing text lives in `PG.data.STRINGS` (never hardcode text in JS).
- All test targets use `[data-testid]` selectors — never CSS class or text.
- All animation delays go through `wait(ms)` (already returns 0 when `?test=1`).
- `forced.quality` and `forced.result` must still drive deterministic outcomes.
- Do **not** modify `src/guess.js` internals (`normalize`, `isCorrect`, `round`).
- Guess mode best streak persists in localStorage via `state.guessBest`.
- The `[hidden] { display: none !important; }` rule at top of `styles.css` is load-bearing — never remove it.
- Pokedex, spawn, storage, rng, sound, data modules are **read-only** for this feature.
- `@media (prefers-reduced-motion: reduce)` must disable all new decorative animations.

---

### Task 1: On-screen keyboard guess mode (fix JS crash)

The HTML was redesigned to use `type-word` + `type-keyboard` instead of a text `<input>`. `main.js` still wires old elements (`guess-form`, `guess-input`, `guess-submit-btn`, `guess-giveup-btn`) that no longer exist, causing a `TypeError: Cannot read properties of null` that crashes `wire()` and breaks **all** navigation tests (4 failures total).

**Files:**
- Modify: `src/main.js` (guess section: wire, state, renderGuessRound, revealGuess, new functions, GAME hooks)
- Modify: `styles.css` (add `.type-keyboard`/`.type-tile` CSS; remove obsolete `.guess-form`/`.guess-input`)
- Modify: `tests/17-guess.spec.js` (adapt to new on-screen keyboard UI)

**Interfaces:**
- Produces: `GAME.typeGuessLetters(str)` — test hook that programmatically types letters on the on-screen keyboard
- Produces: `GAME.forceGuessRound(targetId)` — unchanged signature, same behaviour
- Produces: `GAME.getGuessState()` — unchanged signature: `{score, streak, best, answered, targetId, targetName}`

- [ ] **Step 1: Write the updated failing test** — replace `tests/17-guess.spec.js` entirely:

```js
const { test, expect } = require('@playwright/test');

test('guess mode: on-screen keyboard, correct, skip, score + best persists', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  await page.getByTestId('guess-mode-btn').click();
  await expect(page.locator('[data-screen="guess"]')).toHaveClass(/active/);
  await expect(page.getByTestId('guess-prompt')).toHaveText('Ketik nama Pokémon ini!');

  // Correct guess via the GAME test-hook.
  await page.evaluate(() => window.GAME.forceGuessRound(25)); // Pikachu (7 normalized chars)
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-sprite')).toHaveAttribute('src', 'images/25.png');
  await page.evaluate(() => window.GAME.typeGuessLetters('pikachu'));
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Hebat! Kamu mengetik Pikachu! 🎉');
  await expect(page.getByTestId('guess-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Forgiving match: "mrmime" for Mr. Mime (6 normalized chars).
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(122)); // Mr. Mime
  await page.evaluate(() => window.GAME.typeGuessLetters('mrmime'));
  await expect(page.getByTestId('guess-result')).toHaveText('Hebat! Kamu mengetik Mr. Mime! 🎉');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 2, best: 2 });

  // Skip: reveals answer, resets streak, score unchanged.
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(94)); // Gengar (6 normalized chars)
  await page.getByTestId('guess-skip-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Ini Gengar. Coba yang lain!');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 0, best: 2 });

  // Best streak survives reload.
  await page.reload();
  expect(await page.evaluate(() => window.GAME.getGuessState().best)).toBe(2);
});

test('guess logic: round picks a real target; isCorrect is forgiving', async ({ page }) => {
  await page.goto('/?test=1&seed=42');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(42);
    let allReal = true;
    for (let i = 0; i < 200; i++) {
      const r = PG.guess.round(rng);
      if (!r.target || !PG.data.get(r.target.id)) allReal = false;
    }
    return {
      allReal,
      hooh: PG.guess.isCorrect('ho oh', 'Ho-Oh'),
      farfetchd: PG.guess.isCorrect('farfetchd', "Farfetch'd"),
      accent: PG.guess.isCorrect('pokemon', 'Pokémon'),
      empty: PG.guess.isCorrect('', 'Pikachu'),
      wrong: PG.guess.isCorrect('squirtle', 'Pikachu'),
    };
  });
  expect(out.allReal).toBe(true);
  expect(out.hooh).toBe(true);
  expect(out.farfetchd).toBe(true);
  expect(out.accent).toBe(true);
  expect(out.empty).toBe(false);
  expect(out.wrong).toBe(false);
});
```

- [ ] **Step 2: Run test 17 — verify it fails**

```bash
npx playwright test tests/17-guess.spec.js --reporter=line
```
Expected: FAIL (element not found / text mismatch)

- [ ] **Step 3: Replace the guess mode section in `src/main.js`**

Replace the entire guess block (from `const guess = …` through `onGuessGiveUp`) with:

```js
  // Runtime-only guess state (not persisted beyond guessBest).
  const guess = { round: null, score: 0, streak: 0, answered: false };
  let typedWord = '';

  const QWERTY = ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), 'ZXCVBNM'.split('')];

  function renderGuessScore() {
    tid('guess-score').textContent =
      PG.data.t('guessScore', { x: guess.score, y: guess.streak }) +
      '  ·  ' + PG.data.t('guessBest', { z: state.guessBest });
  }

  function renderTypeWord(typed, len) {
    const el = tid('type-word');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < len; i++) {
      const tile = document.createElement('div');
      tile.className = 'type-tile' + (i < typed.length ? ' filled' : '');
      tile.textContent = i < typed.length ? typed[i].toUpperCase() : '';
      el.appendChild(tile);
    }
  }

  function renderTypeKeyboard() {
    const kb = tid('type-keyboard');
    if (!kb) return;
    kb.innerHTML = '';
    QWERTY.forEach((row, ri) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'btn-key';
        btn.textContent = letter;
        btn.setAttribute('data-key', letter);
        btn.addEventListener('click', () => onTypeKey(letter.toLowerCase()));
        rowEl.appendChild(btn);
      });
      if (ri === 2) {
        const bsp = document.createElement('button');
        bsp.className = 'btn-key btn-key-bsp';
        bsp.textContent = '⌫';
        bsp.addEventListener('click', () => onTypeKey('backspace'));
        rowEl.appendChild(bsp);
      }
      kb.appendChild(rowEl);
    });
  }

  function onTypeKey(key) {
    if (guess.answered) return;
    const target = guess.round.target;
    const targetNorm = PG.guess.normalize(target.name);
    if (key === 'backspace') {
      typedWord = typedWord.slice(0, -1);
    } else if (typedWord.length < targetNorm.length) {
      typedWord += key;
    }
    renderTypeWord(typedWord, targetNorm.length);
    if (typedWord.length >= targetNorm.length) {
      revealGuess(PG.guess.isCorrect(typedWord, target.name));
    }
  }

  function renderGuessRound() {
    guess.answered = false;
    typedWord = '';
    const target = guess.round.target;
    const targetNorm = PG.guess.normalize(target.name);
    const sprite = tid('guess-sprite');
    sprite.src = PG.data.spritePath(target.id, false);
    sprite.classList.add('silhouette');
    sprite.alt = '';
    tid('guess-prompt').textContent = PG.data.t('guessPrompt');
    tid('guess-result').textContent = '';
    tid('guess-next-btn').hidden = true;
    tid('guess-skip-btn').hidden = false;
    renderTypeWord('', targetNorm.length);
    renderTypeKeyboard();
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

  function revealGuess(won) {
    guess.answered = true;
    const target = guess.round.target;
    const sprite = tid('guess-sprite');
    sprite.classList.remove('silhouette');
    sprite.alt = target.name;
    const kb = tid('type-keyboard');
    if (kb) kb.querySelectorAll('.btn-key').forEach(b => { b.disabled = true; });
    tid('guess-skip-btn').hidden = true;
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
```

- [ ] **Step 4: Update `wire()` in `src/main.js`**

Remove these three lines from `wire()`:
```js
    tid('guess-form').addEventListener('submit', e => { e.preventDefault(); onGuessSubmit(); });
    tid('guess-giveup-btn').addEventListener('click', () => { PG.sound.play('blip'); onGuessGiveUp(); });
```
And change:
```js
    tid('guess-next-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuessRound(); });
```
to (same, but also add skip-btn wiring after it):
```js
    tid('guess-next-btn').addEventListener('click', () => { PG.sound.play('blip'); startGuessRound(); });
    tid('guess-skip-btn').addEventListener('click', () => { PG.sound.play('blip'); revealGuess(false); });
```

- [ ] **Step 5: Update `GAME` hooks and add `typeGuessLetters`**

Replace `forceGuessRound`, `getGuessState` in `window.GAME`:
```js
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
    typeGuessLetters(str) {
      PG.guess.normalize(str).split('').forEach(ch => onTypeKey(ch));
    },
```

- [ ] **Step 6: Add CSS for on-screen keyboard and word tiles**

Add the following block in `styles.css`, right after the `.guess-prompt` rule (around line 246):

```css
/* On-screen keyboard (guess mode redesign) */
.type-word {
  display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;
  min-height: 50px; padding: 4px 0;
}
.type-tile {
  width: 36px; height: 44px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--display); font-size: 18px; font-weight: 800; color: rgba(255,255,255,.45);
  background: rgba(0,0,0,.22); border: 2.5px solid rgba(255,255,255,.3);
}
.type-tile.filled {
  background: rgba(255,255,255,.92); color: var(--ink); border-color: #fff;
}
.type-keyboard { display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%; }
.kb-row { display: flex; gap: 4px; }
.btn-key {
  width: 28px; height: 36px; border: none; border-radius: 6px;
  background: rgba(255,255,255,.88); color: var(--ink);
  font-family: var(--display); font-weight: 800; font-size: 12px;
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 3px 0 rgba(0,0,0,.22);
}
.btn-key:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.22); }
.btn-key:disabled { opacity: 0.35; pointer-events: none; }
.btn-key-bsp { width: 44px; font-size: 15px; }
```

- [ ] **Step 7: Run all tests — verify all pass**

```bash
npx playwright test --reporter=line
```
Expected: **19 passed** (0 failed)

- [ ] **Step 8: Commit**

```bash
git add src/main.js styles.css tests/17-guess.spec.js
git commit -m "feat: on-screen keyboard guess mode; fix wire() crash from old DOM refs"
```

---

### Task 2: Poké Ball DOM + rest CSS

**Files:**
- Modify: `index.html` (add `[data-testid="poke-ball"]` inside `#stage`)
- Modify: `styles.css` (`.poke-ball` rest state)
- Create: `tests/18-throw-interaction.spec.js` (first test: ball visibility)

**Interfaces:**
- Produces: `[data-testid="poke-ball"]` element — visible in encounter, absent elsewhere

- [ ] **Step 1: Write the failing visibility test** — create `tests/18-throw-interaction.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('poke-ball visible during encounter, hidden elsewhere', async ({ page }) => {
  await page.goto('/?test=1');

  // Title screen — no ball
  await expect(page.getByTestId('poke-ball')).not.toBeVisible();

  // Enter a real encounter
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(25, false));
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  await expect(page.getByTestId('poke-ball')).toBeVisible();

  // After catching, navigate to find screen — ball not visible
  await page.evaluate(() => window.GAME.forceCatchResult(true));
  await page.getByTestId('throw-btn').click();
  await page.getByTestId('find-another-btn').click();
  await expect(page.getByTestId('poke-ball')).not.toBeVisible();
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx playwright test tests/18-throw-interaction.spec.js --reporter=line
```
Expected: FAIL with "Locator: getByTestId('poke-ball') … locator expected to be not visible but was"  
(or "locator resolved to 0 elements" before the element exists)

- [ ] **Step 3: Add `[data-testid="poke-ball"]` inside `#stage` in `index.html`**

Change:
```html
        <div data-testid="stage" class="stage">
          <img data-testid="wild-sprite" class="wild-sprite" alt="" />
          <div data-testid="catch-ring" class="ring"></div>
        </div>
```
To:
```html
        <div data-testid="stage" class="stage">
          <img data-testid="wild-sprite" class="wild-sprite" alt="" />
          <div data-testid="catch-ring" class="ring"></div>
          <div data-testid="poke-ball" class="poke-ball" role="button" aria-label="Lempar Poké Ball"></div>
        </div>
```

- [ ] **Step 4: Add `.poke-ball` CSS in `styles.css`** — place immediately before the `.ring` rule (around line 209):

```css
/* ---- Draggable Poké Ball ---- */
.poke-ball {
  position: absolute; bottom: 10px; left: 50%;
  transform: translateX(-50%);
  width: 54px; height: 54px; border-radius: 50%;
  background: linear-gradient(180deg, var(--poke-red) 50%, var(--ball-white) 50%);
  border: 3px solid var(--ball-black);
  box-shadow: 0 5px 12px rgba(0,0,0,.4);
  cursor: grab; touch-action: none; z-index: 10;
  transition: transform 0.22s ease-out;
}
.poke-ball::before {
  content: ''; position: absolute; top: 50%; left: 0; right: 0;
  height: 3px; background: var(--ball-black); transform: translateY(-50%);
}
.poke-ball::after {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 16px; height: 16px;
  background: var(--ball-white); border: 3px solid var(--ball-black); border-radius: 50%;
  transform: translate(-50%, -50%);
}
.poke-ball.grabbing { cursor: grabbing; transition: none; }
```

- [ ] **Step 5: Run 18-throw-interaction to verify test passes**

```bash
npx playwright test tests/18-throw-interaction.spec.js --reporter=line
```
Expected: PASS

- [ ] **Step 6: Run all tests — verify 20 pass**

```bash
npx playwright test --reporter=line
```
Expected: **20 passed**

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css tests/18-throw-interaction.spec.js
git commit -m "feat: add Poké Ball DOM element and rest CSS to encounter stage"
```

---

### Task 3: Throw pipeline refactor (requestThrow + beginThrow)

Split `onThrow()` into `requestThrow(source)` (guard + quality capture) and `async beginThrow(quality)` (the async throw sequence). Both the button and the ball flick call `requestThrow`. A `throwing` flag prevents re-entry.

**Files:**
- Modify: `src/main.js` (`onThrow` → `requestThrow` + `beginThrow`, `wire()`)

**Interfaces:**
- Produces: `requestThrow(source)` — callable from button click and flick handler; source is `'button'` or `'flick'`
- Produces: `async beginThrow(quality)` — runs the full throw sequence (sound, delays, resolve)
- `throwing` flag is module-local; no exposure needed

- [ ] **Step 1: Replace `onThrow` with `requestThrow` + `beginThrow` in `src/main.js`**

Replace:
```js
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
```

With:
```js
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
    const btn = tid('throw-btn');
    if (btn) btn.disabled = true;
    stopRing();
    tid('quality-msg').textContent = PG.data.qualityLabel(quality);
    PG.sound.play('throw');
    await wait(400);
    for (let i = 0; i < 3; i++) { PG.sound.play('tick'); await wait(220); }
    const chance = PG.catch.chance(state.current.tier, quality);
    const caught = forced.result != null ? forced.result : rng.chance(chance);
    forced.result = null;
    throwing = false;
    if (caught) resolveCaught(); else resolveMiss();
  }
```

- [ ] **Step 2: Update button wiring in `wire()`**

Change:
```js
    tid('throw-btn').addEventListener('click', onThrow);
```
To:
```js
    tid('throw-btn').addEventListener('click', () => requestThrow('button'));
```

- [ ] **Step 3: Run all 20 tests — verify all pass**

```bash
npx playwright test --reporter=line
```
Expected: **20 passed** (the throw pipeline is behaviourally identical to before)

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor: split onThrow into requestThrow + beginThrow for dual entry points"
```

---

### Task 4: Animation CSS + throw timeline

Add CSS keyframes for the full throw sequence. Update `beginThrow` to drive those animations with skippable `wait()` calls. A one-shot skip listener on `document` collapses any remaining delay to zero. Add `resetBall()` called from `startEncounter` and `showFind` to clear animation classes between encounters.

**Files:**
- Modify: `styles.css` (new keyframes + `.poke-ball.*` and `.wild-sprite.*` classes)
- Modify: `src/main.js` (`beginThrow`, `resolveMiss`, `startEncounter`, `showFind`, `resetBall`)

**Interfaces:**
- `resetBall()` — module-local; removes all animation classes from ball and sprite, clears inline styles

- [ ] **Step 1: Add animation CSS to `styles.css`** — place after the `.poke-ball.grabbing` rule:

```css
/* Throw arc: ball travels to the Pokémon */
.poke-ball.throwing {
  animation: ballArc 0.3s ease-in forwards;
  pointer-events: none; transition: none;
}
@keyframes ballArc {
  0%   { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
  100% { transform: translateX(-50%) translateY(var(--arc-dy, -110px)) scale(0.12); opacity: 0.25; }
}

/* Sprite suck-in toward the ball */
.wild-sprite.captured {
  animation: spriteCapture 0.35s ease-in forwards;
}
@keyframes spriteCapture {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(0) scale(0.05); opacity: 0; }
}

/* Ball wobble (3 cycles, then stops) */
.poke-ball.wobble {
  animation: ballWobble 0.22s ease-in-out 3 forwards;
}
@keyframes ballWobble {
  0%,100% { transform: translateX(-50%) rotate(0deg); }
  25%  { transform: translateX(-50%) rotate(-14deg); }
  75%  { transform: translateX(-50%) rotate(14deg); }
}

/* Miss: ball bursts open */
.poke-ball.open {
  animation: ballOpen 0.32s ease-out forwards;
  pointer-events: none;
}
@keyframes ballOpen {
  0%   { transform: translateX(-50%) scale(1); opacity: 1; }
  45%  { transform: translateX(-50%) scale(1.5); opacity: 0.7; }
  100% { transform: translateX(-50%) scale(0.8); opacity: 0; }
}

/* Miss: sprite pops back */
.wild-sprite.escape {
  animation: spriteEscape 0.35s ease-out forwards;
}
@keyframes spriteEscape {
  0%   { transform: translateY(0) scale(0.05); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

/* Disable all ball/sprite animations for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  .poke-ball.throwing, .poke-ball.wobble, .poke-ball.open,
  .wild-sprite.captured, .wild-sprite.escape { animation: none !important; }
}
```

- [ ] **Step 2: Add `resetBall()` to `src/main.js`** — insert after `currentRingScale()`:

```js
  function resetBall() {
    const ball = tid('poke-ball');
    const sprite = tid('wild-sprite');
    if (ball) {
      ball.classList.remove('throwing', 'wobble', 'open', 'grabbing');
      ball.style.transform = '';
      ball.style.removeProperty('--arc-dy');
    }
    if (sprite) {
      sprite.classList.remove('captured', 'escape');
    }
  }
```

- [ ] **Step 3: Call `resetBall()` from `startEncounter` and `showFind`**

In `startEncounter`, add `resetBall();` right before `startRing();`:
```js
    resetBall();
    startRing();
```

In `showFind`, add `resetBall();` after `stopRing();`:
```js
    stopRing();
    resetBall();
```

- [ ] **Step 4: Replace the body of `beginThrow` in `src/main.js`** with the animation-aware version:

```js
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

    // Resolve outcome
    const chance = PG.catch.chance(state.current.tier, quality);
    const caught = forced.result != null ? forced.result : rng.chance(chance);
    forced.result = null;
    throwing = false;

    if (caught) {
      resolveCaught();
    } else {
      if (ball) ball.classList.add('open');
      if (sprite) { sprite.classList.remove('captured'); sprite.classList.add('escape'); }
      // Restore shiny animation on miss if applicable.
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
```

- [ ] **Step 5: Run all 20 tests — verify all pass**

```bash
npx playwright test --reporter=line
```
Expected: **20 passed** (`?test=1` zeroes all `sw()` delays so animations are instant)

- [ ] **Step 6: Commit**

```bash
git add src/main.js styles.css
git commit -m "feat: ball throw animation — arc, suck-in, wobble, open/escape with skip"
```

---

### Task 5: Drag-and-flick pointer handlers

Replace the old stage-level swipe handler with pointer handlers on the ball itself. `pointerdown` starts drag tracking, `pointermove` translates the ball, `pointerup` decides: upward flick (≥24px) → `requestThrow('flick')`, otherwise → `snapBack()`.

**Files:**
- Modify: `src/main.js` (`wire()`, add `snapBack`)

**Interfaces:**
- No new public API

- [ ] **Step 1: Update the `wire()` function in `src/main.js`**

Remove the old stage swipe block:
```js
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
```

Add this ball interaction block in its place:

```js
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
          // Capture ring quality at the exact moment of release.
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
```

- [ ] **Step 2: Add `snapBack()` to `src/main.js`** — insert after `resetBall()`:

```js
  function snapBack() {
    const ball = tid('poke-ball');
    if (!ball) return;
    ball.style.transform = '';   // CSS transition eases it back to translateX(-50%)
  }
```

- [ ] **Step 3: Run all 20 tests — verify all pass**

```bash
npx playwright test --reporter=line
```
Expected: **20 passed**

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: drag-and-flick ball interaction; replaces old stage swipe handler"
```

---

### Task 6: Flick interaction tests

Complete `tests/18-throw-interaction.spec.js` with three more tests: flick-to-catch, no-flick-does-not-throw, and button-regression.

**Files:**
- Modify: `tests/18-throw-interaction.spec.js`

- [ ] **Step 1: Add three tests to `tests/18-throw-interaction.spec.js`**

Append after the existing visibility test:

```js
test('flick on poke-ball triggers throw and resolves', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => {
    window.GAME.forceSpawn(25, false);
    window.GAME.forceCatchResult(true);
  });
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => {
    window.GAME.forceSpawn(25, false);
    window.GAME.forceCatchResult(true);
  });

  const ball = page.getByTestId('poke-ball');
  const box = await ball.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 80, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByTestId('result-msg')).toContainText('Pikachu');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
});

test('tiny drag (no flick) does not throw', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(25, false));

  const ball = page.getByTestId('poke-ball');
  const box = await ball.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move upward only 8px — below the 24px threshold
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 8, { steps: 2 });
  await page.mouse.up();

  // throw-btn should still be enabled (no throw happened)
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  await expect(page.getByTestId('result-msg')).toHaveText('');
});

test('button still works as reliable fallback (regression)', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => {
    window.GAME.forceSpawn(718, false);
    window.GAME.forceThrowQuality('perfect');
    window.GAME.forceCatchResult(true);
  });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
});
```

- [ ] **Step 2: Run all tests — verify all pass**

```bash
npx playwright test --reporter=line
```
Expected: **23 passed** (20 prior + 3 new interaction tests)

- [ ] **Step 3: Commit**

```bash
git add tests/18-throw-interaction.spec.js
git commit -m "test: ball flick, no-flick, and button-regression tests (task 6)"
```
