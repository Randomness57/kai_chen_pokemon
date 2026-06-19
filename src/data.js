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
    guessMode: 'Tebak Pokémon!',
    guessPrompt: 'Siapa Pokémon ini?',
    guessCorrect: 'Benar! Ini {name}! 🎉',
    guessWrong: 'Yah! Ini {name}.',
    guessNext: 'Lanjut!',
    guessScore: 'Skor: {x}  ·  Streak: {y}',
    guessBest: 'Rekor terbaik: {z}',
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
