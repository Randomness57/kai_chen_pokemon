# Interactive Poké Ball Throw — Design Spec

**Date:** 2026-06-19
**Audience:** The same 8-year-old; this enhances the existing **Tangkap Pokémon!** catch game.
**One-liner:** Replace the invisible, fixed-timer throw with a **draggable, flickable Poké Ball** that arcs to the wild Pokémon and resolves with a capture-and-wobble animation — keeping the game fully forgiving and all existing behavior intact.

---

## Background — current behavior

Today a throw is triggered two ways (`src/main.js` `onThrow`): clicking **"Lempar Poké Ball!"**, or a crude flick (`pointerdown`/`pointerup` on `#stage` measuring `>30px` upward). Either way it runs a **sound-only** sequence — a whoosh, three ticks (`wait(220)` each) — then resolves. There is **no visible ball, no arc, no capture, no wobble**. Throw **quality** comes from `PG.catch.qualityFromRing(currentRingScale())` (the pulsing ring's size at release); odds come from `PG.catch.chance(tier, quality)`, clamped to `[0.10, 0.98]`. A miss keeps the Pokémon for unlimited retries.

The repo also contains a separate, already-shipped **"Tebak Pokémon!" guess mode** (`src/guess.js`, the `guess` screen, `guessBest` persistence, `tests/17-guess.spec.js`). This feature is **out of scope and must remain fully working.**

---

## Goals & non-goals

**Goals**
- A real Poké Ball the kid **grabs and flicks** to throw — the tactile heart of Pokémon GO.
- The ball **visibly arcs** to the Pokémon, which is then **pulled in**; the ball **wobbles 1-2-3** and either **clicks shut (catch)** or **bursts open (miss)**.
- Stay **forgiving**: auto-aim means no whiffs; the **button still works** as the reliable fallback; the kid still cannot lose.
- Stay **snappy and skippable**: the whole sequence is ~1s and a tap during it skips to the result.

**Non-goals**
- No change to catch odds, roster, shiny logic, sounds set, or the guess mode.
- No real trajectory physics or "miss the target" outcome (aim is auto-homed).
- No new assets, no network, no build step. Pure CSS/JS, offline-first preserved.

---

## Design decisions (confirmed)

1. **Heart of the change:** drag-and-flick the actual ball.
2. **Aim:** forgiving **auto-aim** — any upward flick homes to the Pokémon; a non-flick release snaps the ball back to its rest spot (no throw, no penalty).
3. **Quality source unchanged:** ring size **at the moment of release** → `qualityFromRing`. Flick power affects *motion only*, never odds. Timing the shrinking ring is still the skill.
4. **Payoff included:** suck-in + 1-2-3 wobble + catch-click / miss-burst.
5. **Pace:** ~1s, **skippable** — tapping anywhere during the animation jumps straight to the result.
6. **Fallback preserved:** the **"Lempar Poké Ball!"** button performs the identical throw automatically (uses current ring scale for quality).

---

## Components & data flow

### New DOM (`index.html`, inside the existing `#stage` / encounter-area)
- `[data-testid="poke-ball"]` — a CSS Poké Ball (reuses the `.ball-accent` look) resting at the bottom-center of the stage. `pointer-events: auto`; it is the drag handle.
- The existing `wild-sprite`, `catch-ring`, `quality-msg`, `result-msg`, `throw-btn`, `find-another-btn` are unchanged in identity.

### Ball interaction state (module-local in `main.js`)
A small `ball` object: `{ dragging, startX, startY, startT, raf }`. Pointer handlers are attached to the **ball element** (not the whole stage, replacing the old stage-flick handler):
- `pointerdown` → `setPointerCapture`, record start point/time, add `.grabbing`.
- `pointermove` → translate the ball to follow the pointer (visual only; ring keeps pulsing).
- `pointerup` → compute upward delta. If `(startY - y) > FLICK_THRESHOLD` (e.g. 24px) → **launch** with quality captured **now** from `currentRingScale()`. Otherwise → animate the ball back to rest (`snapBack`), no throw.

### Throw pipeline refactor
`onThrow()` is split so both entry points share one path:
- `requestThrow(source)` — guard (`state.current`, not already throwing), capture `quality` (from `forced.quality` or `qualityFromRing`), then call `beginThrow(quality)`.
  - **Button** click → `requestThrow('button')`.
  - **Flick** release → `requestThrow('flick')`.
- `async beginThrow(quality)` — disables throw-btn, `stopRing()`, sets `quality-msg`, plays `throw`, then runs the **animation timeline** (all delays via the existing `wait()` so they are **0 under `?test=1`**):
  1. **Arc:** ball travels from its current spot to the sprite center, shrinking, ~`wait(280)`.
  2. **Suck-in:** sprite scales/fades toward the ball; ball flashes, ~`wait(160)`.
  3. **Wobble:** ball drops to platform; 3× (`play('tick')`, tilt left/right, `wait(180)`).
  4. **Resolve:** `caught = forced.result ?? rng.chance(chance)`; call existing `resolveCaught()` / `resolveMiss()`.
- **Skip:** while a throw is animating, a one-shot document/stage `pointerdown` (or click) sets a `skip` flag that collapses remaining `wait()`s to 0 and jumps to resolve. Implemented by having `wait()` calls in the timeline check the flag, or by racing each `wait` against a "skip" promise. The button is disabled during animation, so skip uses a separate listener removed on resolve.

### Resolve hooks (reused, lightly extended)
- `resolveCaught()` — unchanged logic (adds to collection, persists, message, confetti). Visually: ball does a "click" settle; sprite stays hidden.
- `resolveMiss()` — unchanged logic (miss message, re-enable throw, `startRing()`). Visually: ball **bursts open**, sprite **pops back** (scale from 0→1), ball returns to rest for the next flick.
- `startEncounter()` / `showFind()` reset the ball to its rest position and clear any animation classes.

### CSS (`styles.css`)
New classes/keyframes: `.poke-ball` (rest), `.poke-ball.grabbing`, `.poke-ball.throwing` (arc), `.poke-ball.wobble` (`@keyframes wobble` tilt), `.poke-ball.open` (burst), `.wild-sprite.captured` (suck-in shrink/fade), `.wild-sprite.escape` (pop back). All decorative motion is disabled under `@media (prefers-reduced-motion: reduce)`.

---

## Test mode & determinism

- Every animation delay routes through `wait(ms)`, which already returns immediately when `?test=1`. So under test mode the new pipeline resolves instantly, exactly like today.
- `forced.quality` and `forced.result` continue to drive deterministic outcomes; the new pipeline reads them at the same points.
- The **button path is preserved byte-for-byte in behavior** (click → throw → resolve), so all existing catch/persistence/playthrough/offline tests pass unchanged.

---

## Test plan

**Must stay green (no edits):** all 18 existing spec files, including `12-catch`, `13-persistence`, `14-celebration`, `16-playthrough`, `17-guess`.

**New — `tests/18-throw-interaction.spec.js`:**
1. **Flick throws & catches:** `forceSpawn` + `forceCatchResult(true)`, then simulate a pointer **drag-flick on `[data-testid="poke-ball"]`** (`mouse.move`→`down`→ move upward →`up`); assert `result-msg` shows the caught name and `find-another-btn` is visible. Proves the ball path reaches resolve.
2. **Tiny/no flick does not throw:** a `pointerdown`/`pointerup` with no upward movement on the ball leaves `result-msg` empty and `throw-btn` still enabled (ball snapped back).
3. **Button still works:** click `throw-btn` with `forceCatchResult(true)` → catch resolves (regression guard for the shared pipeline).
4. **Ball present in encounter:** `[data-testid="poke-ball"]` is visible during an encounter and hidden/absent on the find and title screens.

(Run with `?test=1` so timing is instant; the flick test uses real coordinates from `boundingBox()`.)

---

## Constraints recap
- Offline-first, no new deps/assets, no build step — unchanged.
- All player-facing text already exists in `PG.data.STRINGS`; no new strings needed (quality + result messages reused).
- Preserve `[data-testid]` contract for every existing element.
- **Do not modify** `src/guess.js` or guess-mode markup/behavior.

## Out of scope (possible later)
- Curveball / spin throws, throw streak bonuses, ball selection (Great/Ultra balls), haptics.
