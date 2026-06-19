const { test, expect } = require('@playwright/test');

test('every roster sprite (normal + shiny) is present and is a real image', async ({ page, request }) => {
  await page.goto('/');
  const ids = await page.evaluate(() => PG.data.ROSTER.map(p => p.id));
  const manifest = await (await request.get('/images/manifest.json')).json();
  expect(manifest.sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
  for (const id of ids) {
    for (const path of [`/images/${id}.png`, `/images/shiny/${id}.png`]) {
      const res = await request.get(path);
      expect(res.ok(), `${path} should exist`).toBeTruthy();
      const buf = await res.body();
      expect(buf.length, `${path} should be non-trivial`).toBeGreaterThan(100);
    }
  }
});
