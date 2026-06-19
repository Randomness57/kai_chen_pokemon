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
