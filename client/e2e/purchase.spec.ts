import { expect, test } from '@playwright/test';
import { loginAsDemo } from './helpers';

test.describe('buying tickets', () => {
  test('a customer reserves, pays and receives QR tickets', async ({ page }) => {
    await loginAsDemo(page, 'Customer');

    await page.goto('/events');
    await page.getByLabel('Search events').fill('Indie');
    await page.getByRole('link', { name: 'Indie Music Night' }).click();

    await page.getByRole('button', { name: 'Add one Standing ticket' }).click();
    await page.getByRole('button', { name: 'Add one Standing ticket' }).click();
    await expect(page.getByText('2 tickets')).toBeVisible();
    await page.getByRole('button', { name: 'Reserve tickets' }).click();

    await expect(page.getByText('Complete your purchase')).toBeVisible();
    await expect(page.getByText(/your tickets are held for/i)).toBeVisible();
    await page.getByRole('button', { name: /^Pay / }).click();

    await expect(page.getByText('Confirmed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your tickets (2)' })).toBeVisible();
    await expect(page.getByRole('img', { name: /QR code for ticket TKT-/ })).toHaveCount(2);
  });

  test('a declined card shows the gateway error and keeps the hold', async ({ page }) => {
    await loginAsDemo(page, 'Customer');
    await page.goto('/events?q=Jazz');
    await page.getByRole('link', { name: 'Jazz by the Lake' }).click();
    await page.getByRole('button', { name: 'Add one Lawn ticket' }).click();
    await page.getByRole('button', { name: 'Reserve tickets' }).click();

    await page.getByLabel(/0002/).check();
    await page.getByRole('button', { name: /^Pay / }).click();

    await expect(page.getByRole('alert')).toContainText('Card was declined');
    await expect(page.getByText('Awaiting payment')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  });

  test('anonymous visitors are sent to log in before booking', async ({ page }) => {
    await page.goto('/events');
    await page.getByRole('link', { name: 'Node.js Conf 2026' }).click();
    await page.getByRole('button', { name: 'Add one General ticket' }).click();
    await page.getByRole('button', { name: 'Log in to book' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
