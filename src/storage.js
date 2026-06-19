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
