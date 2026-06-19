const { test, expect } = require('@playwright/test');

test('storage round-trips save data with sane defaults', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => {
    PG.storage.clear();
    const empty = PG.storage.load();
    PG.storage.save({ caught: [25, 1], caughtShiny: [25], muted: true });
    const loaded = PG.storage.load();
    return { empty, loaded };
  });
  expect(out.empty).toEqual({ caught: [], caughtShiny: [], muted: false });
  expect(out.loaded).toEqual({ caught: [25, 1], caughtShiny: [25], muted: true });
});
