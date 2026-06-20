const { test, expect } = require('@playwright/test');

test('poke-ball visible during encounter, hidden elsewhere', async ({ page }) => {
  await page.goto('/?test=1');

  // Title screen — no ball
  await expect(page.getByTestId('poke-ball')).not.toBeVisible();

  // Enter a real encounter
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(25, false));
  await expect(page.getByTestId('encounter-area')).toBeVisible();
  await expect(page.getByTestId('poke-ball')).toBeVisible();

  // After catching, navigate to find screen — ball not visible
  await page.evaluate(() => window.GAME.forceCatchResult(true));
  await page.getByTestId('throw-btn').click();
  await page.getByTestId('find-another-btn').click();
  await expect(page.getByTestId('poke-ball')).not.toBeVisible();
});

test('flick on poke-ball triggers throw and resolves', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => {
    window.GAME.forceSpawn(25, false);
    window.GAME.forceCatchResult(true);
  });

  const ball = page.getByTestId('poke-ball');
  const box = await ball.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 80, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByTestId('result-msg')).toContainText('Pikachu');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
});

test('tiny drag (no flick) does not throw', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(25, false));

  const ball = page.getByTestId('poke-ball');
  const box = await ball.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move upward only 8px — below the 24px threshold
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 8, { steps: 2 });
  await page.mouse.up();

  // throw-btn should still be enabled (no throw happened)
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  await expect(page.getByTestId('result-msg')).toHaveText('');
});

test('button still works as reliable fallback (regression)', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByTestId('play-btn').click();
  await page.evaluate(() => {
    window.GAME.forceSpawn(718, false);
    window.GAME.forceThrowQuality('perfect');
    window.GAME.forceCatchResult(true);
  });
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Zygarde');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
});
