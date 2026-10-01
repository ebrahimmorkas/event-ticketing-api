import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ExternalLink, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert, ErrorState, Spinner } from '@/components/ui/feedback';
import { useEvent } from '@/features/events/api';
import { errorMessage } from '@/lib/api';
import { formatEventWhen, toDateTimeLocal } from '@/lib/format';
import type { Event } from '@/lib/types';
import { useCancelEvent, usePublishEvent, useUpdateEvent } from './api';
import { EventDetailsFields } from './EventDetailsFields';
import { EventStatusBadge } from './EventStatusBadge';
import { SalesStats } from './SalesStats';
import { eventDetailsSchema, toEventInput, type EventDetailsValues } from './schemas';
import { TierManager } from './TierManager';

export function ManageEventPage() {
  const { id = '' } = useParams();
  const { data: event, isPending, isError, error, refetch } = useEvent(id);

  if (isPending) return <Spinner />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const cancelled = event.status === 'CANCELLED';

  return (
    <div className="space-y-6">
      <Link
        to="/organizer"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> Your events
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-slate-500">
            {formatEventWhen(event.startsAt, event.endsAt)} · {event.venue}, {event.city}
          </p>
        </div>
        <EventActions event={event} />
      </header>

      {cancelled && (
        <Alert tone="info">
          This event is cancelled. All bookings were cancelled and refunded.
        </Alert>
      )}

      <SalesStats eventId={event.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailsForm event={event} readOnly={cancelled} />
        <TierManager eventId={event.id} tiers={event.tiers} readOnly={cancelled} />
      </div>
    </div>
  );
}

function EventActions({ event }: { event: Event }) {
  const publish = usePublishEvent(event.id);
  const cancel = useCancelEvent(event.id);
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {event.status !== 'DRAFT' && (
        <Link to={`/events/${event.id}`} className={buttonVariants({ variant: 'secondary' })}>
          <ExternalLink aria-hidden /> Public page
        </Link>
      )}
      {event.status === 'DRAFT' && (
        <Button
          loading={publish.isPending}
          onClick={() =>
            publish.mutate(undefined, {
              onSuccess: () => toast.success('Event published — tickets are on sale'),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          <Rocket aria-hidden /> Publish
        </Button>
      )}
      {event.status !== 'CANCELLED' && (
        <Button variant="danger" onClick={() => setConfirmCancel(true)}>
          Cancel event
        </Button>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this event?"
        description="Every booking will be cancelled and paid tickets refunded. This cannot be undone."
        confirmLabel="Cancel event"
        loading={cancel.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: ({ cancelledBookings }) => {
              setConfirmCancel(false);
              toast.success(`Event cancelled · ${cancelledBookings} bookings refunded`);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

function DetailsForm({ event, readOnly }: { event: Event; readOnly: boolean }) {
  const update = useUpdateEvent(event.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EventDetailsValues>({
    resolver: zodResolver(eventDetailsSchema),
    values: {
      title: event.title,
      description: event.description,
      venue: event.venue,
      city: event.city,
      startsAt: toDateTimeLocal(event.startsAt),
      endsAt: toDateTimeLocal(event.endsAt),
    },
  });

  const onSubmit = (values: EventDetailsValues) =>
    update.mutate(toEventInput(values), {
      onSuccess: () => toast.success('Event updated'),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <EventDetailsFields register={register} errors={errors} />
          </fieldset>
          {update.isError && <Alert>{errorMessage(update.error)}</Alert>}
          {!readOnly && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={!isDirty} onClick={() => reset()}>
                Discard
              </Button>
              <Button type="submit" disabled={!isDirty} loading={update.isPending}>
                Save changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
