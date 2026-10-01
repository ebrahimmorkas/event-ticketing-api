import { Camera, CameraOff, CheckCircle2, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { CheckInResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCheckIn } from './api';
import { canScanQr, QrScanner } from './QrScanner';

type LogEntry =
  | { ok: true; code: string; result: CheckInResult }
  | { ok: false; code: string; message: string; reason: string };

const MAX_LOG = 20;

export function CheckInPage() {
  const checkIn = useCheckIn();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const latest = log[0];

  const record = (entry: LogEntry) => setLog((l) => [entry, ...l].slice(0, MAX_LOG));

  const submit = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value || checkIn.isPending) return;
    checkIn.mutate(value, {
      onSuccess: (result) => record({ ok: true, code: value, result }),
      onError: (err) =>
        record({
          ok: false,
          code: value,
          message: errorMessage(err),
          reason: err instanceof ApiError ? err.code : 'ERROR',
        }),
      onSettled: () => setCode(''),
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Check-in</h1>
        <p className="mt-1 text-slate-500">
          Scan the QR code on a ticket or type its code. Each ticket is admitted only once.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4">
          {scanning && <QrScanner onScan={submit} paused={checkIn.isPending} />}
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              aria-label="Ticket code"
              placeholder="TKT-XXXXXXXXXXXXXXXX"
              className="font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <Button type="submit" loading={checkIn.isPending} disabled={!code.trim()}>
              Check in
            </Button>
          </form>
          {canScanQr && (
            <Button variant="secondary" onClick={() => setScanning((s) => !s)}>
              {scanning ? <CameraOff aria-hidden /> : <Camera aria-hidden />}
              {scanning ? 'Stop camera' : 'Scan with camera'}
            </Button>
          )}
        </CardContent>
      </Card>

      <div aria-live="assertive">
        {latest && (
          <div
            data-testid="check-in-result"
            className={cn(
              'flex items-start gap-4 rounded-xl p-5',
              latest.ok
                ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200',
            )}
          >
            {latest.ok ? (
              <CheckCircle2 className="size-10 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="size-10 shrink-0 text-red-600" aria-hidden />
            )}
            <div>
              <p className="text-xl font-bold">
                {latest.ok
                  ? 'Admit'
                  : latest.reason === 'ALREADY_CHECKED_IN'
                    ? 'Already used'
                    : 'Do not admit'}
              </p>
              {latest.ok ? (
                <p>
                  {latest.result.attendee.name} · {latest.result.tierName} ·{' '}
                  {latest.result.event.title}
                </p>
              ) : (
                <p>{latest.message}</p>
              )}
              <p className="mt-1 font-mono text-sm opacity-75">{latest.code}</p>
            </div>
          </div>
        )}
      </div>

      {log.length > 1 && (
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-2 text-sm font-semibold text-slate-500">
            Recent scans
          </h2>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {log.slice(1).map((entry, i) => (
              <li key={`${entry.code}-${i}`} className="flex items-center gap-3 px-4 py-2">
                {entry.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600" aria-label="Admitted" />
                ) : (
                  <XCircle className="size-4 text-red-600" aria-label="Rejected" />
                )}
                <span className="font-mono">{entry.code}</span>
                <span className="ml-auto truncate text-slate-500">
                  {entry.ok
                    ? `${entry.result.attendee.name} · ${formatDateTime(entry.result.checkedInAt)}`
                    : entry.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
