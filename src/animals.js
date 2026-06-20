window.PG = window.PG || {};
PG.animals = (function () {
  // A small, kid-friendly menagerie. We use emoji as the artwork (no downloaded
  // files needed) and blacken them into silhouettes with a CSS filter — same
  // "guess the shape, then read the reveal" idea as the Pokémon mode.
  // Names are in Bahasa Indonesia to match the rest of the game; we favour
  // animals whose FULL-BODY emoji make a recognisable silhouette.
  const ANIMALS = [
    { id: 1, name: 'Gajah', emoji: '🐘' },
    { id: 2, name: 'Jerapah', emoji: '🦒' },
    { id: 3, name: 'Zebra', emoji: '🦓' },
    { id: 4, name: 'Harimau', emoji: '🐅' },
    { id: 5, name: 'Buaya', emoji: '🐊' },
    { id: 6, name: 'Kura-kura', emoji: '🐢' },
    { id: 7, name: 'Lumba-lumba', emoji: '🐬' },
    { id: 8, name: 'Hiu', emoji: '🦈' },
    { id: 9, name: 'Gurita', emoji: '🐙' },
    { id: 10, name: 'Kupu-kupu', emoji: '🦋' },
    { id: 11, name: 'Lebah', emoji: '🐝' },
    { id: 12, name: 'Kanguru', emoji: '🦘' },
    { id: 13, name: 'Unta', emoji: '🐪' },
    { id: 14, name: 'Badak', emoji: '🦏' },
    { id: 15, name: 'Ular', emoji: '🐍' },
    { id: 16, name: 'Siput', emoji: '🐌' },
    { id: 17, name: 'Kepiting', emoji: '🦀' },
    { id: 18, name: 'Ikan', emoji: '🐠' },
    { id: 19, name: 'Penguin', emoji: '🐧' },
    { id: 20, name: 'Burung hantu', emoji: '🦉' },
    { id: 21, name: 'Merak', emoji: '🦚' },
    { id: 22, name: 'Flamingo', emoji: '🦩' },
    { id: 23, name: 'Kuda', emoji: '🐎' },
    { id: 24, name: 'Sapi', emoji: '🐄' },
    { id: 25, name: 'Babi', emoji: '🐖' },
    { id: 26, name: 'Domba', emoji: '🐑' },
    { id: 27, name: 'Kelinci', emoji: '🐇' },
    { id: 28, name: 'Kucing', emoji: '🐈' },
    { id: 29, name: 'Anjing', emoji: '🐕' },
    { id: 30, name: 'Monyet', emoji: '🐒' },
    { id: 31, name: 'Katak', emoji: '🐸' },
    { id: 32, name: 'Bebek', emoji: '🦆' },
  ];
  const byId = {};
  ANIMALS.forEach(a => { byId[a.id] = a; });
  return {
    ANIMALS,
    get(id) { return byId[id]; },
    // Pick a random animal to silhouette (the player types the name, so no options).
    round(rng, list) {
      list = list || ANIMALS;
      return { target: rng.pick(list) };
    },
    // Forgiving normalization: lowercase, drop spaces/punctuation/accents so
    // "Kura-kura", "kura kura" and "kurakura" all compare equal.
    normalize(s) {
      return String(s == null ? '' : s)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');
    },
    isCorrect(input, name) {
      const a = PG.animals.normalize(input);
      return a.length > 0 && a === PG.animals.normalize(name);
    },
  };
})();
