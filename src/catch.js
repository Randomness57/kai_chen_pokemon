window.PG = window.PG || {};
PG.catch = {
  QUALITY_BONUS: { perfect: 2.0, great: 1.35, nice: 1.0 },
  qualityFromRing(scale) {
    if (scale <= 0.4) return 'perfect';
    if (scale <= 0.7) return 'great';
    return 'nice';
  },
  chance(tier, quality, tiers) {
    tiers = tiers || PG.data.TIERS;
    const base = tiers[tier].base;
    const bonus = PG.catch.QUALITY_BONUS[quality] || 1.0;
    return Math.max(0.10, Math.min(0.98, base * bonus));
  },
};
