const { test, expect } = require('@playwright/test');

test('sound: play never throws; mute toggles and persists', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(() => {
    PG.storage.clear();
    let threw = false;
    try { PG.sound.play('catch'); PG.sound.play('nope'); } catch (e) { threw = true; }
    const before = PG.sound.isMuted();
    const after = PG.sound.toggleMute();
    const persisted = PG.storage.load().muted;
    return { threw, before, after, persisted };
  });
  expect(out.threw).toBe(false);
  expect(out.after).toBe(!out.before);
  expect(out.persisted).toBe(out.after);
});
