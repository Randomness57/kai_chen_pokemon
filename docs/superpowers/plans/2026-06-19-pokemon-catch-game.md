# Tangkap Pokémon! — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully offline, browser-based, Pokémon GO–style *catch-and-collect* game in Bahasa Indonesia for an 8-year-old, with a 22-Pokémon roster (Zygarde + Excadrill), shiny variants, and a self-saving Pokédex — verified end-to-end with Playwright.

**Architecture:** Static files only (`index.html` + `styles.css` + `src/*.js`). Because Chrome blocks ES-module loading from the `file://` origin, **all game scripts are classic `<script>` tags that attach to one shared `window.PG` namespace** (works offline *and* over HTTP). Pure logic lives in small focused modules (`rng`, `storage`, `data`, `spawn`, `catch`, `sound`, `pokedex`); `main.js` is the orchestrator that owns state, routing, animations, and the `window.GAME` test API. Pokémon images are downloaded once into `images/` (+ `images/shiny/`) and committed, so the shipped game never touches the network.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build step, no runtime deps). Dev-only: Node 18+, `@playwright/test`, `http-server`. A Node `.mjs` script downloads sprites at build time.

## Global Constraints

- **Offline-first:** the shipped game is `index.html` + `styles.css` + `src/*.js` + `images/`. No network calls at runtime, no build step. Opening `index.html` directly from disk must work.
- **No ES modules in game code.** Use classic `<script>` tags; every game module attaches to `window.PG`. (`scripts/fetch-sprites.mjs` is a Node build tool and may be ESM.)
- **All player-facing text is Bahasa Indonesia**, sourced from `PG.data.STRINGS` via `PG.data.t(key, vars)`. Pokémon proper names stay as-is.
- **Forgiving by design:** a wild Pokémon never flees; the kid can always retry. Catch chance is clamped to `[0.10, 0.98]` (never impossible, never guaranteed).
- **Roster = exactly 22 Pokémon** with ids: `25,133,1,4,7,39,52,143,94,130,282,700,448,6,9,3,658,149,530,150,384,718`. Zygarde(718) is the legendary star (extra spawn weight 20).
- **Shiny rate = `PG.data.SHINY_RATE = 1/12`**, rolled independently per encounter; shiny catch odds equal normal odds.
- **Determinism for tests:** `?seed=N` seeds the RNG; `?test=1` zeroes animation waits; `window.GAME` exposes `forceSpawn(id, shiny?)`, `forceShiny(bool)`, `forceThrowQuality(q)`, `forceCatchResult(bool)`, `getState()`, `resetSave()`. These hooks are inert in normal play.
- **Test selectors:** target `[data-testid="..."]` attributes (listed per task), never CSS classes or text, for stability.
- **Script load order in `index.html`** (dependencies flow downward): `rng → storage → data → spawn → catch → sound → pokedex → main`.

---

## File Structure

```
index.html                 # shell + all screen markup + ordered <script> tags
styles.css                 # all styling + animations
src/rng.js                 # PG.rng  — seedable RNG
src/storage.js             # PG.storage — localStorage + in-memory fallback
src/data.js                # PG.data — ROSTER, TIERS, SHINY_RATE, STRINGS, t(), get(), spritePath()
src/spawn.js               # PG.spawn.wild(rng) — weighted encounter + shiny roll
src/catch.js               # PG.catch — qualityFromRing(), chance(), QUALITY_BONUS
src/sound.js               # PG.sound — Web Audio SFX + mute (persisted)
src/pokedex.js             # PG.pokedex.render(grid, progress, state)
src/main.js                # orchestrator: state, routing, ring/throw, window.GAME
images/{id}.png            # committed normal sprites
images/shiny/{id}.png      # committed shiny sprites
images/manifest.json       # [ids]
scripts/fetch-sprites.mjs  # build-time downloader (Node ESM)
tests/*.spec.js            # Playwright specs (dev only)
package.json               # dev deps + scripts
playwright.config.js       # webServer = http-server on :5173
```

---

### Task 1: Project scaffold, tooling, and smoke test

**Files:**
- Create: `package.json`, `playwright.config.js`, `index.html`, `styles.css`, `.gitignore`
- Test: `tests/01-smoke.spec.js`

**Interfaces:**
- Produces: an `http-server` on `http://localhost:5173` serving the repo root; a bootable `index.html` whose `<h1 data-testid="title">` reads "Tangkap Pokémon!".

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tangkap-pokemon",
  "version": "1.0.0",
  "private": true,
  "description": "Offline Pokemon catch-and-collect game in Bahasa Indonesia",
  "scripts": {
    "serve": "http-server -p 5173 -c-1 -s .",
    "fetch-sprites": "node scripts/fetch-sprites.mjs",
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "http-server": "^14.1.1"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
test-results/
playwright-report/
.DS_Store
```

- [ ] **Step 3: Create `playwright.config.js`** (CommonJS — note `package.json` has no `"type":"module"`)

```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npx http-server -p 5173 -c-1 -s .',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 4: Create a minimal `index.html`**

```html
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tangkap Pokémon!</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app">
    <section data-screen="title" class="screen active">
      <h1 data-testid="title">Tangkap Pokémon!</h1>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 5: Create a minimal `styles.css`**

```css
:root { --pokeRed: #ef4444; --grass1: #7ed957; --grass2: #4ea64b; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Trebuchet MS", "Segoe UI", system-ui, sans-serif;
  background: linear-gradient(160deg, var(--grass1), var(--grass2)); color: #1f2937; }
.screen { display: none; min-height: 100vh; padding: 16px; }
.screen.active { display: flex; flex-direction: column; align-items: center; }
h1 { font-size: clamp(28px, 6vw, 56px); color: #fff; text-shadow: 2px 2px 0 var(--pokeRed); }
```

- [ ] **Step 6: Install dependencies and the browser**

Run:
```bash
npm install
npx playwright install chromium
```
Expected: installs complete with exit code 0.

- [ ] **Step 7: Write the failing smoke test** — `tests/01-smoke.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('boots with no console errors and shows the title', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByTestId('title')).toHaveText('Tangkap Pokémon!');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 8: Run the test**

Run: `npx playwright test tests/01-smoke.spec.js`
Expected: PASS (title present, no console errors).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore playwright.config.js index.html styles.css tests/01-smoke.spec.js
git commit -m "chore: scaffold offline Pokemon game + Playwright smoke test"
```

---

### Task 2: Seedable RNG module (`PG.rng`)

**Files:**
- Create: `src/rng.js`
- Modify: `index.html` (add `<script src="src/rng.js"></script>` before `</body>`)
- Test: `tests/02-rng.spec.js`

**Interfaces:**
- Produces: `PG.rng.create(seed?)` → `{ float(): number, int(maxExclusive): number, chance(p): boolean, pick(array): any }`. With no `seed` it uses `Math.random`; with a numeric `seed` it is a deterministic mulberry32 stream.

- [ ] **Step 1: Write the failing test** — `tests/02-rng.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('seeded RNG is deterministic and bounded; unseeded varies', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const a = PG.rng.create(42); const b = PG.rng.create(42);
    const seqA = [a.float(), a.float(), a.float()];
    const seqB = [b.float(), b.float(), b.float()];
    const r = PG.rng.create(7);
    let inRange = true;
    for (let i = 0; i < 100; i++) { const f = r.float(); if (f < 0 || f >= 1) inRange = false; }
    const u = PG.rng.create();
    return { seqA, seqB, inRange, hasFloat: typeof u.float() === 'number' };
  });
  expect(result.seqA).toEqual(result.seqB); // same seed → same sequence
  expect(result.inRange).toBe(true);
  expect(result.hasFloat).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/02-rng.spec.js`
Expected: FAIL ("PG is not defined").

- [ ] **Step 3: Create `src/rng.js`**

```js
window.PG = window.PG || {};
PG.rng = {
  create(seed) {
    if (seed == null || Number.isNaN(seed)) {
      const f = () => Math.random();
      return { float: f, int: n => Math.floor(f() * n), chance: p => f() < p, pick: a => a[Math.floor(f() * a.length)] };
    }
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { float: next, int: n => Math.floor(next() * n), chance: p => next() < p, pick: a => a[Math.floor(next() * a.length)] };
  },
};
```

- [ ] **Step 4: Add the script tag to `index.html`** (just before `</body>`)

```html
  <script src="src/rng.js"></script>
</body>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/02-rng.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/rng.js index.html tests/02-rng.spec.js
git commit -m "feat: seedable RNG module"
```

---

### Task 3: Storage module (`PG.storage`)

**Files:**
- Create: `src/storage.js`
- Modify: `index.html` (add `<script src="src/storage.js"></script>` after `rng.js`)
- Test: `tests/03-storage.spec.js`

**Interfaces:**
- Produces: `PG.storage.SAVE_KEY` (string); `PG.storage.load()` → `{ caught: number[], caughtShiny: number[], muted: boolean }` (defaults when empty); `PG.storage.save(data)` (persists to `localStorage`, falls back to in-memory if blocked); `PG.storage.clear()`.

- [ ] **Step 1: Write the failing test** — `tests/03-storage.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('storage round-trips save data with sane defaults', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => {
    PG.storage.clear();
    const empty = PG.storage.load();
    PG.storage.save({ caught: [25, 1], caughtShiny: [25], muted: true });
    const loaded = PG.storage.load();
    return { empty, loaded };
  });
  expect(out.empty).toEqual({ caught: [], caughtShiny: [], muted: false });
  expect(out.loaded).toEqual({ caught: [25, 1], caughtShiny: [25], muted: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/03-storage.spec.js`
Expected: FAIL ("Cannot read properties of undefined").

- [ ] **Step 3: Create `src/storage.js`**

```js
window.PG = window.PG || {};
PG.storage = (function () {
  const KEY = 'tangkap-pokemon-save-v1';
  let mem = null; // in-memory fallback when localStorage is unavailable (e.g. file://)
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function defaults() { return { caught: [], caughtShiny: [], muted: false }; }
  return {
    SAVE_KEY: KEY,
    load() {
      if (mem) return mem;
      const raw = safe(() => localStorage.getItem(KEY), null);
      if (!raw) return defaults();
      const parsed = safe(() => JSON.parse(raw), null);
      return (parsed && typeof parsed === 'object') ? Object.assign(defaults(), parsed) : defaults();
    },
    save(data) {
      const ok = safe(() => { localStorage.setItem(KEY, JSON.stringify(data)); return true; }, false);
      if (!ok) mem = data;
    },
    clear() { mem = null; safe(() => localStorage.removeItem(KEY)); },
  };
})();
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `rng.js`)

```html
  <script src="src/rng.js"></script>
  <script src="src/storage.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/03-storage.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage.js index.html tests/03-storage.spec.js
git commit -m "feat: persistent storage with in-memory fallback"
```

---

### Task 4: Data module (`PG.data`) — roster, tiers, strings

**Files:**
- Create: `src/data.js`
- Modify: `index.html` (add `<script src="src/data.js"></script>` after `storage.js`)
- Test: `tests/04-data.spec.js`

**Interfaces:**
- Produces:
  - `PG.data.ROSTER`: array of `{ id, name, tier, weight? }`, length 22.
  - `PG.data.TIERS`: `{ common, uncommon, rare, legendary }`, each `{ base, weight, ring }`.
  - `PG.data.SHINY_RATE`: `1/12`.
  - `PG.data.STRINGS`: object of Bahasa strings.
  - `PG.data.t(key, vars?)`: formats a string, replacing `{token}` placeholders.
  - `PG.data.qualityLabel('perfect'|'great'|'nice')`: localized throw-quality label.
  - `PG.data.get(id)`: roster entry by id.
  - `PG.data.spritePath(id, shiny?)`: `images/{id}.png` or `images/shiny/{id}.png`.

- [ ] **Step 1: Write the failing test** — `tests/04-data.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('roster has 22 entries incl. Zygarde + Excadrill; strings format correctly', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => ({
    count: PG.data.ROSTER.length,
    ids: PG.data.ROSTER.map(p => p.id),
    zygardeWeight: PG.data.get(718).weight,
    excadrill: PG.data.get(530),
    shinyRate: PG.data.SHINY_RATE,
    caught: PG.data.t('caught', { name: 'Pikachu' }),
    progress: PG.data.t('progress', { x: 3, n: 22 }),
    quality: PG.data.qualityLabel('perfect'),
    normalPath: PG.data.spritePath(25, false),
    shinyPath: PG.data.spritePath(25, true),
  }));
  expect(out.count).toBe(22);
  expect(out.ids).toContain(718);
  expect(out.ids).toContain(530);
  expect(out.zygardeWeight).toBe(20);
  expect(out.excadrill).toMatchObject({ id: 530, name: 'Excadrill', tier: 'rare' });
  expect(out.shinyRate).toBeCloseTo(1 / 12, 5);
  expect(out.caught).toBe('Hore! Pikachu berhasil ditangkap! 🎉');
  expect(out.progress).toBe('Tertangkap: 3 / 22');
  expect(out.quality).toBe('Sempurna!');
  expect(out.normalPath).toBe('images/25.png');
  expect(out.shinyPath).toBe('images/shiny/25.png');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/04-data.spec.js`
Expected: FAIL.

- [ ] **Step 3: Create `src/data.js`**

```js
window.PG = window.PG || {};
PG.data = (function () {
  const ROSTER = [
    { id: 25, name: 'Pikachu', tier: 'common' },
    { id: 133, name: 'Eevee', tier: 'common' },
    { id: 1, name: 'Bulbasaur', tier: 'common' },
    { id: 4, name: 'Charmander', tier: 'common' },
    { id: 7, name: 'Squirtle', tier: 'common' },
    { id: 39, name: 'Jigglypuff', tier: 'common' },
    { id: 52, name: 'Meowth', tier: 'common' },
    { id: 143, name: 'Snorlax', tier: 'uncommon' },
    { id: 94, name: 'Gengar', tier: 'uncommon' },
    { id: 130, name: 'Gyarados', tier: 'uncommon' },
    { id: 282, name: 'Gardevoir', tier: 'uncommon' },
    { id: 700, name: 'Sylveon', tier: 'uncommon' },
    { id: 448, name: 'Lucario', tier: 'uncommon' },
    { id: 6, name: 'Charizard', tier: 'rare' },
    { id: 9, name: 'Blastoise', tier: 'rare' },
    { id: 3, name: 'Venusaur', tier: 'rare' },
    { id: 658, name: 'Greninja', tier: 'rare' },
    { id: 149, name: 'Dragonite', tier: 'rare' },
    { id: 530, name: 'Excadrill', tier: 'rare' },
    { id: 150, name: 'Mewtwo', tier: 'legendary' },
    { id: 384, name: 'Rayquaza', tier: 'legendary' },
    { id: 718, name: 'Zygarde', tier: 'legendary', weight: 20 },
  ];
  const TIERS = {
    common: { base: 0.90, weight: 40, ring: '#4ade80' },
    uncommon: { base: 0.75, weight: 20, ring: '#facc15' },
    rare: { base: 0.55, weight: 8, ring: '#fb923c' },
    legendary: { base: 0.25, weight: 4, ring: '#ef4444' },
  };
  const SHINY_RATE = 1 / 12;
  const STRINGS = {
    title: 'Tangkap Pokémon!',
    subtitle: 'Ayo tangkap semua Pokémon!',
    play: 'Main!',
    openPokedex: 'Koleksiku',
    find: 'Cari Pokémon!',
    wildAppeared: 'Pokémon liar muncul!',
    legendaryAlert: '⚡ Pokémon Legendaris muncul! ⚡',
    shinyAlert: '✨ Pokémon Shiny langka! ✨',
    throwBall: 'Lempar Poké Ball!',
    qPerfect: 'Sempurna!',
    qGreat: 'Hebat!',
    qNice: 'Bagus!',
    caught: 'Hore! {name} berhasil ditangkap! 🎉',
    caughtLegendary: 'LUAR BIASA! Kamu menangkap {name}! 🌟',
    caughtShiny: '✨ WOW! Kamu menangkap {name} Shiny langka! ✨',
    miss: 'Yah, lolos! Coba lagi!',
    findAnother: 'Cari Pokémon lain!',
    pokedexTitle: 'Koleksiku',
    progress: 'Tertangkap: {x} / {n}',
    shinyProgress: 'Shiny: {y}',
    notCaught: 'Belum ditangkap',
    back: 'Kembali',
    unknownName: '???',
  };
  const byId = {};
  ROSTER.forEach(p => { byId[p.id] = p; });
  function t(key, vars) {
    let s = STRINGS[key] != null ? STRINGS[key] : key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  function qualityLabel(q) { return t({ perfect: 'qPerfect', great: 'qGreat', nice: 'qNice' }[q] || 'qNice'); }
  function get(id) { return byId[id]; }
  function spritePath(id, shiny) { return (shiny ? 'images/shiny/' : 'images/') + id + '.png'; }
  return { ROSTER, TIERS, SHINY_RATE, STRINGS, t, qualityLabel, get, spritePath };
})();
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `storage.js`)

```html
  <script src="src/storage.js"></script>
  <script src="src/data.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/04-data.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data.js index.html tests/04-data.spec.js
git commit -m "feat: roster (22, incl. Zygarde + Excadrill), tiers, shiny rate, Bahasa strings"
```

---

### Task 5: Spawn module (`PG.spawn`) — weighted encounter + shiny roll

**Files:**
- Create: `src/spawn.js`
- Modify: `index.html` (add after `data.js`)
- Test: `tests/05-spawn.spec.js`

**Interfaces:**
- Consumes: `PG.rng`, `PG.data.ROSTER`, `PG.data.TIERS`, `PG.data.SHINY_RATE`.
- Produces: `PG.spawn.wild(rng)` → `{ id, name, tier, shiny: boolean }`. Per-Pokémon weight = `entry.weight ?? TIERS[entry.tier].weight`. Shiny is `rng.chance(SHINY_RATE)`.

- [ ] **Step 1: Write the failing test** — `tests/05-spawn.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('spawn returns valid roster members; commons dominate; shinies are rare', async ({ page }) => {
  await page.goto('/?seed=1');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(12345);
    const ids = new Set(PG.data.ROSTER.map(p => p.id));
    let commons = 0, shinies = 0, valid = true;
    for (let i = 0; i < 2000; i++) {
      const w = PG.spawn.wild(rng);
      if (!ids.has(w.id) || typeof w.shiny !== 'boolean') valid = false;
      if (w.tier === 'common') commons++;
      if (w.shiny) shinies++;
    }
    return { valid, commons, shinies };
  });
  expect(out.valid).toBe(true);
  expect(out.commons).toBeGreaterThan(1000);     // commons are the bulk of 2000 spawns
  expect(out.shinies).toBeGreaterThan(40);        // ~1/12 ≈ 167; comfortably > 40
  expect(out.shinies).toBeLessThan(450);          // ...and clearly not the majority
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/05-spawn.spec.js`
Expected: FAIL.

- [ ] **Step 3: Create `src/spawn.js`**

```js
window.PG = window.PG || {};
PG.spawn = {
  wild(rng, roster, tiers) {
    roster = roster || PG.data.ROSTER;
    tiers = tiers || PG.data.TIERS;
    const weighted = roster.map(p => ({ p, w: p.weight != null ? p.weight : tiers[p.tier].weight }));
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = rng.float() * total;
    let chosen = weighted[weighted.length - 1].p;
    for (const e of weighted) { if (r < e.w) { chosen = e.p; break; } r -= e.w; }
    const shiny = rng.chance(PG.data.SHINY_RATE);
    return { id: chosen.id, name: chosen.name, tier: chosen.tier, shiny };
  },
};
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `data.js`)

```html
  <script src="src/data.js"></script>
  <script src="src/spawn.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/05-spawn.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/spawn.js index.html tests/05-spawn.spec.js
git commit -m "feat: weighted spawn with shiny roll"
```

---

### Task 6: Catch math module (`PG.catch`)

**Files:**
- Create: `src/catch.js`
- Modify: `index.html` (add after `spawn.js`)
- Test: `tests/06-catch.spec.js`

**Interfaces:**
- Consumes: `PG.data.TIERS`.
- Produces:
  - `PG.catch.QUALITY_BONUS`: `{ perfect: 1.5, great: 1.2, nice: 1.0 }`.
  - `PG.catch.qualityFromRing(scale)` → `'perfect'|'great'|'nice'` (scale 1=big→0.2=small; smaller is better: `≤0.4` perfect, `≤0.7` great, else nice).
  - `PG.catch.chance(tier, quality)` → number, `= clamp(TIERS[tier].base * QUALITY_BONUS[quality], 0.10, 0.98)`.

- [ ] **Step 1: Write the failing test** — `tests/06-catch.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('throw quality maps from ring size; chance is bonused and clamped', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => ({
    small: PG.catch.qualityFromRing(0.25),
    mid: PG.catch.qualityFromRing(0.6),
    big: PG.catch.qualityFromRing(0.95),
    commonNice: PG.catch.chance('common', 'nice'),
    legendaryNice: PG.catch.chance('legendary', 'nice'),
    legendaryPerfect: PG.catch.chance('legendary', 'perfect'),
  }));
  expect(out.small).toBe('perfect');
  expect(out.mid).toBe('great');
  expect(out.big).toBe('nice');
  expect(out.commonNice).toBeCloseTo(0.90, 5);
  expect(out.legendaryNice).toBeCloseTo(0.25, 5);
  expect(out.legendaryPerfect).toBeCloseTo(0.375, 5);   // 0.25 * 1.5, within clamp
  expect(out.legendaryNice).toBeGreaterThanOrEqual(0.10); // never impossible
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/06-catch.spec.js`
Expected: FAIL.

- [ ] **Step 3: Create `src/catch.js`**

```js
window.PG = window.PG || {};
PG.catch = {
  QUALITY_BONUS: { perfect: 1.5, great: 1.2, nice: 1.0 },
  qualityFromRing(scale) {
    if (scale <= 0.4) return 'perfect';
    if (scale <= 0.7) return 'great';
    return 'nice';
  },
  chance(tier, quality, tiers) {
    tiers = tiers || PG.data.TIERS;
    const base = tiers[tier].base;
    const bonus = PG.catch.QUALITY_BONUS[quality] || 1.0;
    return Math.max(0.10, Math.min(0.98, base * bonus));
  },
};
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `spawn.js`)

```html
  <script src="src/spawn.js"></script>
  <script src="src/catch.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/06-catch.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/catch.js index.html tests/06-catch.spec.js
git commit -m "feat: catch math (throw quality + clamped catch chance)"
```

---

### Task 7: Sound module (`PG.sound`)

**Files:**
- Create: `src/sound.js`
- Modify: `index.html` (add after `catch.js`)
- Test: `tests/07-sound.spec.js`

**Interfaces:**
- Consumes: `PG.storage` (reads/writes `muted`).
- Produces: `PG.sound.play(name)` for `name` in `blip|throw|tick|catch|fanfare|sparkle` (no-op if muted or audio unavailable); `PG.sound.toggleMute()` → new boolean (persisted); `PG.sound.isMuted()` → boolean. Audio is created lazily on first `play()` to respect autoplay rules; all calls are wrapped so they never throw.

- [ ] **Step 1: Write the failing test** — `tests/07-sound.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('sound: play never throws; mute toggles and persists', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => {
    PG.storage.clear();
    let threw = false;
    try { PG.sound.play('catch'); PG.sound.play('nope'); } catch (e) { threw = true; }
    const before = PG.sound.isMuted();
    const after = PG.sound.toggleMute();
    const persisted = PG.storage.load().muted;
    return { threw, before, after, persisted };
  });
  expect(out.threw).toBe(false);
  expect(out.after).toBe(!out.before);
  expect(out.persisted).toBe(out.after);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/07-sound.spec.js`
Expected: FAIL.

- [ ] **Step 3: Create `src/sound.js`**

```js
window.PG = window.PG || {};
PG.sound = (function () {
  let ctx = null;
  let muted = PG.storage.load().muted;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function tone(freq, dur, type, gain) {
    try {
      const c = ac(); if (!c || muted) return;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = gain || 0.08;
      o.connect(g); g.connect(c.destination);
      const now = c.currentTime; o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.stop(now + dur);
    } catch (e) { /* audio unavailable; ignore */ }
  }
  const SFX = {
    blip: () => tone(520, 0.08, 'square'),
    throw: () => tone(300, 0.18, 'sawtooth'),
    tick: () => tone(680, 0.05, 'square'),
    catch: () => { tone(523, 0.12); setTimeout(() => tone(659, 0.12), 90); setTimeout(() => tone(784, 0.18), 180); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.1), i * 120)); },
    sparkle: () => { [1318, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.06), i * 70)); },
  };
  return {
    play(name) { const fn = SFX[name]; if (fn) fn(); },
    toggleMute() { muted = !muted; const s = PG.storage.load(); s.muted = muted; PG.storage.save(s); return muted; },
    isMuted() { return muted; },
  };
})();
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `catch.js`)

```html
  <script src="src/catch.js"></script>
  <script src="src/sound.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/07-sound.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sound.js index.html tests/07-sound.spec.js
git commit -m "feat: synthesized Web Audio SFX with persistent mute"
```

---

### Task 8: Pokédex render module (`PG.pokedex`)

**Files:**
- Create: `src/pokedex.js`
- Modify: `index.html` (add after `sound.js`)
- Test: `tests/08-pokedex.spec.js`

**Interfaces:**
- Consumes: `PG.data.ROSTER`, `PG.data.spritePath`, `PG.data.t`.
- Produces: `PG.pokedex.render(gridEl, progressEl, state)` where `state = { caught: Set<number>, caughtShiny: Set<number> }`. Renders one card per roster member into `gridEl`: each card has `data-testid="dex-card-{id}"` and class `caught`/`uncaught` (+ `shiny` if caught-shiny). Caught cards show the name and the (shiny if applicable) sprite; uncaught show `???` and a silhouette. A caught-shiny card also contains `[data-testid="shiny-badge-{id}"]`. `progressEl` gets `"Tertangkap: X / 22  ·  Shiny: Y"`.

- [ ] **Step 1: Write the failing test** — `tests/08-pokedex.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('pokedex renders 22 cards with caught/uncaught/shiny states + progress', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const grid = document.createElement('div'); grid.id = 'tg';
    const prog = document.createElement('div'); prog.id = 'tp';
    document.body.append(grid, prog);
    const state = { caught: new Set([25, 718]), caughtShiny: new Set([718]) };
    PG.pokedex.render(grid, prog, state);
  });
  await expect(page.locator('#tg [data-testid^="dex-card-"]')).toHaveCount(22);
  await expect(page.locator('#tg [data-testid="dex-card-25"]')).toHaveClass(/caught/);
  await expect(page.locator('#tg [data-testid="dex-card-1"]')).toHaveClass(/uncaught/);
  await expect(page.locator('#tg [data-testid="dex-card-718"]')).toHaveClass(/shiny/);
  await expect(page.locator('#tg [data-testid="shiny-badge-718"]')).toBeVisible();
  await expect(page.locator('#tp')).toHaveText('Tertangkap: 2 / 22  ·  Shiny: 1');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/08-pokedex.spec.js`
Expected: FAIL.

- [ ] **Step 3: Create `src/pokedex.js`**

```js
window.PG = window.PG || {};
PG.pokedex = {
  render(gridEl, progressEl, state) {
    gridEl.innerHTML = '';
    PG.data.ROSTER.forEach(p => {
      const caught = state.caught.has(p.id);
      const shiny = state.caughtShiny.has(p.id);
      const card = document.createElement('div');
      card.className = 'dex-card ' + (caught ? 'caught' : 'uncaught') + (shiny ? ' shiny' : '');
      card.setAttribute('data-testid', 'dex-card-' + p.id);
      if (shiny) {
        const badge = document.createElement('span');
        badge.className = 'shiny-badge';
        badge.textContent = '✨';
        badge.setAttribute('data-testid', 'shiny-badge-' + p.id);
        card.appendChild(badge);
      }
      const img = document.createElement('img');
      img.className = 'dex-img';
      img.src = PG.data.spritePath(p.id, shiny);
      img.alt = caught ? p.name : '';
      const name = document.createElement('div');
      name.className = 'dex-name';
      name.textContent = caught ? p.name : PG.data.t('unknownName');
      card.appendChild(img);
      card.appendChild(name);
      gridEl.appendChild(card);
    });
    if (progressEl) {
      progressEl.textContent =
        PG.data.t('progress', { x: state.caught.size, n: PG.data.ROSTER.length }) +
        '  ·  ' + PG.data.t('shinyProgress', { y: state.caughtShiny.size });
    }
  },
};
```

- [ ] **Step 4: Add the script tag to `index.html`** (after `sound.js`)

```html
  <script src="src/sound.js"></script>
  <script src="src/pokedex.js"></script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test tests/08-pokedex.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pokedex.js index.html tests/08-pokedex.spec.js
git commit -m "feat: Pokedex grid render with shiny badges + progress"
```

---

### Task 9: Download & commit sprites (`scripts/fetch-sprites.mjs`)

**Files:**
- Create: `scripts/fetch-sprites.mjs`
- Create (generated): `images/{id}.png`, `images/shiny/{id}.png`, `images/manifest.json`
- Test: `tests/09-images.spec.js`

**Interfaces:**
- Produces: every roster id has a committed `images/{id}.png` and `images/shiny/{id}.png`; `images/manifest.json` is the JSON array of the 22 ids.

- [ ] **Step 1: Create `scripts/fetch-sprites.mjs`**

```js
import { writeFile, mkdir } from 'node:fs/promises';

// Must stay in sync with src/data.js ROSTER ids.
const IDS = [25, 133, 1, 4, 7, 39, 52, 143, 94, 130, 282, 700, 448, 6, 9, 3, 658, 149, 530, 150, 384, 718];
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

async function grab(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`Suspiciously small file for ${url}`);
  await writeFile(dest, buf);
}

await mkdir('images/shiny', { recursive: true });
for (const id of IDS) {
  await grab(`${BASE}/${id}.png`, `images/${id}.png`);
  await grab(`${BASE}/shiny/${id}.png`, `images/shiny/${id}.png`);
  console.log('saved', id);
}
await writeFile('images/manifest.json', JSON.stringify(IDS));
console.log(`done: ${IDS.length} Pokemon (normal + shiny)`);
```

- [ ] **Step 2: Run the downloader** (one-time, needs internet)

Run: `npm run fetch-sprites`
Expected: prints `saved <id>` for all 22 ids, then `done: 22 Pokemon (normal + shiny)`. If any id 404s, fix the id list and re-run.

- [ ] **Step 3: Write the failing test** — `tests/09-images.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('every roster sprite (normal + shiny) is present and is a real image', async ({ page, request }) => {
  await page.goto('/');
  const ids = await page.evaluate(() => PG.data.ROSTER.map(p => p.id));
  const manifest = await (await request.get('/images/manifest.json')).json();
  expect(manifest.sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
  for (const id of ids) {
    for (const path of [`/images/${id}.png`, `/images/shiny/${id}.png`]) {
      const res = await request.get(path);
      expect(res.ok(), `${path} should exist`).toBeTruthy();
      const buf = await res.body();
      expect(buf.length, `${path} should be non-trivial`).toBeGreaterThan(100);
    }
  }
});
```

- [ ] **Step 4: Run the test**

Run: `npx playwright test tests/09-images.spec.js`
Expected: PASS (all 44 files present).

- [ ] **Step 5: Commit** (sprites are committed so the game is offline)

```bash
git add scripts/fetch-sprites.mjs images/ tests/09-images.spec.js
git commit -m "feat: download + commit roster sprites (normal + shiny) for offline play"
```

---

### Task 10: App shell — screen markup, routing, mute, test API

**Files:**
- Modify: `index.html` (replace `<main>` body with full screen markup; add `src/main.js` script tag last)
- Modify: `styles.css` (add screen/button/grid styles)
- Create: `src/main.js`
- Test: `tests/10-navigation.spec.js`

**Interfaces:**
- Consumes: all `PG.*` modules.
- Produces:
  - Screen routing via `[data-screen="title|game|pokedex"]` + `.active`.
  - Title screen wired: `play-btn` → game (find state), `open-pokedex-btn` → pokedex, `mute-btn` toggles 🔊/🔇.
  - `back-btn` and `dex-back-btn` → title.
  - `window.GAME.getState()` → `{ caught: number[], caughtShiny: number[], muted, current }`; `window.GAME.resetSave()` clears storage + state and re-renders the dex.
  - Internal helpers later tasks extend: `tid(id)`, `showScreen(name)`, `persist()`, `openPokedex()`. (Encounter/catch added in Tasks 11–12.)

- [ ] **Step 1: Write the failing test** — `tests/10-navigation.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('navigation between title, game, and pokedex; mute toggles', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => window.GAME.resetSave());
  await expect(page.locator('[data-screen="title"]')).toHaveClass(/active/);

  await page.getByTestId('play-btn').click();
  await expect(page.locator('[data-screen="game"]')).toHaveClass(/active/);
  await expect(page.getByTestId('find-btn')).toBeVisible();

  await page.getByTestId('back-btn').click();
  await expect(page.locator('[data-screen="title"]')).toHaveClass(/active/);

  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.locator('[data-screen="pokedex"]')).toHaveClass(/active/);
  await expect(page.locator('[data-testid^="dex-card-"]')).toHaveCount(22);

  await page.getByTestId('dex-back-btn').click();
  const muteBefore = await page.getByTestId('mute-btn').textContent();
  await page.getByTestId('mute-btn').click();
  const muteAfter = await page.getByTestId('mute-btn').textContent();
  expect(muteAfter).not.toBe(muteBefore);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/10-navigation.spec.js`
Expected: FAIL (screens/buttons missing).

- [ ] **Step 3: Replace the `<main id="app">…</main>` block in `index.html`** with the full markup

```html
  <main id="app">
    <section data-screen="title" class="screen active">
      <h1 data-testid="title">Tangkap Pokémon!</h1>
      <p data-testid="subtitle" class="subtitle"></p>
      <button data-testid="play-btn" class="btn btn-big">Main!</button>
      <button data-testid="open-pokedex-btn" class="btn">Koleksiku</button>
      <button data-testid="mute-btn" class="btn btn-icon" aria-label="suara">🔊</button>
    </section>

    <section data-screen="game" class="screen" hidden>
      <button data-testid="back-btn" class="btn btn-back">Kembali</button>
      <div data-testid="find-area" class="find-area">
        <button data-testid="find-btn" class="btn btn-big">Cari Pokémon!</button>
      </div>
      <div data-testid="encounter-area" class="encounter-area" hidden>
        <div data-testid="legendary-alert" class="alert legendary" hidden>⚡ Pokémon Legendaris muncul! ⚡</div>
        <div data-testid="shiny-alert" class="alert shiny" hidden>✨ Pokémon Shiny langka! ✨</div>
        <div data-testid="wild-name" class="wild-name"></div>
        <div data-testid="stage" class="stage">
          <img data-testid="wild-sprite" class="wild-sprite" alt="" />
          <div data-testid="catch-ring" class="ring"></div>
        </div>
        <div data-testid="quality-msg" class="quality-msg"></div>
        <div data-testid="result-msg" class="result-msg"></div>
        <button data-testid="throw-btn" class="btn btn-big">Lempar Poké Ball!</button>
        <button data-testid="find-another-btn" class="btn btn-big" hidden>Cari Pokémon lain!</button>
      </div>
    </section>

    <section data-screen="pokedex" class="screen" hidden>
      <button data-testid="dex-back-btn" class="btn btn-back">Kembali</button>
      <h2>Koleksiku</h2>
      <div data-testid="dex-progress" class="dex-progress"></div>
      <div data-testid="pokedex-grid" class="grid"></div>
    </section>

    <div data-testid="confetti" class="confetti-layer" aria-hidden="true"></div>
  </main>
```

- [ ] **Step 4: Append button/screen/grid styles to `styles.css`**

```css
.subtitle { color: #fff; font-size: 18px; margin: 4px 0 18px; }
.btn { font-family: inherit; font-weight: 700; border: 0; border-radius: 16px;
  padding: 14px 22px; margin: 8px; font-size: 20px; cursor: pointer;
  background: #fff; color: #1f2937; box-shadow: 0 4px 0 rgba(0,0,0,.2); transition: transform .08s; }
.btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,.2); }
.btn-big { font-size: 26px; padding: 18px 34px; background: var(--pokeRed); color: #fff; }
.btn-icon { font-size: 26px; padding: 8px 14px; }
.btn-back { align-self: flex-start; background: #e5e7eb; }
.find-area, .encounter-area { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
.alert { font-weight: 800; padding: 8px 16px; border-radius: 12px; }
.alert.legendary { color: #fff; background: #7c3aed; }
.alert.shiny { color: #1f2937; background: linear-gradient(90deg,#fde68a,#fbcfe8); }
.wild-name { font-size: 28px; font-weight: 800; color: #fff; text-shadow: 1px 1px 0 #00000040; }
.stage { position: relative; width: min(70vw, 320px); height: min(70vw, 320px); display: flex; align-items: center; justify-content: center; }
.wild-sprite { max-width: 78%; max-height: 78%; image-rendering: auto; filter: drop-shadow(0 8px 6px rgba(0,0,0,.25)); }
.ring { position: absolute; top: 50%; left: 50%; width: 90%; height: 90%;
  transform: translate(-50%,-50%) scale(1); border: 8px solid #4ade80; border-radius: 50%; opacity: .85; pointer-events: none; }
.quality-msg { font-size: 22px; font-weight: 800; color: #fff; min-height: 26px; }
.result-msg { font-size: 22px; font-weight: 800; color: #fff; min-height: 26px; text-align: center; }
h2 { color: #fff; text-shadow: 1px 1px 0 var(--pokeRed); }
.dex-progress { color: #fff; font-weight: 700; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; width: 100%; max-width: 720px; }
.dex-card { position: relative; background: #ffffffcc; border-radius: 14px; padding: 8px; text-align: center; }
.dex-card.uncaught .dex-img { filter: brightness(0) opacity(.45); }
.dex-card.uncaught .dex-name { color: #6b7280; }
.dex-img { width: 100%; height: 80px; object-fit: contain; }
.dex-name { font-weight: 700; font-size: 14px; }
.shiny-badge { position: absolute; top: 4px; right: 6px; font-size: 18px; }
.confetti-layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
```

- [ ] **Step 5: Create `src/main.js`** (shell only; Tasks 11–12 extend the marked sections)

```js
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
```

- [ ] **Step 6: Add the `main.js` script tag LAST in `index.html`** (after `pokedex.js`)

```html
  <script src="src/pokedex.js"></script>
  <script src="src/main.js"></script>
</body>
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx playwright test tests/10-navigation.spec.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/main.js tests/10-navigation.spec.js
git commit -m "feat: app shell, screen routing, mute, and window.GAME test API"
```

---

### Task 11: Encounter UI — find, spawn, wild display, banners

**Files:**
- Modify: `src/main.js` (replace the `showFind`/`spawn`/`forceSpawn` placeholders + add `startEncounter`, ring control)
- Test: `tests/11-encounter.spec.js`

**Interfaces:**
- Consumes: `PG.spawn.wild`, `PG.data.spritePath`, `PG.data.TIERS`.
- Produces: `startEncounter(pokemon)` renders the wild Pokémon (sprite via `spritePath(id, shiny)`, name, tier-colored ring), shows the legendary alert iff `tier==='legendary'`, the shiny alert iff `pokemon.shiny`, and starts the ring animation. `window.GAME.forceSpawn(id, shiny)` jumps straight into an encounter. `spawn()` rolls a wild via `PG.spawn.wild(rng)` (honoring a pending `forced.shiny`).

- [ ] **Step 1: Write the failing test** — `tests/11-encounter.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('encounter shows sprite/name; Zygarde triggers legendary alert; forceShiny shows shiny art + banner', async ({ page }) => {
  await page.goto('/?test=1&seed=3');

  await page.evaluate(() => window.GAME.forceSpawn(718, false)); // Zygarde, normal
  await expect(page.getByTestId('wild-name')).toHaveText('Zygarde');
  await expect(page.getByTestId('legendary-alert')).toBeVisible();
  await expect(page.getByTestId('shiny-alert')).toBeHidden();
  await expect(page.getByTestId('wild-sprite')).toHaveAttribute('src', 'images/718.png');

  await page.evaluate(() => window.GAME.forceSpawn(25, true)); // shiny Pikachu
  await expect(page.getByTestId('wild-name')).toHaveText('Pikachu');
  await expect(page.getByTestId('shiny-alert')).toBeVisible();
  await expect(page.getByTestId('legendary-alert')).toBeHidden();
  await expect(page.getByTestId('wild-sprite')).toHaveAttribute('src', 'images/shiny/25.png');

  // find-btn path also produces a valid encounter
  await page.getByTestId('back-btn').click();
  await page.getByTestId('play-btn').click();
  await page.getByTestId('find-btn').click();
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  const st = await page.evaluate(() => window.GAME.getState());
  expect(st.current).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/11-encounter.spec.js`
Expected: FAIL (encounter not rendered; sprite src empty).

- [ ] **Step 3: In `src/main.js`, add ring control + `startEncounter` above the `wire()` function** (right after `updateMuteBtn`)

```js
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
```

- [ ] **Step 4: In `src/main.js`, replace the placeholder `function spawn() { }`** with:

```js
  function spawn() {
    const p = PG.spawn.wild(rng);
    if (forced.shiny != null) { p.shiny = forced.shiny; forced.shiny = null; }
    startEncounter(p);
  }
```

- [ ] **Step 5: In `src/main.js`, replace `showFind`** to also stop the ring:

```js
  function showFind() {
    showScreen('game');
    tid('find-area').hidden = false;
    tid('encounter-area').hidden = true;
    stopRing();
    state.current = null;
  }
```

- [ ] **Step 6: In `src/main.js`, fill in `window.GAME.forceSpawn`**:

```js
    forceSpawn(id, shiny) { const p = PG.data.get(id); startEncounter({ id: p.id, name: p.name, tier: p.tier, shiny: !!shiny }); },
```

- [ ] **Step 7: Update `PG._app` export** to include the new helpers (Task 12 needs them):

```js
  PG._app = { tid, wait, showScreen, persist, openPokedex, state, forced, rng, TEST, showFind, startRing, stopRing, currentRingScale, startEncounter };
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx playwright test tests/11-encounter.spec.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main.js tests/11-encounter.spec.js
git commit -m "feat: encounter UI with wild display, legendary + shiny banners, ring"
```

---

### Task 12: Catch interaction — throw, resolve, retry, collection

**Files:**
- Modify: `src/main.js` (replace `onThrow` placeholder; add `resolveCaught`/`resolveMiss`)
- Test: `tests/12-catch.spec.js`

**Interfaces:**
- Consumes: `PG.catch`, `PG.data.qualityLabel`, `PG.data.t`, `PG.sound`, ring helpers from Task 11.
- Produces: clicking `throw-btn` captures throw quality (`forced.quality` or `qualityFromRing(currentRingScale())`), shows the quality label, animates (zeroed under `?test=1`), then resolves via `forced.result` or `rng.chance(PG.catch.chance(tier, quality))`. On catch: add id to `state.caught` (+ `caughtShiny` if shiny), persist, show success message, reveal `find-another-btn`. On miss: show miss message, re-enable `throw-btn`, restart the ring (Pokémon stays).

- [ ] **Step 1: Write the failing test** — `tests/12-catch.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('forced catch adds to collection; miss keeps the Pokemon; shiny tracked separately', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.evaluate(() => window.GAME.resetSave());

  // Guaranteed catch of a normal Charmander
  await page.evaluate(() => { window.GAME.forceSpawn(4, false); window.GAME.forceCatchResult(true); window.GAME.forceThrowQuality('perfect'); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('quality-msg')).toHaveText('Sempurna!');
  await expect(page.getByTestId('result-msg')).toContainText('Charmander');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getState());
  expect(st.caught).toContain(4);
  expect(st.caughtShiny).not.toContain(4);

  // Forced miss: Pokemon stays, throw button still available
  await page.evaluate(() => { window.GAME.forceSpawn(1, false); window.GAME.forceCatchResult(false); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toHaveText('Yah, lolos! Coba lagi!');
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  await expect(page.getByTestId('find-another-btn')).toBeHidden();

  // Now catch a SHINY Eevee → recorded in both layers
  await page.evaluate(() => { window.GAME.forceSpawn(133, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Shiny');
  st = await page.evaluate(() => window.GAME.getState());
  expect(st.caught).toContain(133);
  expect(st.caughtShiny).toContain(133);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/12-catch.spec.js`
Expected: FAIL (throw does nothing).

- [ ] **Step 3: In `src/main.js`, replace `function onThrow() { }`** with the full flow + resolvers:

```js
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
    tid('result-msg').textContent = PG.data.t('miss');
    tid('throw-btn').disabled = false;
    startRing();
  }

  function celebrate(big) { /* visuals added in Task 13 */ }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test tests/12-catch.spec.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.js tests/12-catch.spec.js
git commit -m "feat: Pokemon GO-style throw, catch resolution, forgiving retry, shiny tracking"
```

---

### Task 13: Persistence across reload + Pokédex reflects catches

**Files:**
- Test: `tests/13-persistence.spec.js`
- (No source change expected — this verifies Tasks 8/10/12 integrate. If it fails, fix the relevant module.)

**Interfaces:**
- Consumes: `window.GAME`, Pokédex rendering, storage.

- [ ] **Step 1: Write the test** — `tests/13-persistence.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('catches show in the Pokedex and survive a reload', async ({ page }) => {
  await page.goto('/?test=1&seed=9');
  await page.evaluate(() => window.GAME.resetSave());

  // Catch a shiny Lucario
  await page.evaluate(() => { window.GAME.forceSpawn(448, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Lucario');

  // Open Pokedex: Lucario caught + shiny, others uncaught
  await page.getByTestId('find-another-btn').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/caught/);
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/shiny/);
  await expect(page.getByTestId('dex-card-25')).toHaveClass(/uncaught/);
  await expect(page.getByTestId('dex-progress')).toContainText('Tertangkap: 1 / 22');
  await expect(page.getByTestId('dex-progress')).toContainText('Shiny: 1');

  // Reload (note: localStorage over http persists; this guards the save/load path)
  await page.reload();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/caught/);
  await expect(page.getByTestId('dex-progress')).toContainText('Tertangkap: 1 / 22');
});
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test tests/13-persistence.spec.js`
Expected: PASS. If reload assertion fails, confirm `persist()` runs in `resolveCaught` and `PG.storage.save`/`load` use matching keys/shape.

- [ ] **Step 3: Commit**

```bash
git add tests/13-persistence.spec.js
git commit -m "test: Pokedex reflects catches and persists across reload"
```

---

### Task 14: Celebration, polish, flick-throw, and visual design pass

**Files:**
- Modify: `src/main.js` (`celebrate` body + flick handler + subtitle), `styles.css` (confetti, sparkle, ring pulse, legendary glow, responsive)
- Test: `tests/14-celebration.spec.js`
- Design: invoke `frontend-design` skill for the visual polish pass.

**Interfaces:**
- Produces: `celebrate(big)` injects confetti bits into `[data-testid="confetti"]` and sets `data-active="1"` briefly; a pointer "flick up" on the stage triggers a throw; shiny sprites get a sparkle animation; legendary encounters get a glow.

- [ ] **Step 1: Write the failing test** — `tests/14-celebration.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('catching a legendary fires confetti', async ({ page }) => {
  await page.goto('/?seed=2'); // NOT test mode → confetti lingers long enough to observe
  await page.evaluate(() => window.GAME.resetSave());
  await page.evaluate(() => { window.GAME.forceSpawn(718, false); window.GAME.forceThrowQuality('perfect'); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
  await expect(page.locator('[data-testid="confetti"][data-active="1"]')).toBeVisible();
  await expect(page.locator('[data-testid="confetti"] .confetti-bit').first()).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/14-celebration.spec.js`
Expected: FAIL (no confetti bits).

- [ ] **Step 3: In `src/main.js`, replace `function celebrate(big) { }`** with:

```js
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
```

- [ ] **Step 4: In `src/main.js`, add a flick-throw handler inside `wire()`** (after the mute listener):

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

- [ ] **Step 5: Append polish styles to `styles.css`**

```css
.confetti-bit { position: absolute; top: -12px; width: 10px; height: 14px; border-radius: 2px; animation: fall 1.4s linear forwards; }
@keyframes fall { to { transform: translateY(105vh) rotate(540deg); opacity: .2; } }
.ring { animation: ringPulse 1.2s ease-in-out infinite; }
@keyframes ringPulse { 0%,100% { opacity: .85; } 50% { opacity: .5; } }
.wild-sprite.is-shiny { animation: shinyGlow 1.4s ease-in-out infinite; }
@keyframes shinyGlow { 0%,100% { filter: drop-shadow(0 8px 6px rgba(0,0,0,.25)); } 50% { filter: drop-shadow(0 0 16px #fde68a) drop-shadow(0 0 24px #f472b6); } }
.alert.legendary { animation: legendPulse 0.9s ease-in-out infinite; }
@keyframes legendPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@media (max-width: 480px) { .btn-big { font-size: 22px; } .grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); } }
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx playwright test tests/14-celebration.spec.js`
Expected: PASS.

- [ ] **Step 7: Visual design pass**

Invoke the `frontend-design` skill and refine `styles.css` / markup for a polished, kid-friendly, Pokémon-themed look (typography, color, spacing, button feel, grassy background, Poké Ball motifs). Keep all `data-testid` attributes intact. Re-run the full suite afterward (Step 8).

- [ ] **Step 8: Run the full suite**

Run: `npx playwright test`
Expected: all specs PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main.js styles.css tests/14-celebration.spec.js
git commit -m "feat: confetti, shiny glow, ring pulse, flick-throw, responsive polish"
```

---

### Task 15: Offline verification + full playthrough QA

**Files:**
- Test: `tests/15-offline.spec.js`, `tests/16-playthrough.spec.js`

**Interfaces:**
- Verifies the Global Constraints: boots from `file://`, needs no external network, and a full catch flow (including a shiny Zygarde) works end to end.

- [ ] **Step 1: Write the offline test** — `tests/15-offline.spec.js`

```js
const { test, expect } = require('@playwright/test');
const path = require('path');

test('boots directly from the file:// origin (offline double-click)', async ({ page }) => {
  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?test=1';
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(fileUrl);
  await expect(page.getByTestId('title')).toHaveText('Tangkap Pokémon!');
  await page.getByTestId('play-btn').click();
  await page.getByTestId('find-btn').click();
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  // sprite actually loads from local disk
  const loaded = await page.getByTestId('wild-sprite').evaluate(img => img.complete && img.naturalWidth > 0);
  expect(loaded).toBe(true);
  expect(errors).toEqual([]);
});

test('runs with all external (non-localhost) network blocked', async ({ page }) => {
  await page.route('**', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('file://')) return route.continue();
    return route.abort();
  });
  await page.goto('/?test=1');
  await page.evaluate(() => { window.GAME.forceSpawn(718, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
});
```

- [ ] **Step 2: Run the offline test**

Run: `npx playwright test tests/15-offline.spec.js`
Expected: PASS. (If the `file://` sprite fails to load, confirm `spritePath` returns a **relative** path and `index.html` uses relative `src` paths.)

- [ ] **Step 3: Write the full playthrough test** — `tests/16-playthrough.spec.js`

```js
const { test, expect } = require('@playwright/test');

test('full journey: catch several, then a shiny Zygarde, reflected in the Pokedex', async ({ page }) => {
  await page.goto('/?test=1&seed=11');
  await page.evaluate(() => window.GAME.resetSave());
  await page.getByTestId('play-btn').click();

  const toCatch = [25, 4, 658, 530]; // Pikachu, Charmander, Greninja, Excadrill
  for (const id of toCatch) {
    await page.evaluate(i => { window.GAME.forceSpawn(i, false); window.GAME.forceCatchResult(true); }, id);
    await page.getByTestId('throw-btn').click();
    await expect(page.getByTestId('find-another-btn')).toBeVisible();
    await page.getByTestId('find-another-btn').click();
  }

  // The grand prize: shiny Zygarde
  await page.evaluate(() => { window.GAME.forceSpawn(718, true); window.GAME.forceThrowQuality('perfect'); window.GAME.forceCatchResult(true); });
  await expect(page.getByTestId('legendary-alert')).toBeVisible();
  await expect(page.getByTestId('shiny-alert')).toBeVisible();
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Shiny');

  await page.getByTestId('find-another-btn').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-progress')).toContainText('Tertangkap: 5 / 22');
  await expect(page.getByTestId('dex-progress')).toContainText('Shiny: 1');
  await expect(page.getByTestId('dex-card-718')).toHaveClass(/shiny/);
  await expect(page.getByTestId('shiny-badge-718')).toBeVisible();
});
```

- [ ] **Step 4: Run the playthrough test**

Run: `npx playwright test tests/16-playthrough.spec.js`
Expected: PASS.

- [ ] **Step 5: Run the entire suite one final time**

Run: `npx playwright test`
Expected: ALL specs green.

- [ ] **Step 6: Manual sanity check**

Open `index.html` directly in a real browser (double-click), play through: find → throw (try timing the ring) → catch → open Koleksiku. Confirm sounds play, mute works, and art shows. Note any rough edges for a follow-up polish pass.

- [ ] **Step 7: Commit**

```bash
git add tests/15-offline.spec.js tests/16-playthrough.spec.js
git commit -m "test: offline file:// boot, no-network, and full playthrough incl. shiny Zygarde"
```

---

## Definition of Done

- `npx playwright test` is fully green (16 spec files).
- The game boots by double-clicking `index.html` with no internet and no console errors.
- A kid can: find wild Pokémon, throw with the ring-timing mechanic, catch them (never permanently fails), collect all 22 including **Excadrill** and the legendary **Zygarde**, find and catch **shinies** (tracked separately), and have the **collection auto-save**. All text is Bahasa Indonesia.

## Self-Review notes (already reconciled)

- **Spec coverage:** offline (Task 1/15), no-ES-modules (load order Tasks 2–10), Bahasa strings (Task 4), forgiving retry (Task 12), roster=22 + Zygarde weight (Task 4), shiny rate + separate tracking (Tasks 5/8/12), Pokémon GO ring/throw (Tasks 11/12/14), persistence (Task 13), sound+mute (Task 7), test hooks (Tasks 10–12), celebrations (Task 14), Excadrill present (Task 4, id 530). ✔
- **Type consistency:** `state.caught`/`caughtShiny` are `Set`s in runtime, serialized as arrays via `persist()`/`storage`; `getState()` returns arrays. `qualityFromRing→quality→qualityLabel/chance` use the same `'perfect'|'great'|'nice'` vocabulary throughout. `spritePath(id, shiny)` signature is identical in `data`, `pokedex`, and `main`. ✔
- **No placeholders:** the `spawn`/`onThrow`/`celebrate`/`forceSpawn` stubs in Task 10 are explicitly filled with complete code in Tasks 11/12/14. ✔
