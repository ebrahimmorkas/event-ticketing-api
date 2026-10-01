import { Plus, ScanLine } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { Event } from '@/lib/types';
import { useMyEvents } from './api';
import { EventStatusBadge } from './EventStatusBadge';

function capacityOf(event: Event) {
  const capacity = event.tiers.reduce((sum, t) => sum + t.capacity, 0);
  const taken = event.tiers.reduce((sum, t) => sum + (t.capacity - t.available), 0);
  return { capacity, taken };
}

export function OrganizerDashboardPage() {
  const { data: events, isPending, isError, error, refetch } = useMyEvents();

  const now = new Date();
  const upcoming = events?.filter((e) => new Date(e.startsAt) > now && e.status === 'PUBLISHED');
  const drafts = events?.filter((e) => e.status === 'DRAFT').length ?? 0;
  const ticketsTaken = events?.reduce((sum, e) => sum + capacityOf(e).taken, 0) ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your events</h1>
          <p className="mt-1 text-slate-500">Create events, track sales and check guests in.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/organizer/check-in" className={buttonVariants({ variant: 'secondary' })}>
            <ScanLine aria-hidden /> Check-in
          </Link>
          <Link to="/organizer/events/new" className={buttonVariants()}>
            <Plus aria-hidden /> New event
          </Link>
        </div>
      </header>

      {events && (
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Upcoming events', value: upcoming?.length ?? 0 },
            { label: 'Drafts', value: drafts },
            { label: 'Tickets reserved or sold', value: ticketsTaken },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent>
                <dt className="text-sm text-slate-500">{stat.label}</dt>
                <dd className="mt-1 text-3xl font-bold">{stat.value}</dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      )}

      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create your first event, add ticket tiers and publish it to start selling."
          action={
            <Link to="/organizer/events/new" className={buttonVariants()}>
              Create event
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Your events</caption>
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 text-right font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {events.map((event) => {
                const { capacity, taken } = capacityOf(event);
                const pct = capacity ? Math.round((taken / capacity) * 100) : 0;
                return (
                  <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/organizer/events/${event.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {event.title}
                      </Link>
                      <p className="text-slate-500">
                        {formatDateTime(event.startsAt)} · {event.city}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <EventStatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${event.title} sales`}
                        >
                          <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-500 tabular-nums">
                          {taken}/{capacity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {event.tiers.length
                        ? formatPrice(Math.min(...event.tiers.map((t) => t.priceCents)))
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
