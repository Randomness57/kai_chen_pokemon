window.PG = window.PG || {};
PG.guess = {
  // Pick a random Pokémon to silhouette. (The player types the name, so no options.)
  round(rng, roster) {
    roster = roster || PG.data.ROSTER;
    return { target: rng.pick(roster) };
  },
  // Forgiving normalization: lowercase, drop spaces/punctuation/accents so
  // "Mr. Mime", "mr mime", "mrmime" and "Ho-Oh", "ho oh" all compare equal.
  normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (é → e)
      .replace(/[^a-z0-9]/g, '');
  },
  isCorrect(input, name) {
    const a = PG.guess.normalize(input);
    return a.length > 0 && a === PG.guess.normalize(name);
  },
};
