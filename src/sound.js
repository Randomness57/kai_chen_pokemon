window.PG = window.PG || {};
PG.sound = (function () {
  let ctx = null;
  let muted = PG.storage.load().muted;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function tone(freq, dur, type, gain) {
    try {
      const c = ac(); if (!c || muted) return;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = gain || 0.08;
      o.connect(g); g.connect(c.destination);
      const now = c.currentTime; o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.stop(now + dur);
    } catch (e) { /* audio unavailable; ignore */ }
  }
  const SFX = {
    blip: () => tone(520, 0.08, 'square'),
    throw: () => tone(300, 0.18, 'sawtooth'),
    tick: () => tone(680, 0.05, 'square'),
    catch: () => { tone(523, 0.12); setTimeout(() => tone(659, 0.12), 90); setTimeout(() => tone(784, 0.18), 180); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.1), i * 120)); },
    sparkle: () => { [1318, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.06), i * 70)); },
  };
  return {
    play(name) { const fn = SFX[name]; if (fn) fn(); },
    toggleMute() { muted = !muted; const s = PG.storage.load(); s.muted = muted; PG.storage.save(s); return muted; },
    isMuted() { return muted; },
  };
})();
