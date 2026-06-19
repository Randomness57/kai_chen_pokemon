window.PG = window.PG || {};
PG.spawn = {
  wild(rng, roster, tiers) {
    roster = roster || PG.data.ROSTER;
    tiers = tiers || PG.data.TIERS;
    const weighted = roster.map(p => ({ p, w: p.weight != null ? p.weight : tiers[p.tier].weight }));
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = rng.float() * total;
    let chosen = weighted[weighted.length - 1].p;
    for (const e of weighted) { if (r < e.w) { chosen = e.p; break; } r -= e.w; }
    const shiny = rng.chance(PG.data.SHINY_RATE);
    return { id: chosen.id, name: chosen.name, tier: chosen.tier, shiny };
  },
};
