const { test, expect } = require('@playwright/test');

async function type(page, str) {
  for (const ch of str) await page.keyboard.press(ch);
}

test('typing tutor: real keyboard types the name, next key pulses, hands colored, auto-skip punctuation', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  await page.getByTestId('guess-mode-btn').click();
  await expect(page.locator('[data-screen="guess"]')).toHaveClass(/active/);
  await expect(page.getByTestId('guess-prompt')).toHaveText('Siapa Pokémon ini? Ketik namanya!');

  // Deterministic round: Gengar(94). Silhouette stays (recognising is the fun part).
  await page.evaluate(() => window.GAME.forceGuessRound(94));
  await expect(page.getByTestId('guess-sprite')).toHaveClass(/silhouette/);

  // The on-screen board is a QWERTY GUIDE: 36 keys, hand-colored, next key pulses.
  await expect(page.locator('[data-testid^="key-"]')).toHaveCount(36); // 26 letters + 10 digits
  await expect(page.getByTestId('key-g')).toHaveClass(/hand-left/);   // G = left hand
  await expect(page.getByTestId('key-l')).toHaveClass(/hand-right/);  // L = right hand
  await expect(page.getByTestId('key-g')).toHaveClass(/next/);        // Gengar -> next is G

  // Tapping the on-screen guide does NOTHING — he must use the real keyboard.
  // (pointer-events:none makes it inert; force the click past actionability.)
  await page.getByTestId('key-g').click({ force: true });
  await expect(page.getByTestId('guess-typed')).toHaveClass(/empty/);
  expect(await page.evaluate(() => window.GAME.getGuessState().pos)).toBe(0);

  // Pressing the real key advances; the highlight moves to the next letter.
  await page.keyboard.press('g');
  await expect(page.getByTestId('guess-typed')).toHaveText('G_');
  await expect(page.getByTestId('key-g')).not.toHaveClass(/next/);
  await expect(page.getByTestId('key-e')).toHaveClass(/next/);

  // A wrong key is ignored — he can't get stuck on a bad path.
  await page.keyboard.press('z');
  await expect(page.getByTestId('guess-typed')).toHaveText('G_');
  expect(await page.evaluate(() => window.GAME.getGuessState().pos)).toBe(1);

  // Finish the word: completing it auto-wins (no submit button).
  await type(page, 'engar');
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Gengar! 🎉');
  await expect(page.getByTestId('guess-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Punctuation/space auto-fill: Mr. Mime(122) is solved by typing only letters.
  await page.keyboard.press('Enter'); // Enter advances to next round once solved
  await page.evaluate(() => window.GAME.forceGuessRound(122));
  await expect(page.getByTestId('key-m')).toHaveClass(/next/);
  await type(page, 'mr');             // after "Mr", the ". " auto-fills
  await expect(page.getByTestId('guess-typed')).toHaveText('MR. _');
  await type(page, 'mime');
  await expect(page.getByTestId('guess-result')).toHaveText('Benar! Ini Mr. Mime! 🎉');
  st = await page.evaluate(() => window.GAME.getGuessState());
  expect(st).toMatchObject({ score: 2, streak: 2, best: 2 });

  // Skip reveals the answer and breaks the streak (score unchanged).
  await page.getByTestId('guess-next-btn').click();
  await page.evaluate(() => window.GAME.forceGuessRound(25)); // Pikachu
  await page.getByTestId('guess-skip-btn').click();
  await expect(page.getByTestId('guess-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('guess-result')).toHaveText('Yah! Ini Pikachu.');
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
    };
  });
  expect(out.allReal).toBe(true);
  expect(out.hooh).toBe(true);
  expect(out.farfetchd).toBe(true);
});
