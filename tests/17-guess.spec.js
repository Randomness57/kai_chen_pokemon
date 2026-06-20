const { test, expect } = require('@playwright/test');

test('guess mode: type the name, forgiving match, retry, give-up, score + best persists', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  // Enter from the title.
  await page.getByTestId('guess-mode-btn').click();
  await expect(page.locator('[data-screen="guess"]')).toHaveClass(/active/);
  await expect(page.getByTestId('guess-prompt')).toHaveText('Pokémon apa ini? Ketik namanya!');

  // Deterministic round: Pikachu(25). Starts as a silhouette with a text input.
  await page.evaluate(() => window.GAME.forceGuessRound(25));
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-sprite')).toHaveAttribute('src', 'images/25.png');
  await expect(page.getByTestId('guess-input')).toBeVisible();

  // Wrong guess: stays a silhouette, not answered, retry allowed.
  await page.getByTestId('guess-input').fill('charizard');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-result')).toHaveText('Belum benar, coba lagi! 🤔');
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  expect(await page.evaluate(() => window.GAME.getGuessState().answered)).toBe(false);

  // Correct guess (case-insensitive): reveal + score/streak update.
  await page.getByTestId('guess-input').fill('PIKACHU');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Pikachu! 🎉');
  await expect(page.getByTestId('guess-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Forgiving match: "mr mime" should solve Mr. Mime(122).
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(122));
  await page.getByTestId('guess-input').fill('mr mime');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Mr. Mime! 🎉');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 2, best: 2 });

  // Give up: reveals the answer, resets streak, score unchanged.
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(94)); // Gengar
  await page.getByTestId('guess-giveup-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Yah! Ini Gengar.');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 0, best: 2 });

  // Best streak persists across reload.
  await page.reload();
  expect(await page.evaluate(() => window.GAME.getGuessState().best)).toBe(2);
});

test('guess logic: round picks a real target; isCorrect is forgiving', async ({ page }) => {
  await page.goto('/?test=1&seed=42');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(42);
    let allReal = true;
    for (let i = 0; i < 200; i++) {
      const r = PG.guess.round(rng);
      if (!r.target || !PG.data.get(r.target.id)) allReal = false;
    }
    return {
      allReal,
      hooh: PG.guess.isCorrect('ho oh', 'Ho-Oh'),
      farfetchd: PG.guess.isCorrect('farfetchd', "Farfetch'd"),
      accent: PG.guess.isCorrect('pokemon', 'Pokémon'),
      empty: PG.guess.isCorrect('', 'Pikachu'),
      wrong: PG.guess.isCorrect('squirtle', 'Pikachu'),
    };
  });
  expect(out.allReal).toBe(true);
  expect(out.hooh).toBe(true);
  expect(out.farfetchd).toBe(true);
  expect(out.accent).toBe(true);
  expect(out.empty).toBe(false);
  expect(out.wrong).toBe(false);
});
