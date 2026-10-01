import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-indigo-500 to-fuchsia-600',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-700',
  'from-orange-500 to-rose-600',
  'from-violet-500 to-purple-800',
  'from-pink-500 to-orange-500',
];

/** Picks a stable gradient per event, since the API stores no cover images. */
function gradientFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function EventCover({
  id,
  startsAt,
  className,
}: {
  id: string;
  startsAt: string;
  className?: string;
}) {
  const date = new Date(startsAt);
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex items-end overflow-hidden bg-gradient-to-br p-4 text-white',
        gradientFor(id),
        className,
      )}
    >
      <CalendarDays className="absolute -right-4 -bottom-6 size-32 opacity-15" />
      <div className="rounded-lg bg-white/15 px-3 py-1.5 text-center backdrop-blur">
        <div className="text-xs font-semibold uppercase">{format(date, 'MMM')}</div>
        <div className="text-2xl leading-none font-bold">{format(date, 'd')}</div>
      </div>
    </div>
  );
}
