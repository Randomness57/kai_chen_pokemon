const { test, expect } = require('@playwright/test');

test('throw quality maps from ring size; chance is bonused and clamped', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => ({
    small: PG.catch.qualityFromRing(0.25),
    mid: PG.catch.qualityFromRing(0.6),
    big: PG.catch.qualityFromRing(0.95),
    commonNice: PG.catch.chance('common', 'nice'),
    legendaryNice: PG.catch.chance('legendary', 'nice'),
    legendaryPerfect: PG.catch.chance('legendary', 'perfect'),
  }));
  expect(out.small).toBe('perfect');
  expect(out.mid).toBe('great');
  expect(out.big).toBe('nice');
  expect(out.commonNice).toBeCloseTo(0.40, 5);
  expect(out.legendaryNice).toBeCloseTo(0.13, 5);
  expect(out.legendaryPerfect).toBeCloseTo(0.26, 5);   // 0.13 * 2.0, within clamp
  expect(out.legendaryNice).toBeGreaterThanOrEqual(0.10); // never impossible
});
