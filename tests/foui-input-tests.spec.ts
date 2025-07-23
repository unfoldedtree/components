import { test, expect } from '@playwright/test';

test('Test Input Error Message', async ({ page }) => {
  await page.goto('http://127.0.0.1:5501/scripts/output/test.html#examples/input-example?preview');

  await page.locator('iframe').contentFrame().getByRole('textbox', { name: 'Enter an email' }).click();
  await page.locator('iframe').contentFrame().getByRole('textbox', { name: 'Enter an email' }).fill('test');

  expect(await page.locator('iframe').contentFrame().getByText('Not a valid email address.').isVisible()).toBeTruthy();

  await page.locator('iframe').contentFrame().getByRole('textbox', { name: 'Enter an email' }).click();
  await page.locator('iframe').contentFrame().getByRole('textbox', { name: 'Enter an email' }).fill('test@gmail.com');

  expect(await page.locator('iframe').contentFrame().getByText('Not a valid email address.').isVisible()).toBeFalsy();
});

test('Test Input Model Binding', async ({ page }) => {
  await page.goto('http://127.0.0.1:5501/scripts/output/test.html#examples/input-example?preview');

  expect(await page.locator('iframe').contentFrame().locator('.p-2.flex.gap-2.flex-col > div > div > .mt-2 > #Input').first().inputValue() === 'This is a test');

  await page.locator('iframe').contentFrame().locator('.p-2.flex.gap-2.flex-col > div > div > .mt-2 > #Input').first().click();
  await page.locator('iframe').contentFrame().locator('.p-2.flex.gap-2.flex-col > div > div > .mt-2 > #Input').first().fill('This is a');

  expect(await page.locator('iframe').contentFrame().locator('.p-2.flex.gap-2.flex-col > div > div > .mt-2 > #Input').first().inputValue() === 'This is a');

  await page.locator('iframe').contentFrame().getByRole('textbox').filter({ hasText: 'This is a' }).click();
  await page.locator('iframe').contentFrame().getByRole('textbox').filter({ hasText: 'This is a' }).fill('New Value');

  expect(await page.locator('iframe').contentFrame().locator('.p-2.flex.gap-2.flex-col > div > div > .mt-2 > #Input').first().inputValue() === 'New Value');
});