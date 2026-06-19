const { test, expect } = require('@playwright/test');

test('spawn returns valid roster members; commons dominate; shinies are rare', async ({ page }) => {
  await page.goto('/?seed=1');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(12345);
    const ids = new Set(PG.data.ROSTER.map(p => p.id));
    let commons = 0, shinies = 0, valid = true;
    for (let i = 0; i < 2000; i++) {
      const w = PG.spawn.wild(rng);
      if (!ids.has(w.id) || typeof w.shiny !== 'boolean') valid = false;
      if (w.tier === 'common') commons++;
      if (w.shiny) shinies++;
    }
    return { valid, commons, shinies };
  });
  expect(out.valid).toBe(true);
  expect(out.commons).toBeGreaterThan(1000);     // commons are the bulk of 2000 spawns
  expect(out.shinies).toBeGreaterThan(40);        // ~1/12 ≈ 167; comfortably > 40
  expect(out.shinies).toBeLessThan(450);          // ...and clearly not the majority
});
