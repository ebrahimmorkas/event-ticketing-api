import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from '@/lib/types';

const TONES = {
  PENDING: { tone: 'warning', label: 'Awaiting payment' },
  CONFIRMED: { tone: 'success', label: 'Confirmed' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
} as const;

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { tone, label } = TONES[status];
  return <Badge tone={tone}>{label}</Badge>;
}
