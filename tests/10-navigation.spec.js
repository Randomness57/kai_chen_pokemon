const { test, expect } = require('@playwright/test');

test('navigation between title, game, and pokedex; mute toggles', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => window.GAME.resetSave());
  await expect(page.locator('[data-screen="title"]')).toHaveClass(/active/);

  await page.getByTestId('play-btn').click();
  await expect(page.locator('[data-screen="game"]')).toHaveClass(/active/);
  await expect(page.getByTestId('find-btn')).toBeVisible();

  await page.getByTestId('back-btn').click();
  await expect(page.locator('[data-screen="title"]')).toHaveClass(/active/);

  await page.getByTestId('open-pokedex-btn').click();
  await expect(page.locator('[data-screen="pokedex"]')).toHaveClass(/active/);
  await expect(page.locator('[data-testid^="dex-card-"]')).toHaveCount(22);

  await page.getByTestId('dex-back-btn').click();
  const muteBefore = await page.getByTestId('mute-btn').textContent();
  await page.getByTestId('mute-btn').click();
  const muteAfter = await page.getByTestId('mute-btn').textContent();
  expect(muteAfter).not.toBe(muteBefore);
});
