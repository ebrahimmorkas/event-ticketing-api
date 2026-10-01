import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/feedback';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { EventDetailPage } from '@/features/events/EventDetailPage';
import { EventsPage } from '@/features/events/EventsPage';
import type { Role } from '@/lib/types';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Signed-in areas are split into their own chunks; the public pages load instantly.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));

const MyBookingsPage = named(() => import('@/features/bookings/MyBookingsPage'), 'MyBookingsPage');
const BookingDetailPage = named(
  () => import('@/features/bookings/BookingDetailPage'),
  'BookingDetailPage',
);
const OrganizerDashboardPage = named(
  () => import('@/features/organizer/OrganizerDashboardPage'),
  'OrganizerDashboardPage',
);
const CreateEventPage = named(
  () => import('@/features/organizer/CreateEventPage'),
  'CreateEventPage',
);
const ManageEventPage = named(
  () => import('@/features/organizer/ManageEventPage'),
  'ManageEventPage',
);
const CheckInPage = named(() => import('@/features/organizer/CheckInPage'), 'CheckInPage');
const UsersPage = named(() => import('@/features/admin/UsersPage'), 'UsersPage');

const ORGANIZERS: Role[] = ['ORGANIZER', 'ADMIN'];

const protect = (element: ReactNode, roles?: Role[]) => (
  <RequireAuth roles={roles}>
    <Suspense fallback={<Spinner />}>{element}</Suspense>
  </RequireAuth>
);

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: 'bookings', element: protect(<MyBookingsPage />) },
      { path: 'bookings/:id', element: protect(<BookingDetailPage />) },
      { path: 'organizer', element: protect(<OrganizerDashboardPage />, ORGANIZERS) },
      { path: 'organizer/events/new', element: protect(<CreateEventPage />, ORGANIZERS) },
      { path: 'organizer/events/:id', element: protect(<ManageEventPage />, ORGANIZERS) },
      { path: 'organizer/check-in', element: protect(<CheckInPage />, ORGANIZERS) },
      { path: 'admin/users', element: protect(<UsersPage />, ['ADMIN']) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
