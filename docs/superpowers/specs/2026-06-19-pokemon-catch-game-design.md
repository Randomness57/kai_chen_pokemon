# Tangkap Pokémon! — Design Spec

**Date:** 2026-06-19
**Audience:** An 8-year-old Indonesian kid obsessed with Pokémon (favorite: Zygarde).
**One-liner:** A bright, forgiving, Pokémon GO–style *catch-and-collect* game that runs offline in the browser by double-clicking `index.html`. All UI text in Bahasa Indonesia.

---

## Goals & non-goals

**Goals**
- Pure fun for one specific 8-year-old. Recognizable real Pokémon, big colorful art, zero frustration.
- Works **fully offline** as a self-contained folder (double-click `index.html`, no install, no internet).
- The Pokémon GO catch feel: a wild Pokémon, a shrinking target ring, throw a Poké Ball with timing, celebrate.
- A **collection / Pokédex** that fills up over time and **saves automatically**, giving a "gotta catch 'em all" pull.
- **Zygarde** is the rare legendary trophy at the heart of the chase.
- **Shiny Pokémon** — any encounter has a small chance to be a sparkly alternate-color variant, tracked separately as a second collection layer (the ultimate flex).

**Non-goals (explicitly out of scope)**
- No turn-based battles, no walking-around map, no leveling/evolution, no trading, no accounts/login, no backend.
- No real GPS/AR. No berries/items in v1 (possible later stretch).

---

## Technical approach

**Plain HTML + CSS + vanilla JavaScript (ES modules), one self-contained folder, no build step, no runtime dependencies.**

- Runtime is pure static files; the kid double-clicks `index.html`.
- Pokémon images are **downloaded once at build time** from the open PokeAPI sprite library and committed into `images/`. The shipped game never touches the network.
- Node + `@playwright/test` + a tiny static server are **dev-only** dependencies (for testing); they are not part of what the kid runs.

Rejected alternatives: a game framework (Phaser/Kaboom) — overkill for a tap-to-catch game; React/Vite — needs a build step that fights the "just double-click" requirement.

---

## Project structure

```
pokemon-game/                 # the shippable, offline game (this is what the kid gets)
  index.html
  styles.css
  src/
    main.js                   # boot, screen routing
    data.js                   # roster + rarity + Bahasa strings
    spawn.js                  # weighted random encounter logic
    catch.js                  # Pokémon GO–style ring + throw + catch resolution
    pokedex.js                # collection grid rendering
    storage.js                # localStorage wrapper w/ in-memory fallback
    sound.js                  # Web Audio synthesized SFX + mute
    rng.js                    # seedable RNG + test hooks
  images/                     # committed sprites (offline)
    25.png 718.png 530.png ...
    shiny/                    # shiny variants
      25.png 718.png ...
    manifest.json
docs/superpowers/specs/...    # this spec + the plan
scripts/
  fetch-sprites.mjs           # build-time: download roster sprites into images/
tests/                        # Playwright specs (dev only)
package.json                  # dev deps: @playwright/test, http-server
playwright.config.js
```

---

## Roster (22 Pokémon)

Names stay as-is (proper nouns). Sprites = PokeAPI official artwork (normal + shiny):
`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png`
`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/{id}.png`

| Tier | Base catch | Pokémon (PokeAPI id) |
|------|-----------|----------------------|
| Common | ~90% | Pikachu(25), Eevee(133), Bulbasaur(1), Charmander(4), Squirtle(7), Jigglypuff(39), Meowth(52) |
| Uncommon | ~75% | Snorlax(143), Gengar(94), Gyarados(130), Gardevoir(282), Sylveon(700), Lucario(448) |
| Rare | ~55% | Charizard(6), Blastoise(9), Venusaur(3), Greninja(658), Dragonite(149), **Excadrill(530)** |
| Legendary | ~25% | Mewtwo(150), Rayquaza(384), **Zygarde(718)** ⭐ |

Spawn weights make commons frequent and legendaries rare. **Zygarde is the rarest spawn** (given an extra-high individual weight so it's the reachable legendary star) and triggers a special alert + glow + extra-big celebration on catch. Adding a Pokémon later = drop two PNGs (`images/` + `images/shiny/`) + one row in `data.js`.

## Shiny Pokémon

Every encounter independently rolls a **small shiny chance (~8%, tunable)**. A shiny:
- uses the **shiny sprite** (`images/shiny/{id}.png`) and gets a continuous **sparkle ✨ animation**,
- shows a banner: **"✨ Pokémon Shiny langka! ✨"** (stacks with the legendary alert for a shiny Zygarde),
- on catch fires an **extra-special celebration** ("✨ WOW! {name} Shiny langka! ✨") with a distinct sparkle sound,
- is tracked as a **separate collection layer**: the Pokédex records *caught* and *caught-shiny* independently. A caught-shiny card shows a ✨ badge and displays the shiny art; the dex header shows both "Tertangkap: X / 22" and "Shiny: Y".

Catch odds are identical for shiny vs normal (shininess only affects appearance/rarity-of-encounter), so a kid is never penalized for finding one.

---

## Core game loop (forgiving — you cannot "lose")

1. **Title screen** — title "Tangkap Pokémon!", one giant **"Main!"** button, a **Pokédex** button, mute toggle.
2. **Cari Pokémon!** — kid taps to find a wild Pokémon. Weighted-random spawn. Banner: "Pokémon liar muncul!" (or the legendary alert for Zygarde).
3. **Catch screen (Pokémon GO style):**
   - The Pokémon sits center; a **target ring continuously pulses/shrinks** around it. Ring color hints difficulty (green→yellow→orange→red by tier).
   - Kid **throws** the Poké Ball either by tapping the big **"Lempar!"** button or by **flicking the ball upward** (pointer drag / touch swipe up, with forgiving auto-aim).
   - At the moment of release, ring size sets **throw quality**: small ring → **"Sempurna!"** (big bonus), medium → **"Hebat!"**, large → **"Bagus!"** (no bonus).
   - Ball arcs in, Pokémon is drawn in, ball **wobbles 1–2–3**, then resolves.
   - **Catch chance = base(tier) × timing bonus**, clamped to a forgiving range. On success: sparkles/confetti, "Hore! [Nama] berhasil ditangkap! 🎉", added to Pokédex, happy sound. On miss: ball bursts, "Yah, lolos! Coba lagi!", **the Pokémon stays so the kid retries until caught** (no fleeing, no fail state).
4. **After catch** — "Cari Pokémon lain!" returns to step 2. Caught Pokémon now shows in the Pokédex.
5. **Pokédex / Koleksiku** — a grid of cards; caught = full color, uncaught = grey silhouette labeled "???". Header shows "Tertangkap: X / N". Catching Zygarde is the headline trophy.

---

## Bahasa Indonesia string set (initial)

| Key | Text |
|-----|------|
| title | Tangkap Pokémon! |
| play | Main! |
| find | Cari Pokémon! |
| wildAppeared | Pokémon liar muncul! |
| legendaryAlert | ⚡ Pokémon Legendaris muncul! ⚡ |
| shinyAlert | ✨ Pokémon Shiny langka! ✨ |
| throw | Lempar Poké Ball! |
| quality.perfect / great / nice | Sempurna! / Hebat! / Bagus! |
| caught | Hore! {name} berhasil ditangkap! 🎉 |
| caughtLegendary | LUAR BIASA! Kamu menangkap {name}! 🌟 |
| caughtShiny | ✨ WOW! Kamu menangkap {name} Shiny langka! ✨ |
| miss | Yah, lolos! Coba lagi! |
| findAnother | Cari Pokémon lain! |
| pokedex | Koleksiku |
| progress | Tertangkap: {x} / {n} |
| shinyProgress | Shiny: {y} |
| notCaught | Belum ditangkap |
| back | Kembali |
| muteOn / muteOff | 🔊 / 🔇 |

All strings live in `data.js` so wording is easy to tweak.

---

## Persistence

`storage.js` wraps `localStorage` (key `tangkap-pokemon-save-v1`) in try/catch and **falls back to in-memory** if unavailable (some browsers restrict `localStorage` on the `file://` origin). The game runs fine either way; persistence is a graceful enhancement. Saved data = `{ caught: number[], caughtShiny: number[], muted: boolean }`. A hidden reset hook is exposed for testing.

---

## Sound

`sound.js` uses the **Web Audio API to synthesize** SFX (throw *whoosh*, wobble *tick*, catch *ding*, legendary fanfare, button blip) — **no audio files**, fully offline. A persistent **mute toggle** (state saved). Audio is created lazily after first user gesture (browser autoplay rules).

---

## Visuals

Bright, chunky, kid-friendly: Poké Ball red/white palette, grassy gradient background, rounded playful typography, large tap-friendly buttons, simple satisfying animations (ball arc, ring pulse, wobble, sparkle/confetti). Responsive enough for laptop and tablet/touch. Final visual polish via the `frontend-design` skill during the build.

---

## Testability hooks (so Playwright can drive it deterministically)

Runtime exposes a small test API on `window` (guarded behind `?test=1`):
- `rng` is **seedable** (`rng.js`); `?seed=N` sets it.
- `window.GAME.forceSpawn(id, shiny?)` — force the next encounter (optionally shiny).
- `window.GAME.forceShiny(true|false)` — force shininess of the next spawn.
- `window.GAME.forceThrowQuality('perfect'|'great'|'nice')` and `forceCatchResult(true|false)` — make outcomes deterministic.
- `window.GAME.getState()` / `resetSave()` — inspect/clear collection.
- `?test=1` shortens/zeroes animation durations so tests are fast and stable.

These hooks are inert in normal play (no `?test=1`).

---

## Testing strategy (Playwright)

Tests run against a **local static server** (`http-server`) via Playwright's `webServer`, plus one test that loads via `file://` to prove offline boot, and one "no external network" test (block all non-localhost requests, confirm the game still works because images are local). TDD per feature: write the spec test first, then implement. Coverage:

- **Smoke:** page loads, title visible, no console errors.
- **Navigation:** Main → game; Pokédex opens/closes.
- **Spawn:** encounter appears; `forceSpawn` works; legendary alert shows for Zygarde; rarity weighting (seeded, statistical).
- **Catch:** throw resolves; good timing yields higher quality/bonus; success adds to collection; miss keeps the Pokémon for retry.
- **Shiny:** `forceShiny` produces shiny sprite + sparkle + shiny banner; catching a shiny records it in the shiny collection layer; shiny catch odds equal normal.
- **Pokédex + persistence:** caught shows full-color, uncaught silhouette; caught-shiny shows ✨ badge + shiny art; progress + shiny counters correct; collection survives reload (where storage available).
- **Legendary:** Zygarde alert + special celebration DOM present on catch.
- **Offline:** boots via `file://`; works with external network blocked.

**Definition of done:** all Playwright tests green; manual full playthrough including catching Zygarde; works opened directly from disk; no console errors.

---

## Risks / open notes

- `localStorage` on `file://` is browser-dependent → handled by in-memory fallback; persistence is best-effort for the offline build.
- Sprite licensing: PokeAPI sprites are community assets used here for a personal, non-commercial kid's game.
- Flick-throw on a trackpad can be awkward → the **"Lempar!" button is always available** as the primary, reliable input; flick is a bonus.
