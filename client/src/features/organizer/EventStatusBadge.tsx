import { Badge } from '@/components/ui/badge';
import type { EventStatus } from '@/lib/types';

const TONES = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
} as const;

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={TONES[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
