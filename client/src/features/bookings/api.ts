import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Booking, BookingStatus, Paginated, Ticket } from '@/lib/types';
import { eventKeys } from '@/features/events/api';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (status?: BookingStatus, page = 1) => ['bookings', 'list', status ?? 'ALL', page] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  tickets: (id: string) => ['bookings', 'tickets', id] as const,
};

export interface ReserveInput {
  eventId: string;
  items: { tierId: string; quantity: number }[];
  /** Same key for retries of the same checkout, so a double click never books twice. */
  idempotencyKey: string;
}

export function useMyBookings(status?: BookingStatus, page = 1) {
  return useQuery({
    queryKey: bookingKeys.list(status, page),
    queryFn: ({ signal }) =>
      api<Paginated<Booking>>('/bookings', { query: { status, page, limit: 10 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: ({ signal }) => api<{ booking: Booking }>(`/bookings/${id}`, { signal }),
    select: (res) => res.booking,
  });
}

export function useTickets(id: string, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.tickets(id),
    queryFn: ({ signal }) => api<{ tickets: Ticket[] }>(`/bookings/${id}/tickets`, { signal }),
    select: (res) => res.tickets,
    enabled,
  });
}

/** Seat availability changes after any booking mutation, so event data is refetched too. */
function useInvalidateAfterBooking() {
  const queryClient = useQueryClient();
  return (booking: Booking) => {
    queryClient.setQueryData(bookingKeys.detail(booking.id), { booking });
    queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    queryClient.invalidateQueries({ queryKey: eventKeys.all });
  };
}

export function useReserve() {
  const onSuccess = useInvalidateAfterBooking();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: ReserveInput) =>
      api<{ booking: Booking }>('/bookings', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      }).then((res) => res.booking),
    onSuccess,
  });
}

export function usePay(id: string) {
  const onSuccess = useInvalidateAfterBooking();
  return useMutation({
    mutationFn: (paymentMethod: string) =>
      api<{ booking: Booking }>(`/bookings/${id}/pay`, {
        method: 'POST',
        body: { paymentMethod },
      }).then((res) => res.booking),
    onSuccess,
  });
}

export function useCancelBooking(id: string) {
  const onSuccess = useInvalidateAfterBooking();
  return useMutation({
    mutationFn: () =>
      api<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'POST' }).then(
        (res) => res.booking,
      ),
    onSuccess,
  });
}
