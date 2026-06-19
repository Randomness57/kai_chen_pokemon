const { test, expect } = require('@playwright/test');

test('pokedex renders 22 cards with caught/uncaught/shiny states + progress', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const grid = document.createElement('div'); grid.id = 'tg';
    const prog = document.createElement('div'); prog.id = 'tp';
    document.body.append(grid, prog);
    const state = { caught: new Set([25, 718]), caughtShiny: new Set([718]) };
    PG.pokedex.render(grid, prog, state);
  });
  await expect(page.locator('#tg [data-testid^="dex-card-"]')).toHaveCount(22);
  await expect(page.locator('#tg [data-testid="dex-card-25"]')).toHaveClass(/caught/);
  await expect(page.locator('#tg [data-testid="dex-card-1"]')).toHaveClass(/uncaught/);
  await expect(page.locator('#tg [data-testid="dex-card-718"]')).toHaveClass(/shiny/);
  await expect(page.locator('#tg [data-testid="shiny-badge-718"]')).toBeVisible();
  await expect(page.locator('#tp')).toHaveText('Tertangkap: 2 / 22  ·  Shiny: 1');
});
