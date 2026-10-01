import { CalendarDays, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, ErrorState, Spinner } from '@/components/ui/feedback';
import { useAuth } from '@/features/auth/auth-context';
import { useReserve } from '@/features/bookings/api';
import { ApiError, errorMessage } from '@/lib/api';
import { formatEventWhen, formatMoney } from '@/lib/format';
import { useEvent } from './api';
import { EventCover } from './EventCover';
import { TicketSelector } from './TicketSelector';

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { data: event, isPending, isError, error, refetch } = useEvent(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reserve = useReserve();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // One key per checkout attempt: retries reuse it, a changed selection gets a new one.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const selected = useMemo(
    () => Object.entries(quantities).filter(([, quantity]) => quantity > 0),
    [quantities],
  );
  const totalCents = useMemo(
    () =>
      selected.reduce((sum, [tierId, quantity]) => {
        const tier = event?.tiers.find((t) => t.id === tierId);
        return sum + (tier ? tier.priceCents * quantity : 0);
      }, 0),
    [selected, event],
  );

  if (isPending) return <Spinner />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <ErrorState error={new Error('This event does not exist or is not published.')} />;
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const isPast = new Date(event.startsAt) <= new Date();
  const bookable = event.status === 'PUBLISHED' && !isPast;
  const ticketCount = selected.reduce((sum, [, q]) => sum + q, 0);

  const changeQuantity = (tierId: string, quantity: number) => {
    setQuantities((q) => ({ ...q, [tierId]: quantity }));
    setIdempotencyKey(crypto.randomUUID());
    reserve.reset();
  };

  const checkout = () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    reserve.mutate(
      {
        eventId: event.id,
        items: selected.map(([tierId, quantity]) => ({ tierId, quantity })),
        idempotencyKey,
      },
      {
        onSuccess: (booking) => {
          toast.success('Tickets reserved — complete payment to confirm');
          navigate(`/bookings/${booking.id}`);
        },
      },
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <EventCover id={event.id} startsAt={event.startsAt} className="h-56 rounded-2xl" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {event.status === 'CANCELLED' && <Badge tone="danger">Cancelled</Badge>}
            {event.status === 'DRAFT' && (
              <Badge tone="warning">Draft — only you can see this</Badge>
            )}
            {isPast && <Badge>Past event</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.title}</h1>
          <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-5 text-brand-600" aria-hidden />
              {formatEventWhen(event.startsAt, event.endsAt)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-5 text-brand-600" aria-hidden />
              {event.venue}, {event.city}
            </li>
          </ul>
        </div>
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-lg font-semibold">
            About this event
          </h2>
          <p className="mt-2 whitespace-pre-line text-slate-700 dark:text-slate-300">
            {event.description || 'No description provided.'}
          </p>
        </section>
      </div>

      <aside>
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!bookable ? (
              <Alert tone="info">
                {event.status === 'CANCELLED'
                  ? 'This event was cancelled. Ticket holders have been refunded.'
                  : event.status === 'DRAFT'
                    ? 'Publish this event to start selling tickets.'
                    : 'Ticket sales have ended.'}
              </Alert>
            ) : (
              <>
                <TicketSelector
                  tiers={event.tiers}
                  quantities={quantities}
                  onChange={changeQuantity}
                  disabled={reserve.isPending}
                />
                {reserve.isError && <Alert>{errorMessage(reserve.error)}</Alert>}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-slate-500">
                    {ticketCount} ticket{ticketCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-xl font-bold">{formatMoney(totalCents)}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={ticketCount === 0}
                  loading={reserve.isPending}
                  onClick={checkout}
                >
                  {user ? 'Reserve tickets' : 'Log in to book'}
                </Button>
                <p className="text-center text-xs text-slate-500">
                  Tickets are held for 10 minutes while you pay.
                </p>
              </>
            )}
            {user && (user.role === 'ADMIN' || user.id === event.organizerId) && (
              <Link
                to={`/organizer/events/${event.id}`}
                className={buttonVariants({ variant: 'secondary', className: 'w-full' })}
              >
                Manage event
              </Link>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
