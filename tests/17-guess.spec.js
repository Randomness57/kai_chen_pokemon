const { test, expect } = require('@playwright/test');

async function tap(page, str) {
  for (const ch of str) await page.getByTestId('key-' + ch).click();
}

test('guess mode: tap keyboard to spell the name, retry, backspace, skip, best persists', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  // Enter from the title.
  await page.getByTestId('guess-mode-btn').click();
  await expect(page.locator('[data-screen="guess"]')).toHaveClass(/active/);
  await expect(page.getByTestId('guess-prompt')).toHaveText('Siapa Pokémon ini?');

  // Deterministic round: Pikachu(25). Silhouette + on-screen keyboard, name hidden.
  await page.evaluate(() => window.GAME.forceGuessRound(25));
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-sprite')).toHaveAttribute('src', 'images/25.png');
  await expect(page.getByTestId('type-keyboard')).toBeVisible();
  await expect(page.locator('[data-testid^="key-"]')).toHaveCount(37); // 26 letters + 10 digits + backspace

  // Tap an incomplete guess "PIKA": the typed display reflects taps.
  await tap(page, 'pika');
  await expect(page.getByTestId('guess-typed')).toHaveText('PIKA');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-result')).toHaveText('Belum benar, coba lagi! 🤔');
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);
  expect(await page.evaluate(() => window.GAME.getGuessState().answered)).toBe(false);

  // Finish the word and submit: reveal + score/streak update.
  await tap(page, 'chu');
  await expect(page.getByTestId('guess-typed')).toHaveText('PIKACHU');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Pikachu! 🎉');
  await expect(page.getByTestId('guess-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Backspace + forgiving punctuation: spell Mr. Mime(122) as "mrmime".
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(122));
  await tap(page, 'mrz');                       // typo
  await page.getByTestId('key-backspace').click(); // erase the 'z'
  await expect(page.getByTestId('guess-typed')).toHaveText('MR');
  await tap(page, 'mime');
  await page.getByTestId('guess-submit-btn').click();
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Mr. Mime! 🎉');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 2, best: 2 });

  // Skip: reveals the answer, resets streak, score unchanged.
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(94)); // Gengar
  await page.getByTestId('guess-skip-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Yah! Ini Gengar.');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 0, best: 2 });

  // Best streak persists across reload.
  await page.reload();
  expect(await page.evaluate(() => window.GAME.getGuessState().best)).toBe(2);
});

test('guess mode: physical keyboard also works (type + Enter)', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());
  await page.getByTestId('guess-mode-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(94)); // Gengar
  await page.keyboard.type('gengar');
  await expect(page.getByTestId('guess-typed')).toHaveText('GENGAR');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Gengar! 🎉');
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
