import { test, expect } from '@playwright/test';

test('Test Combobox Input Selection', async ({ page }) => {
  await page.goto('http://127.0.0.1:5501/scripts/output/test.html#examples/combobox-example?preview');

  await page.locator('iframe').contentFrame().getByRole('combobox', { name: 'Select...' }).click();

  await page.locator('iframe').contentFrame().getByRole('button', { name: 'Load more' }).click();

  // Wait for the new options to load
  await page.waitForTimeout(2000);
  await page.locator('iframe').contentFrame().getByRole('option', { name: 'User 7' }).locator('div').first().click();

  expect(await page.locator('iframe').contentFrame().getByRole('combobox').inputValue()).toBe('User 7');
});