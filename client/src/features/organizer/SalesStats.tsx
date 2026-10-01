import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatMoney, formatPercent } from '@/lib/format';
import { useEventStats } from './api';

const SERIES = [
  { key: 'sold', label: 'Sold', color: '#4f46e5' },
  { key: 'held', label: 'Held (unpaid)', color: '#f59e0b' },
  { key: 'available', label: 'Available', color: '#cbd5e1' },
] as const;

export function SalesStats({ eventId }: { eventId: string }) {
  const { data: stats, isPending, isError, error, refetch } = useEventStats(eventId);

  if (isPending) return <Skeleton className="h-80" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const { totals } = stats;
  const tiles = [
    { label: 'Revenue', value: formatMoney(totals.revenueCents) },
    { label: 'Tickets sold', value: `${totals.sold} / ${totals.capacity}` },
    { label: 'Sell-through', value: formatPercent(totals.sellThroughRate) },
    { label: 'Checked in', value: `${totals.checkedIn} / ${totals.sold}` },
  ];

  return (
    <section aria-labelledby="stats-heading" className="space-y-4">
      <h2 id="stats-heading" className="text-lg font-semibold">
        Sales & attendance
      </h2>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent>
              <dt className="text-sm text-slate-500">{tile.label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{tile.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>

      {stats.tiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Seats by tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" role="img" aria-label="Stacked bar chart of seats by tier">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.tiers} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: '#94a3b822' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      stackId="seats"
                      fill={s.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* The same data as a table, for screen readers and exact numbers. */}
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Seats and revenue by tier</caption>
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Tier</th>
                  <th className="py-2 text-right font-medium">Sold</th>
                  <th className="py-2 text-right font-medium">Held</th>
                  <th className="py-2 text-right font-medium">Checked in</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.tiers.map((tier) => (
                  <tr key={tier.id}>
                    <td className="py-2">{tier.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {tier.sold}/{tier.capacity}
                    </td>
                    <td className="py-2 text-right tabular-nums">{tier.held}</td>
                    <td className="py-2 text-right tabular-nums">{tier.checkedIn}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(tier.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
