const { test, expect } = require('@playwright/test');

test('catching a legendary fires confetti', async ({ page }) => {
  await page.goto('/?seed=2'); // NOT test mode → confetti lingers long enough to observe
  await page.evaluate(() => window.GAME.resetSave());
  await page.evaluate(() => { window.GAME.forceSpawn(718, false); window.GAME.forceThrowQuality('perfect'); window.GAME.forceCatchResult(true); });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
  await expect(page.locator('[data-testid="confetti"][data-active="1"]')).toBeVisible();
  await expect(page.locator('[data-testid="confetti"] .confetti-bit').first()).toBeVisible();
});
