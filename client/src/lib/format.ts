import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatMoney = (cents: number) => currency.format(cents / 100);

/** For ticket prices, where zero means a free event rather than an amount. */
export const formatPrice = (cents: number) => (cents === 0 ? 'Free' : formatMoney(cents));

export const formatDate = (iso: string) => format(new Date(iso), 'EEE, d MMM yyyy');

export const formatDateTime = (iso: string) => format(new Date(iso), "EEE, d MMM yyyy 'at' h:mm a");

export function formatEventWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return isSameDay(start, end)
    ? `${format(start, 'EEE, d MMM yyyy · h:mm a')} – ${format(end, 'h:mm a')}`
    : `${format(start, 'd MMM, h:mm a')} – ${format(end, 'd MMM yyyy, h:mm a')}`;
}

export const fromNow = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

/** Value for an `<input type="datetime-local">` in the browser's timezone. */
export const toDateTimeLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;
