const { test, expect } = require('@playwright/test');

test('encounter shows sprite/name; Zygarde triggers legendary alert; forceShiny shows shiny art + banner', async ({ page }) => {
  await page.goto('/?test=1&seed=3');

  await page.evaluate(() => window.GAME.forceSpawn(718, false)); // Zygarde, normal
  await expect(page.getByTestId('wild-name')).toHaveText('Zygarde');
  await expect(page.getByTestId('legendary-alert')).toBeVisible();
  await expect(page.getByTestId('shiny-alert')).toBeHidden();
  await expect(page.getByTestId('wild-sprite')).toHaveAttribute('src', 'images/718.png');

  await page.evaluate(() => window.GAME.forceSpawn(25, true)); // shiny Pikachu
  await expect(page.getByTestId('wild-name')).toHaveText('Pikachu');
  await expect(page.getByTestId('shiny-alert')).toBeVisible();
  await expect(page.getByTestId('legendary-alert')).toBeHidden();
  await expect(page.getByTestId('wild-sprite')).toHaveAttribute('src', 'images/shiny/25.png');

  // find-btn path also produces a valid encounter
  await page.getByTestId('back-btn').click();
  await page.getByTestId('play-btn').click();
  await page.getByTestId('find-btn').click();
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  const st = await page.evaluate(() => window.GAME.getState());
  expect(st.current).not.toBeNull();
});
