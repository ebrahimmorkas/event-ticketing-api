import { CheckCircle2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { formatDateTime } from '@/lib/format';
import { useTickets } from './api';

export function TicketList({ bookingId, eventTitle }: { bookingId: string; eventTitle: string }) {
  const { data: tickets, isPending, isError, error, refetch } = useTickets(bookingId, true);

  if (isPending) return <Spinner label="Loading tickets" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <section aria-labelledby="tickets-heading" className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h2 id="tickets-heading" className="text-lg font-semibold">
          Your tickets ({tickets.length})
        </h2>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Print
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tickets.map((ticket, index) => (
          <li
            key={ticket.id}
            className="flex gap-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 break-inside-avoid dark:border-slate-700 dark:bg-slate-900"
          >
            <img
              src={ticket.qrCode}
              alt={`QR code for ticket ${ticket.code}`}
              className="size-28 rounded bg-white p-1"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-slate-500">
                Ticket {index + 1} · {ticket.tierName}
              </p>
              <p className="truncate font-semibold">{eventTitle}</p>
              <p className="font-mono text-sm break-all">{ticket.code}</p>
              {ticket.checkedInAt && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Checked in{' '}
                  {formatDateTime(ticket.checkedInAt)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
