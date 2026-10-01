import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/features/events/api';
import { api } from '@/lib/api';
import type { CheckInResult, Event, EventStats, TicketTier } from '@/lib/types';

export interface TierInput {
  name: string;
  priceCents: number;
  capacity: number;
}

export interface EventInput {
  title: string;
  description: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
}

export const statsKey = (id: string) => ['organizer', 'stats', id] as const;

export function useMyEvents() {
  return useQuery({
    queryKey: eventKeys.mine,
    queryFn: ({ signal }) => api<{ data: Event[] }>('/events/mine', { signal }),
    select: (res) => res.data,
  });
}

export function useEventStats(id: string, enabled = true) {
  return useQuery({
    queryKey: statsKey(id),
    queryFn: ({ signal }) => api<EventStats>(`/organizer/events/${id}/stats`, { signal }),
    enabled,
  });
}

/** Any change to an event affects the public list, the organizer list and the stats. */
function useEventMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  eventId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
      if (eventId) queryClient.invalidateQueries({ queryKey: statsKey(eventId) });
    },
  });
}

export const useCreateEvent = () =>
  useEventMutation((input: EventInput & { tiers: TierInput[] }) =>
    api<{ event: Event }>('/events', { method: 'POST', body: input }).then((r) => r.event),
  );

export const useUpdateEvent = (id: string) =>
  useEventMutation(
    (input: Partial<EventInput>) =>
      api<{ event: Event }>(`/events/${id}`, { method: 'PATCH', body: input }).then((r) => r.event),
    id,
  );

export const usePublishEvent = (id: string) =>
  useEventMutation(
    () => api<{ event: Event }>(`/events/${id}/publish`, { method: 'POST' }).then((r) => r.event),
    id,
  );

export const useCancelEvent = (id: string) =>
  useEventMutation(
    () =>
      api<{ event: Event; cancelledBookings: number }>(`/events/${id}/cancel`, { method: 'POST' }),
    id,
  );

export const useAddTier = (eventId: string) =>
  useEventMutation(
    (input: TierInput) =>
      api<{ tier: TicketTier }>(`/events/${eventId}/tiers`, { method: 'POST', body: input }),
    eventId,
  );

export const useUpdateTier = (eventId: string) =>
  useEventMutation(
    ({ tierId, ...input }: Partial<TierInput> & { tierId: string }) =>
      api<{ tier: TicketTier }>(`/events/${eventId}/tiers/${tierId}`, {
        method: 'PATCH',
        body: input,
      }),
    eventId,
  );

export function useCheckIn() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ checkIn: CheckInResult }>('/organizer/check-in', {
        method: 'POST',
        body: { code },
      }).then((r) => r.checkIn),
  });
}
