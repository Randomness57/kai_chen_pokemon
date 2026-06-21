const { test, expect } = require('@playwright/test');

test('inventory: generous defaults, Poké Ball is unlimited, badges shown', async ({ page }) => {
  await page.goto('/?test=1&seed=2');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(25, false));
  await expect(page.getByTestId('ball-count-poke')).toHaveText('∞');
  await expect(page.getByTestId('ball-count-great')).toHaveText('×50');
  await expect(page.getByTestId('ball-count-ultra')).toHaveText('×30');
  await expect(page.getByTestId('ball-count-master')).toHaveText('×15');
  const inv = await page.evaluate(() => window.GAME.getState().inventory);
  expect(inv).toEqual({ great: 50, ultra: 30, master: 15 });
});

test('throwing spends one of the chosen ball; the Poké Ball never runs down', async ({ page }) => {
  await page.goto('/?test=1&seed=4');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(1, false));
  // A plain Poké Ball throw doesn't reduce any stock.
  await page.evaluate(() => window.GAME.forceCatchResult(false));
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toHaveText('Yah, lolos! Coba lagi!');
  expect(await page.evaluate(() => window.GAME.getState().inventory)).toEqual({ great: 50, ultra: 30, master: 15 });

  // Switch to Ultra and throw: ultra drops by one, others unchanged.
  await page.getByTestId('ball-btn-ultra').click();
  await page.evaluate(() => window.GAME.forceCatchResult(false));
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('ball-count-ultra')).toHaveText('×29');
  expect(await page.evaluate(() => window.GAME.getState().inventory)).toEqual({ great: 50, ultra: 29, master: 15 });
});

test('a depleted ball disables and selection falls back to the Poké Ball', async ({ page }) => {
  await page.goto('/?test=1&seed=6');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(150, false)); // legendary Mewtwo
  await page.evaluate(() => window.GAME.setInventory({ master: 1 }));
  await expect(page.getByTestId('ball-count-master')).toHaveText('×1');

  await page.getByTestId('ball-btn-master').click();
  await expect(page.getByTestId('ball-btn-master')).toHaveClass(/selected/);

  // Master ball guarantees the catch; spending the last one disables it.
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Mewtwo');
  await expect(page.getByTestId('ball-count-master')).toHaveText('×0');
  await expect(page.getByTestId('ball-btn-master')).toBeDisabled();

  // Next encounter is back on the Poké Ball, and master stays empty + disabled.
  await page.getByTestId('find-another-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(4, false));
  await expect(page.getByTestId('ball-btn-poke')).toHaveClass(/selected/);
  expect(await page.evaluate(() => window.GAME.getState().ball)).toBe('poke');
  await expect(page.getByTestId('ball-btn-master')).toBeDisabled();
});

test('inventory persists across reload', async ({ page }) => {
  await page.goto('/?test=1&seed=8');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(1, false));
  await page.getByTestId('ball-btn-great').click();
  await page.evaluate(() => window.GAME.forceCatchResult(true));
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  expect((await page.evaluate(() => window.GAME.getState().inventory)).great).toBe(49);

  await page.reload();
  expect((await page.evaluate(() => window.GAME.getState().inventory)).great).toBe(49);
});
