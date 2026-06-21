const { test, expect } = require('@playwright/test');

async function missOnce(page) {
  await page.evaluate(() => window.GAME.forceCatchResult(false));
  await page.getByTestId('throw-btn').click();
}

test('a wild Pokémon flees after 4 misses', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.evaluate(() => window.GAME.resetSave());
  await page.evaluate(() => window.GAME.forceSpawn(1, false)); // Bulbasaur
  expect(await page.evaluate(() => window.GAME.getState().maxMisses)).toBe(4);

  // Misses 1–2: still here, keep throwing.
  await missOnce(page);
  await expect(page.getByTestId('result-msg')).toHaveText('Yah, lolos! Coba lagi!');
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  expect(await page.evaluate(() => window.GAME.getState().misses)).toBe(1);

  await missOnce(page);
  expect(await page.evaluate(() => window.GAME.getState().misses)).toBe(2);

  // Miss 3: a final warning before it bolts, but a throw is still allowed.
  await missOnce(page);
  await expect(page.getByTestId('hint-msg')).toHaveText('💨 Cepat! Dia mau kabur!');
  await expect(page.getByTestId('throw-btn')).toBeEnabled();
  expect(await page.evaluate(() => window.GAME.getState().misses)).toBe(3);

  // Miss 4: it runs away — no more throws, and it isn't added to the Pokédex.
  await missOnce(page);
  await expect(page.getByTestId('result-msg')).toHaveText('Bulbasaur kabur! 🏃💨');
  await expect(page.getByTestId('wild-sprite')).toHaveClass(/flee/);
  await expect(page.getByTestId('throw-btn')).toBeHidden();
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  const st = await page.evaluate(() => window.GAME.getState());
  expect(st.current).toBeNull();
  expect(st.caught).not.toContain(1);

  // A fresh encounter resets the miss counter and clears the flee animation.
  await page.getByTestId('find-another-btn').click();
  await page.evaluate(() => window.GAME.forceSpawn(4, false));
  expect(await page.evaluate(() => window.GAME.getState().misses)).toBe(0);
  await expect(page.getByTestId('wild-sprite')).not.toHaveClass(/flee/);
  await expect(page.getByTestId('throw-btn')).toBeVisible();
});

test('catching before the 4th miss prevents the flee', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.evaluate(() => window.GAME.resetSave());
  await page.evaluate(() => window.GAME.forceSpawn(25, false)); // Pikachu

  await missOnce(page);
  await missOnce(page);
  await missOnce(page);
  expect(await page.evaluate(() => window.GAME.getState().misses)).toBe(3);

  // The 4th throw lands — caught, not fled.
  await page.evaluate(() => window.GAME.forceCatchResult(true));
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Pikachu');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  expect((await page.evaluate(() => window.GAME.getState())).caught).toContain(25);
});
