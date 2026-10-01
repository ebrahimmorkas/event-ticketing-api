import { expect, type Page } from '@playwright/test';

export async function loginAsDemo(page: Page, account: 'Customer' | 'Organizer' | 'Admin') {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${account}`) }).click();
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
}

/** A title no other test run will have produced, so tests stay independent. */
export const uniqueTitle = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
