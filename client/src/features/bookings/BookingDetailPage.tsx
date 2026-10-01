import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert, ErrorState, Spinner } from '@/components/ui/feedback';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { useBooking, useCancelBooking, usePay } from './api';
import { BookingStatusBadge } from './BookingStatusBadge';
import { HoldCountdown, useSecondsLeft } from './HoldCountdown';
import { PaymentForm } from './PaymentForm';
import { TicketList } from './TicketList';

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const { data: booking, isPending, isError, error, refetch } = useBooking(id);

  if (isPending) return <Spinner />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/bookings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 print:hidden dark:hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> All bookings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{booking.event.title}</h1>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden />{' '}
              {formatDateTime(booking.event.startsAt)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4" aria-hidden /> {booking.event.venue}, {booking.event.city}
            </li>
          </ul>
        </div>
        <BookingStatusBadge status={booking.status} />
      </header>

      <OrderSummary booking={booking} />

      {booking.status === 'PENDING' && booking.expiresAt && (
        <Checkout booking={booking} expiresAt={booking.expiresAt} onExpired={refetch} />
      )}
      {booking.status === 'CONFIRMED' && (
        <TicketList bookingId={booking.id} eventTitle={booking.event.title} />
      )}
      {booking.status === 'EXPIRED' && (
        <Alert tone="info">
          This reservation expired before payment and the tickets were released.{' '}
          <Link className="font-medium underline" to={`/events/${booking.event.id}`}>
            Book again
          </Link>
        </Alert>
      )}
      {booking.status === 'CANCELLED' && (
        <Alert tone="info">
          Cancelled {booking.cancelledAt && formatDateTime(booking.cancelledAt)}.
          {booking.confirmedAt && ' Your payment has been refunded.'}
        </Alert>
      )}

      <CancelBooking booking={booking} />
    </div>
  );
}

function OrderSummary({ booking }: { booking: Booking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <caption className="sr-only">Tickets in this booking</caption>
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-medium">Ticket</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {booking.items.map((item) => (
              <tr key={item.tierId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2">{item.tierName}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">
                  {formatMoney(item.unitPriceCents * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
              <td className="pt-3" colSpan={2}>
                Total
              </td>
              <td className="pt-3 text-right">{formatMoney(booking.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function Checkout({
  booking,
  expiresAt,
  onExpired,
}: {
  booking: Booking;
  expiresAt: string;
  onExpired: () => void;
}) {
  const pay = usePay(booking.id);
  const secondsLeft = useSecondsLeft(expiresAt);

  // When the hold lapses, ask the server for the real status (it may have expired the booking).
  useEffect(() => {
    if (secondsLeft === 0) onExpired();
  }, [secondsLeft, onExpired]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete your purchase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <HoldCountdown secondsLeft={secondsLeft} />
        <PaymentForm
          totalCents={booking.totalCents}
          isPaying={pay.isPending}
          error={pay.error}
          onPay={(method) =>
            pay.mutate(method, {
              onSuccess: () => toast.success('Payment successful — enjoy the event!'),
              // The hold lapsed server-side; reload to show the expired state.
              onError: (err) => {
                if (err instanceof ApiError && err.code === 'BOOKING_EXPIRED') onExpired();
              },
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function CancelBooking({ booking }: { booking: Booking }) {
  const cancel = useCancelBooking(booking.id);
  const [open, setOpen] = useState(false);
  const started = new Date(booking.event.startsAt) <= new Date();
  const cancellable = booking.status === 'PENDING' || (booking.status === 'CONFIRMED' && !started);
  if (!cancellable) return null;

  const confirm = () =>
    cancel.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        toast.success('Booking cancelled');
      },
      onError: (err) => {
        setOpen(false);
        toast.error(errorMessage(err));
      },
    });

  return (
    <div className="print:hidden">
      <Button variant="ghost" className="text-red-600" onClick={() => setOpen(true)}>
        Cancel booking
      </Button>
      <ConfirmDialog
        open={open}
        title="Cancel this booking?"
        description={
          booking.status === 'CONFIRMED'
            ? `Your tickets will be invalidated and ${formatMoney(booking.totalCents)} refunded.`
            : 'The reserved tickets will be released to other buyers.'
        }
        confirmLabel="Cancel booking"
        loading={cancel.isPending}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
