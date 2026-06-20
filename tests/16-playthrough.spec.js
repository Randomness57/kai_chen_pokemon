const { test, expect } = require('@playwright/test');

test('full journey: catch several, then a shiny Zygarde, reflected in the Pokedex', async ({ page }) => {
  await page.goto('/?test=1&seed=11');
  await page.evaluate(() => window.GAME.resetSave());
  const n = await page.evaluate(() => PG.data.ROSTER.length);
  await page.getByTestId('play-btn').click();

  const toCatch = [25, 4, 658, 530]; // Pikachu, Charmander, Greninja, Excadrill
  for (const id of toCatch) {
    await page.evaluate(i => { window.GAME.forceSpawn(i, false); window.GAME.forceCatchResult(true); }, id);
    await page.getByTestId('throw-btn').click();
    await expect(page.getByTestId('find-another-btn')).toBeVisible();
    await page.getByTestId('find-another-btn').click();
  }

  // The grand prize: shiny Zygarde
  await page.evaluate(() => { window.GAME.forceSpawn(718, true); window.GAME.forceThrowQuality('perfect'); window.GAME.forceCatchResult(true); });
  await expect(page.getByTestId('legendary-alert')).toBeVisible();
  await expect(page.getByTestId('shiny-alert')).toBeVisible();
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Shiny');

  await page.getByTestId('find-another-btn').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.getByTestId('dex-progress')).toContainText(`Tertangkap: 5 / ${n}`);
  await expect(page.getByTestId('dex-progress')).toContainText('Shiny: 1');
  await expect(page.getByTestId('dex-card-718')).toHaveClass(/shiny/);
  await expect(page.getByTestId('shiny-badge-718')).toBeVisible();
});
