const { test, expect } = require('@playwright/test');

test('guess mode: silhouette round, correct/wrong reveal, score + streak, best persists', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  // Enter from the title.
  await page.getByTestId('guess-mode-btn').click();
  await expect(page.locator('[data-screen="guess"]')).toHaveClass(/active/);
  await expect(page.getByTestId('guess-prompt')).toHaveText('Siapa Pokémon ini?');

  // A deterministic round: Pikachu(25) is the answer, 4 options.
  await page.evaluate(() => window.GAME.forceGuessRound(25, [25, 1, 4, 7]));
  await expect(page.locator('[data-testid^="guess-option-"]')).toHaveCount(4);
  // Sprite starts as a silhouette.
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-sprite')).toHaveAttribute('src', 'images/25.png');

  // Correct answer.
  await page.getByTestId('guess-option-25').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-option-25')).toHaveClass(/correct/);
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Pikachu! 🎉');
  await expect(page.getByTestId('guess-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Next round, then a wrong answer resets the streak (score stays).
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(1, [1, 25, 4, 7]));
  await page.getByTestId('guess-option-25').click(); // wrong (answer is Bulbasaur=1)
  await expect(page.getByTestId('guess-option-25')).toHaveClass(/wrong/);
  await expect(page.getByTestId('guess-option-1')).toHaveClass(/correct/); // correct still highlighted
  await expect(page.getByTestId('guess-result')).toHaveText('Yah! Ini Bulbasaur.');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 0, best: 1 });

  // Best streak persists across reload.
  await page.reload();
  const best = await page.evaluate(() => window.GAME.getGuessState().best);
  expect(best).toBe(1);
});

test('guess.round picks a valid target with distinct options', async ({ page }) => {
  await page.goto('/?test=1&seed=42');
  const ok = await page.evaluate(() => {
    const rng = PG.rng.create(42);
    for (let i = 0; i < 50; i++) {
      const r = PG.guess.round(rng);
      const ids = r.options.map(o => o.id);
      if (r.options.length !== 4) return false;
      if (new Set(ids).size !== 4) return false;          // all distinct
      if (!ids.includes(r.target.id)) return false;        // target is present
      if (!PG.data.get(r.target.id)) return false;         // real Pokémon
    }
    return true;
  });
  expect(ok).toBe(true);
});
