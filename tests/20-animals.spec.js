const { test, expect } = require('@playwright/test');

async function type(page, str) {
  for (const ch of str) await page.keyboard.press(ch);
}

test('animal typing tutor: real keyboard types the name, next key pulses, auto-skip punctuation', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => window.GAME.resetSave());

  await page.getByTestId('animal-mode-btn').click();
  await expect(page.locator('[data-screen="animals"]')).toHaveClass(/active/);
  await expect(page.getByTestId('animal-prompt')).toHaveText('Hewan apa ini? Ketik namanya!');

  // Deterministic round: Gajah (id 1). The silhouette stays until solved.
  await page.evaluate(() => window.GAME.forceAnimalRound(1));
  await expect(page.getByTestId('animal-sprite')).toHaveClass(/silhouette/);
  await expect(page.getByTestId('animal-sprite')).toHaveText('🐘');

  // The on-screen board is a QWERTY GUIDE: 36 keys, next key pulses.
  await expect(page.locator('[data-testid^="akey-"]')).toHaveCount(36); // 26 letters + 10 digits
  await expect(page.getByTestId('akey-g')).toHaveClass(/next/);

  // Tapping the guide does nothing — he must use the real keyboard.
  await page.getByTestId('akey-g').click({ force: true });
  expect(await page.evaluate(() => window.GAME.getAnimalState().pos)).toBe(0);

  await page.keyboard.press('g');
  await expect(page.getByTestId('animal-typed')).toHaveText('G_');
  await expect(page.getByTestId('akey-g')).not.toHaveClass(/next/);
  await expect(page.getByTestId('akey-a')).toHaveClass(/next/);

  // A wrong key is ignored — he can't get stuck.
  await page.keyboard.press('z');
  expect(await page.evaluate(() => window.GAME.getAnimalState().pos)).toBe(1);

  await type(page, 'ajah');
  await expect(page.getByTestId('animal-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('animal-result')).toHaveText('Benar! Ini Gajah! 🎉');
  await expect(page.getByTestId('animal-next-btn')).toBeVisible();
  let st = await page.evaluate(() => window.GAME.getAnimalState());
  expect(st).toMatchObject({ score: 1, streak: 1, best: 1 });

  // Punctuation auto-fills: Kura-kura (id 6) is solved by typing only letters.
  await page.keyboard.press('Enter'); // Enter advances once solved
  await page.evaluate(() => window.GAME.forceAnimalRound(6));
  await expect(page.getByTestId('akey-k')).toHaveClass(/next/);
  await type(page, 'kura');           // after "Kura", the "-" auto-fills
  await expect(page.getByTestId('animal-typed')).toHaveText('KURA-_');
  await type(page, 'kura');
  await expect(page.getByTestId('animal-result')).toHaveText('Benar! Ini Kura-kura! 🎉');
  st = await page.evaluate(() => window.GAME.getAnimalState());
  expect(st).toMatchObject({ score: 2, streak: 2, best: 2 });

  // Skip reveals the answer and breaks the streak (score unchanged).
  await page.getByTestId('animal-next-btn').click();
  await page.evaluate(() => window.GAME.forceAnimalRound(2)); // Jerapah
  await page.getByTestId('animal-skip-btn').click();
  await expect(page.getByTestId('animal-sprite')).not.toHaveClass(/silhouette/);
  await expect(page.getByTestId('animal-result')).toHaveText('Yah! Ini Jerapah.');
  st = await page.evaluate(() => window.GAME.getAnimalState());
  expect(st).toMatchObject({ score: 2, streak: 0, best: 2 });

  // Best streak persists across reload.
  await page.reload();
  expect(await page.evaluate(() => window.GAME.getAnimalState().best)).toBe(2);
});

test('animal logic: round picks a real target; isCorrect is forgiving', async ({ page }) => {
  await page.goto('/?test=1&seed=42');
  const out = await page.evaluate(() => {
    const rng = PG.rng.create(42);
    let allReal = true;
    for (let i = 0; i < 200; i++) {
      const r = PG.animals.round(rng);
      if (!r.target || !PG.animals.get(r.target.id)) allReal = false;
    }
    return {
      allReal,
      kura: PG.animals.isCorrect('kura kura', 'Kura-kura'),
      owl: PG.animals.isCorrect('burunghantu', 'Burung hantu'),
      empty: PG.animals.isCorrect('', 'Gajah'),
    };
  });
  expect(out.allReal).toBe(true);
  expect(out.kura).toBe(true);
  expect(out.owl).toBe(true);
  expect(out.empty).toBe(false);
});
