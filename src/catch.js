window.PG = window.PG || {};
PG.catch = {
  QUALITY_BONUS: { perfect: 2.0, great: 1.35, nice: 1.0 },
  qualityFromRing(scale) {
    if (scale <= 0.4) return 'perfect';
    if (scale <= 0.7) return 'great';
    return 'nice';
  },
  // `ball` is an optional Poké Ball key (see PG.data.BALLS). A better ball
  // multiplies the catch chance; a "guaranteed" ball (Master Ball) always
  // catches. Omitting `ball` behaves exactly like a plain Poké Ball.
  chance(tier, quality, ball, tiers) {
    tiers = tiers || PG.data.TIERS;
    const balls = (PG.data && PG.data.BALLS) || {};
    const b = ball ? balls[ball] : null;
    if (b && b.guaranteed) return 1.0;
    const base = tiers[tier].base;
    const bonus = PG.catch.QUALITY_BONUS[quality] || 1.0;
    const ballMult = b ? b.mult : 1.0;
    return Math.max(0.10, Math.min(0.98, base * bonus * ballMult));
  },
};
