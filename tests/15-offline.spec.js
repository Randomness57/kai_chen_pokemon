const { test, expect } = require('@playwright/test');
const path = require('path');

test('boots directly from the file:// origin (offline double-click)', async ({ page }) => {
  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?test=1';
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(fileUrl);
  await expect(page.getByTestId('title')).toHaveText('Tangkap Pokémon!');
  await page.getByTestId('play-btn').click();
  await page.getByTestId('find-btn').click();
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  // sprite actually loads from local disk
  const loaded = await page.getByTestId('wild-sprite').evaluate(img => img.complete && img.naturalWidth > 0);
  expect(loaded).toBe(true);
  expect(errors).toEqual([]);
});

test('runs with all external (non-localhost) network blocked', async ({ page }) => {
  await page.route('**', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('file://')) return route.continue();
    return route.abort();
  });
  await page.goto('/?test=1');
  await page.evaluate(() => { window.GAME.forceSpawn(718, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
});
