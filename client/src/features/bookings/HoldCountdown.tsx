import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function useSecondsLeft(expiresAt: string) {
  const compute = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(compute);

  useEffect(() => {
    setSecondsLeft(compute());
    const timer = setInterval(() => setSecondsLeft(compute()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return secondsLeft;
}

export function HoldCountdown({ secondsLeft }: { secondsLeft: number }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const urgent = secondsLeft < 120;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3',
        urgent
          ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
          : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
      )}
    >
      <Timer className="size-5 shrink-0" aria-hidden />
      <p className="text-sm">
        Your tickets are held for{' '}
        <strong className="font-mono text-base tabular-nums" aria-live="off">
          {minutes}:{seconds}
        </strong>
        . Pay before the timer runs out or they are released.
      </p>
    </div>
  );
}
