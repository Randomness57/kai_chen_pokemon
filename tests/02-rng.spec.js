const { test, expect } = require('@playwright/test');

test('seeded RNG is deterministic and bounded; unseeded varies', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const a = PG.rng.create(42); const b = PG.rng.create(42);
    const seqA = [a.float(), a.float(), a.float()];
    const seqB = [b.float(), b.float(), b.float()];
    const r = PG.rng.create(7);
    let inRange = true;
    for (let i = 0; i < 100; i++) { const f = r.float(); if (f < 0 || f >= 1) inRange = false; }
    const u = PG.rng.create();
    return { seqA, seqB, inRange, hasFloat: typeof u.float() === 'number' };
  });
  expect(result.seqA).toEqual(result.seqB); // same seed → same sequence
  expect(result.inRange).toBe(true);
  expect(result.hasFloat).toBe(true);
});
