const { test, expect } = require('@playwright/test');

test('catch chance scales with the ball; master always catches; still clamped', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => ({
    poke: PG.catch.chance('legendary', 'nice', 'poke'),
    great: PG.catch.chance('legendary', 'nice', 'great'),
    ultra: PG.catch.chance('legendary', 'nice', 'ultra'),
    master: PG.catch.chance('legendary', 'nice', 'master'),
    masterCommon: PG.catch.chance('common', 'nice', 'master'),
    ultraCommonPerfect: PG.catch.chance('common', 'perfect', 'ultra'),
    noBall: PG.catch.chance('common', 'nice'),
  }));
  expect(out.poke).toBeCloseTo(0.13, 5);
  expect(out.great).toBeCloseTo(0.195, 5);   // 0.13 * 1.5
  expect(out.ultra).toBeCloseTo(0.286, 5);   // 0.13 * 2.2
  expect(out.master).toBe(1.0);              // guaranteed, regardless of tier/quality
  expect(out.masterCommon).toBe(1.0);
  expect(out.ultraCommonPerfect).toBeCloseTo(0.98, 5); // clamped at the ceiling
  expect(out.noBall).toBeCloseTo(0.40, 5);   // omitting the ball == plain Poké Ball
  // A better ball is strictly easier.
  expect(out.great).toBeGreaterThan(out.poke);
  expect(out.ultra).toBeGreaterThan(out.great);
});

test('ball picker: four balls, poke selected by default, selection drives state + throw label', async ({ page }) => {
  await page.goto('/?test=1&seed=3');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(150, false)); // Mewtwo (legendary)
  await expect(page.locator('[data-testid^="ball-btn-"]')).toHaveCount(4);
  await expect(page.getByTestId('ball-btn-poke')).toHaveClass(/selected/);
  expect(await page.evaluate(() => window.GAME.getState().ball)).toBe('poke');
  await expect(page.getByTestId('throw-btn')).toHaveText('Lempar Poké Ball!');

  await page.getByTestId('ball-btn-ultra').click();
  await expect(page.getByTestId('ball-btn-ultra')).toHaveClass(/selected/);
  await expect(page.getByTestId('ball-btn-poke')).not.toHaveClass(/selected/);
  expect(await page.evaluate(() => window.GAME.getState().ball)).toBe('ultra');
  await expect(page.getByTestId('throw-btn')).toHaveText('Lempar Ultra Ball!');
});

test('master ball guarantees a catch even on the hardest tier (no forced result)', async ({ page }) => {
  await page.goto('/?test=1&seed=11');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(150, false)); // legendary Mewtwo
  await page.getByTestId('ball-btn-master').click();
  await page.evaluate(() => window.GAME.forceThrowQuality('nice')); // worst quality
  await page.getByTestId('throw-btn').click();
  await expect(page.getByTestId('result-msg')).toContainText('Mewtwo');
  await expect(page.getByTestId('find-another-btn')).toBeVisible();
  const st = await page.evaluate(() => window.GAME.getState());
  expect(st.caught).toContain(150);
});

test('each new encounter resets to the basic Poké Ball', async ({ page }) => {
  await page.goto('/?test=1&seed=9');
  await page.evaluate(() => window.GAME.resetSave());

  await page.evaluate(() => window.GAME.forceSpawn(25, false));
  await page.getByTestId('ball-btn-ultra').click();
  expect(await page.evaluate(() => window.GAME.getState().ball)).toBe('ultra');

  await page.evaluate(() => window.GAME.forceSpawn(1, false));
  await expect(page.getByTestId('ball-btn-poke')).toHaveClass(/selected/);
  expect(await page.evaluate(() => window.GAME.getState().ball)).toBe('poke');
});
