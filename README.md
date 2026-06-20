# kai_chen_pokemon

An offline, browser-based educational game for kids, in Bahasa Indonesia. Plain
vanilla JavaScript — no framework, no build step.

## Modes

- **Main! (Catch)** — A wild Pokémon appears; time the shrinking ring and throw a
  Poké Ball to catch it. Pick from four ball types before each throw — a stronger
  ball makes the catch easier, and the **Master Ball** never misses:

  | Ball | Effect |
  | --- | --- |
  | Poké Ball | normal catch rate |
  | Great Ball | ×1.5 catch rate |
  | Ultra Ball | ×2.2 catch rate |
  | Master Ball | guaranteed catch |

  Difficulty also depends on the Pokémon's rarity tier (common → legendary).

- **Tebak Pokémon! (Guess)** — Recognise the silhouette and type its name on a
  real keyboard. The on-screen board is a guide: it pulses the next key and
  colours keys by hand to teach two-handed typing.

- **Tebak Hewan! (Animals)** — Same typing tutor, but with everyday animals.
  Each animal is shown as a blacked-out emoji silhouette and revealed in colour
  once typed correctly. No downloaded artwork required.

- **Koleksiku (Pokédex)** — Browse everything caught so far, including shinies.

## Develop

```bash
npm install        # install dev dependencies
npm run serve      # serve at http://localhost:5173
npm test           # run the Playwright suite
```

Source lives in `src/` (one small module per concern), styles in `styles.css`,
and the single page in `index.html`. Sprite assets are under `images/`; the
roster is generated into `src/roster-data.js` by `scripts/fetch-sprites.mjs`.
