const { test, expect } = require('@playwright/test');

test('catches show in the Pokedex and survive a reload', async ({ page }) => {
  await page.goto('/?test=1&seed=9');
  await page.evaluate(() => window.GAME.resetSave());

  // Catch a shiny Lucario
  await page.evaluate(() => { window.GAME.forceSpawn(448, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Lucario');

  // Open Pokedex: Lucario caught + shiny, others uncaught
  await page.getByTestId('find-another-btn').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/caught/);
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/shiny/);
  await expect(page.getByTestId('dex-card-25')).toHaveClass(/uncaught/);
  await expect(page.getByTestId('dex-progress')).toContainText('Tertangkap: 1 / 22');
  await expect(page.getByTestId('dex-progress')).toContainText('Shiny: 1');

  // Reload (note: localStorage over http persists; this guards the save/load path)
  await page.reload();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-card-448')).toHaveClass(/caught/);
  await expect(page.getByTestId('dex-progress')).toContainText('Tertangkap: 1 / 22');
});
