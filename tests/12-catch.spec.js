const { test, expect } = require('@playwright/test');

test('forced catch adds to collection; miss keeps the Pokemon; shiny tracked separately', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.evaluate(() => window.GAME.resetSave());

  // Guaranteed catch of a normal Charmander
  await page.evaluate(() => { window.GAME.forceSpawn(4, false); window.GAME.forceCatchResult(true); window.GAME.forceThrowQuality('perfect'); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('quality-msg')).toHaveText('Sempurna!');
  await expect(page.getByTestId('result-msg')).toContainText('Charmander');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getState());
  expect(st.caught).toContain(4);
  expect(st.caughtShiny).not.toContain(4);

  // Forced miss: Pokemon stays, throw button still available
  await page.evaluate(() => { window.GAME.forceSpawn(1, false); window.GAME.forceCatchResult(false); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toHaveText('Yah, lolos! Coba lagi!');
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  await expect(page.getByTestId('find-another-btn')).toBeHidden();

  // Now catch a SHINY Eevee → recorded in both layers
  await page.evaluate(() => { window.GAME.forceSpawn(133, true); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Shiny');
  st = await page.evaluate(() => window.GAME.getState());
  expect(st.caught).toContain(133);
  expect(st.caughtShiny).toContain(133);
});
