// Response shapes of the Event Ticketing API (see docs/openapi.yaml).

export type Role = 'CUSTOMER' | 'ORGANIZER' | 'ADMIN';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface TicketTier {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
}

export interface Event {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  tiers: TicketTier[];
}

export interface BookingItem {
  tierId: string;
  tierName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  totalCents: number;
  currency: string;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  event: Pick<Event, 'id' | 'title' | 'venue' | 'city' | 'startsAt'>;
  items: BookingItem[];
}

export interface Ticket {
  id: string;
  code: string;
  tierName: string;
  checkedInAt: string | null;
  qrCode: string;
}

export interface CheckInResult {
  code: string;
  tierName: string;
  attendee: { name: string; email: string };
  event: { id: string; title: string };
  checkedInAt: string;
}

export interface TierStats {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  held: number;
  sold: number;
  available: number;
  checkedIn: number;
  revenueCents: number;
}

export interface EventStats {
  event: Pick<Event, 'id' | 'title' | 'status' | 'startsAt'>;
  totals: {
    capacity: number;
    sold: number;
    checkedIn: number;
    sellThroughRate: number;
    revenueCents: number;
  };
  bookings: Partial<Record<BookingStatus, number>>;
  tiers: TierStats[];
}
