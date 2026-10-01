import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Event, Paginated } from '@/lib/types';

export interface EventFilters {
  q?: string;
  city?: string;
  from?: string;
  sort?: 'startsAt' | '-startsAt' | 'createdAt' | '-createdAt';
  page?: number;
  limit?: number;
}

export const eventKeys = {
  all: ['events'] as const,
  list: (filters: EventFilters) => ['events', 'list', filters] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
  mine: ['events', 'mine'] as const,
};

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ signal }) => api<Paginated<Event>>('/events', { query: { ...filters }, signal }),
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }) => api<{ event: Event }>(`/events/${id}`, { signal }),
    select: (res) => res.event,
  });
}
