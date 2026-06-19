const { test, expect } = require('@playwright/test');

test('boots with no console errors and shows the title', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByTestId('title')).toHaveText('Tangkap Pokémon!');
  expect(errors).toEqual([]);
});
