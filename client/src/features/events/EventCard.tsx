import { MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { Event } from '@/lib/types';
import { EventCover } from './EventCover';

export function priceRange(event: Pick<Event, 'tiers'>) {
  if (event.tiers.length === 0) return 'No tickets yet';
  const prices = event.tiers.map((t) => t.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}

export const ticketsLeft = (event: Pick<Event, 'tiers'>) =>
  event.tiers.reduce((sum, t) => sum + t.available, 0);

export function EventCard({ event }: { event: Event }) {
  const left = ticketsLeft(event);
  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <EventCover id={event.id} startsAt={event.startsAt} className="h-36" />
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-semibold">
          <Link
            to={`/events/${event.id}`}
            className="after:absolute after:inset-0 group-hover:text-brand-600"
          >
            {event.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-500">{formatDateTime(event.startsAt)}</p>
        <p className="flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="size-4" aria-hidden /> {event.venue}, {event.city}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="font-semibold">{priceRange(event)}</span>
          {left === 0 ? (
            <Badge tone="danger">Sold out</Badge>
          ) : left <= 20 ? (
            <Badge tone="warning">{left} left</Badge>
          ) : null}
        </div>
      </div>
    </article>
  );
}
