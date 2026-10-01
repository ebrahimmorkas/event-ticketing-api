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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
