window.PG = window.PG || {};
PG.guess = {
  // Fisher–Yates shuffle driven by the seedable rng (non-mutating).
  shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
  // Build one round: a target Pokémon plus (count-1) distractors, options shuffled.
  round(rng, roster, count) {
    roster = roster || PG.data.ROSTER;
    count = Math.min(count || 4, roster.length);
    const target = rng.pick(roster);
    const pool = PG.guess.shuffle(roster.filter(p => p.id !== target.id), rng);
    const options = PG.guess.shuffle([target].concat(pool.slice(0, count - 1)), rng);
    return { target, options };
  },
};
