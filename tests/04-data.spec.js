const { test, expect } = require('@playwright/test');

test('roster has 188 entries incl. Zygarde + Excadrill + hard mons; strings format correctly', async ({ page }) => {
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
    mimikyuShape: PG.data.shapeOf(778),
    everyRosterHasShape: PG.data.ROSTER.every(p => PG.data.shapeOf(p.id) !== 'unknown'),
  }));
  expect(out.count).toBe(188);
  expect(out.ids).toContain(718);
  expect(out.ids).toContain(530);
  expect(out.ids).toContain(778); // Mimikyu (hard)
  expect(out.ids).toContain(888); // Zacian (hard)
  expect(out.ids).toContain(1000); // Gholdengo (gen 9, hard)
  expect(out.mimikyuShape).toBe('squiggle');
  expect(out.everyRosterHasShape).toBe(true);
  expect(out.zygardeWeight).toBe(20);
  expect(out.excadrill).toMatchObject({ id: 530, name: 'Excadrill', tier: 'rare' });
  expect(out.shinyRate).toBeCloseTo(1 / 12, 5);
  expect(out.caught).toBe('Hore! Pikachu berhasil ditangkap! 🎉');
  expect(out.progress).toBe('Tertangkap: 3 / 22');
  expect(out.quality).toBe('Sempurna!');
  expect(out.normalPath).toBe('images/25.png');
  expect(out.shinyPath).toBe('images/shiny/25.png');
});
