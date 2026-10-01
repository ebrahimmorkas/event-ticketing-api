import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form';
import { useDebouncedValue } from '@/lib/use-debounce';
import { useEvents, type EventFilters } from './api';
import { EventCard } from './EventCard';

const PAGE_SIZE = 9;

const SORTS = [
  { value: 'startsAt', label: 'Soonest first' },
  { value: '-startsAt', label: 'Latest first' },
  { value: '-createdAt', label: 'Newly added' },
] as const;

/** Filters live in the URL so searches can be shared and survive a reload. */
export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [city, setCity] = useState(params.get('city') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCity = useDebouncedValue(city);

  const filters: EventFilters = {
    q: params.get('q') ?? undefined,
    city: params.get('city') ?? undefined,
    from: params.get('from') ?? undefined,
    sort: (params.get('sort') as EventFilters['sort']) ?? 'startsAt',
    page: Number(params.get('page') ?? 1),
    limit: PAGE_SIZE,
  };

  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (debouncedSearch !== (params.get('q') ?? '')) update({ q: debouncedSearch.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (debouncedCity !== (params.get('city') ?? '')) update({ city: debouncedCity.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCity]);

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useEvents(filters);
  const hasFilters = Boolean(filters.q || filters.city || filters.from);

  const clearFilters = () => {
    setSearch('');
    setCity('');
    setParams({}, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Upcoming events</h1>
        <p className="mt-1 text-slate-500">Find something to do and grab tickets before they go.</p>
      </header>

      <div
        role="search"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            aria-label="Search events"
            placeholder="Search by title or description"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          aria-label="City"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Input
          aria-label="From date"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => update({ from: e.target.value })}
        />
        <Select
          aria-label="Sort by"
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X aria-hidden /> Clear
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="No events found"
          description={
            hasFilters ? 'Try a different search or clear the filters.' : 'Check back soon.'
          }
          action={
            hasFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <div
            className="grid gap-6 transition-opacity sm:grid-cols-2 lg:grid-cols-3 data-[stale=true]:opacity-60"
            data-stale={isPlaceholderData}
            aria-busy={isPlaceholderData}
          >
            {data.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <Pagination meta={data.meta} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
    </div>
  );
}
