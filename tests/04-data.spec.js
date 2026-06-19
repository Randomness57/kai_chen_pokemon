const { test, expect } = require('@playwright/test');

test('roster has 22 entries incl. Zygarde + Excadrill; strings format correctly', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => ({
    count: PG.data.ROSTER.length,
    ids: PG.data.ROSTER.map(p => p.id),
    zygardeWeight: PG.data.get(718).weight,
    excadrill: PG.data.get(530),
    shinyRate: PG.data.SHINY_RATE,
    caught: PG.data.t('caught', { name: 'Pikachu' }),
    progress: PG.data.t('progress', { x: 3, n: 22 }),
    quality: PG.data.qualityLabel('perfect'),
    normalPath: PG.data.spritePath(25, false),
    shinyPath: PG.data.spritePath(25, true),
  }));
  expect(out.count).toBe(22);
  expect(out.ids).toContain(718);
  expect(out.ids).toContain(530);
  expect(out.zygardeWeight).toBe(20);
  expect(out.excadrill).toMatchObject({ id: 530, name: 'Excadrill', tier: 'rare' });
  expect(out.shinyRate).toBeCloseTo(1 / 12, 5);
  expect(out.caught).toBe('Hore! Pikachu berhasil ditangkap! 🎉');
  expect(out.progress).toBe('Tertangkap: 3 / 22');
  expect(out.quality).toBe('Sempurna!');
  expect(out.normalPath).toBe('images/25.png');
  expect(out.shinyPath).toBe('images/shiny/25.png');
});
