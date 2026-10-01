import { expect, test } from '@playwright/test';
import { loginAsDemo, uniqueTitle } from './helpers';

test.describe('organizer', () => {
  test('creates an event, publishes it and it appears publicly', async ({ page }) => {
    const title = uniqueTitle('Playwright Meetup');
    await loginAsDemo(page, 'Organizer');

    await page.goto('/organizer/events/new');
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Venue', { exact: true }).fill('Test Hall');
    await page.getByLabel('City', { exact: true }).fill('Goa');
    await page.getByLabel('Starts', { exact: true }).fill('2030-05-01T18:00');
    await page.getByLabel('Ends', { exact: true }).fill('2030-05-01T21:00');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Public page' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('General admission')).toBeVisible();
  });

  test('checks a ticket in exactly once', async ({ page, request }) => {
    // Buy a ticket through the API as the customer to get a fresh code.
    const login = await request.post('http://localhost:3000/api/v1/auth/login', {
      data: { email: 'customer@example.com', password: 'Password123!' },
    });
    const { accessToken } = await login.json();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const events = await (
      await request.get('http://localhost:3000/api/v1/events?q=Node.js')
    ).json();
    const event = events.data[0];
    const booking = await request.post('http://localhost:3000/api/v1/bookings', {
      headers,
      data: { eventId: event.id, items: [{ tierId: event.tiers[0].id, quantity: 1 }] },
    });
    const { booking: created } = await booking.json();
    await request.post(`http://localhost:3000/api/v1/bookings/${created.id}/pay`, {
      headers,
      data: { paymentMethod: 'pm_card_visa' },
    });
    const { tickets } = await (
      await request.get(`http://localhost:3000/api/v1/bookings/${created.id}/tickets`, { headers })
    ).json();
    const code: string = tickets[0].code;

    await loginAsDemo(page, 'Organizer');
    await page.goto('/organizer/check-in');
    const result = page.getByTestId('check-in-result');

    await page.getByLabel('Ticket code').fill(code);
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(result).toContainText('Admit');
    await expect(result).toContainText('Chris Customer');

    await page.getByLabel('Ticket code').fill(code);
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(result).toContainText('Already used');
  });
});
