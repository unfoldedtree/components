import { test, expect } from '@playwright/test';

test('Test Button Event', async ({ page }) => {
  await page.goto('http://127.0.0.1:5501/scripts/output/test.html#examples/button-example?preview');

  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    expect(dialog.message()).toBe('Stonks Event');
    dialog.accept();
  });
  await page.locator('iframe').contentFrame().locator('div').filter({ hasText: 'Primary Buttons Extra Small' }).getByRole('button').first().click();
});