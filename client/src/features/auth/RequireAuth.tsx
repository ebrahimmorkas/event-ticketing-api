import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import type { Role } from '@/lib/types';
import { useAuth } from './auth-context';

/** Guards a route: anonymous users go to /login, users without the role see a 403 page. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner label="Restoring session" />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !hasRole(...roles)) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Log in with an account that has the required role."
      />
    );
  }
  return children;
}
