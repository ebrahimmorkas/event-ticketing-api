import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PER_TIER, TicketSelector } from './TicketSelector';

const tiers = [
  { id: 'ga', name: 'General', priceCents: 2500, capacity: 100, available: 3 },
  { id: 'vip', name: 'VIP', priceCents: 9900, capacity: 10, available: 0 },
  { id: 'big', name: 'Group', priceCents: 1000, capacity: 500, available: 500 },
];

describe('TicketSelector', () => {
  it('shows price and availability, and marks sold-out tiers', () => {
    render(<TicketSelector tiers={tiers} quantities={{}} onChange={() => {}} />);

    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText('3 available', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one VIP ticket' })).toBeDisabled();
  });

  it('caps quantity at the seats available', async () => {
    const onChange = vi.fn();
    render(<TicketSelector tiers={tiers} quantities={{ ga: 3 }} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Add one General ticket' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove one General ticket' }));
    expect(onChange).toHaveBeenCalledWith('ga', 2);
  });

  it('caps quantity at the per-booking limit', () => {
    render(<TicketSelector tiers={tiers} quantities={{ big: MAX_PER_TIER }} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add one Group ticket' })).toBeDisabled();
  });
});
