window.PG = window.PG || {};
PG.storage = (function () {
  const KEY = 'tangkap-pokemon-save-v1';
  let mem = null; // in-memory fallback when localStorage is unavailable (e.g. file://)
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  // Generous starting stock of the special balls. Plain Poké Balls are unlimited
  // (tracked separately, see PG.data.BALLS) so a kid can never get stuck.
  function defaultInventory() { return { great: 50, ultra: 30, master: 15 }; }
  function defaults() { return { caught: [], caughtShiny: [], muted: false, guessBest: 0, animalBest: 0, inventory: defaultInventory() }; }
  return {
    SAVE_KEY: KEY,
    defaultInventory,
    load() {
      if (mem) return mem;
      const raw = safe(() => localStorage.getItem(KEY), null);
      if (!raw) return defaults();
      const parsed = safe(() => JSON.parse(raw), null);
      if (!(parsed && typeof parsed === 'object')) return defaults();
      const merged = Object.assign(defaults(), parsed);
      // Deep-merge inventory so new ball types appear for old saves.
      merged.inventory = Object.assign(defaultInventory(), (parsed.inventory && typeof parsed.inventory === 'object') ? parsed.inventory : {});
      return merged;
    },
    save(data) {
      const ok = safe(() => { localStorage.setItem(KEY, JSON.stringify(data)); return true; }, false);
      if (!ok) mem = data;
    },
    clear() { mem = null; safe(() => localStorage.removeItem(KEY)); },
  };
})();
