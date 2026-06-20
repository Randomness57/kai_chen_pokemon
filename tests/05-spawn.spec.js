const { test, expect } = require('@playwright/test');

test('spawn returns valid roster members; tier weighting holds; shinies are rare', async ({ page }) => {
  await page.goto('/?seed=1');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(12345);
    const ids = new Set(PG.data.ROSTER.map(p => p.id));
    const tiers = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    let shinies = 0, valid = true;
    for (let i = 0; i < 4000; i++) {
      const w = PG.spawn.wild(rng);
      if (!ids.has(w.id) || typeof w.shiny !== 'boolean') valid = false;
      tiers[w.tier]++;
      if (w.shiny) shinies++;
    }
    return { valid, tiers, shinies };
  });
  expect(out.valid).toBe(true);
  // Every tier shows up...
  expect(out.tiers.common).toBeGreaterThan(0);
  expect(out.tiers.legendary).toBeGreaterThan(0);
  // ...and the weighting holds: an individual common is much likelier than an
  // individual legendary (per-mon weight 40 vs 4), so the small common pool still
  // out-spawns the large legendary pool; the big uncommon pool leads overall.
  expect(out.tiers.common).toBeGreaterThan(out.tiers.legendary);
  expect(out.tiers.uncommon).toBeGreaterThan(out.tiers.common);
  // Shiny ≈ 1/12 of 4000 ≈ 333; comfortably inside a sane band.
  expect(out.shinies).toBeGreaterThan(150);
  expect(out.shinies).toBeLessThan(650);
});
