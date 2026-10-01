import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/Pagination';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMyBookings } from './api';
import { BookingStatusBadge } from './BookingStatusBadge';

const TABS: { value?: BookingStatus; label: string }[] = [
  { label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PENDING', label: 'Awaiting payment' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as BookingStatus | null) ?? undefined;
  const page = Number(params.get('page') ?? 1);
  const { data, isPending, isError, error, refetch } = useMyBookings(status, page);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My bookings</h1>

      <div role="tablist" aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <button
              key={tab.label}
              role="tab"
              aria-selected={active}
              onClick={() => setParams(tab.value ? { status: tab.value } : {})}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap',
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="When you reserve tickets they will show up here."
          action={
            <Link to="/events" className={buttonVariants()}>
              Find events
            </Link>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {data.data.map((booking) => {
              const tickets = booking.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <li key={booking.id}>
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{booking.event.title}</p>
                      <p className="text-sm text-slate-500">
                        {formatDateTime(booking.event.startsAt)} · {tickets} ticket
                        {tickets === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-semibold">{formatMoney(booking.totalCents)}</p>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                    <ChevronRight className="size-5 text-slate-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination
            meta={data.meta}
            onPage={(p) => setParams({ ...(status && { status }), page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
