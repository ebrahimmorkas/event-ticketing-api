import { QrCode, ShieldCheck, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Never oversold',
    text: 'Seats are reserved atomically, so two buyers can never get the last ticket.',
  },
  {
    icon: Timer,
    title: 'Fair checkout holds',
    text: 'Tickets are held for you while you pay, then released for others if you walk away.',
  },
  {
    icon: QrCode,
    title: 'QR check-in',
    text: 'Every ticket has a QR code that can be scanned exactly once at the door.',
  },
];

export function HomePage() {
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-fuchsia-700 px-6 py-16 text-white sm:px-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-brand-100 uppercase">
            Concerts · Conferences · Meetups
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Find your next event and get in with one scan.
          </h1>
          <p className="mt-4 text-lg text-brand-100">
            Gatepass sells tickets for events near you. Organizers publish events, set ticket tiers
            and check guests in with QR codes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/events" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>
              Browse events
            </Link>
            <Link
              to="/register"
              className={buttonVariants({
                size: 'lg',
                className: 'bg-white/10 ring-1 ring-white/30 hover:bg-white/20',
              })}
            >
              Start organizing
            </Link>
          </div>
        </div>
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl p-2">
              <Icon className="size-8 text-brand-600" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
