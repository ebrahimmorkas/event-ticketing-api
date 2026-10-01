import { LogOut, Menu, Moon, Sun, Ticket, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import type { Role } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/events', label: 'Events' },
  { to: '/bookings', label: 'My bookings', roles: ['CUSTOMER', 'ORGANIZER', 'ADMIN'] },
  { to: '/organizer', label: 'Organizer', roles: ['ORGANIZER', 'ADMIN'] },
  { to: '/organizer/check-in', label: 'Check-in', roles: ['ORGANIZER', 'ADMIN'] },
  { to: '/admin/users', label: 'Users', roles: ['ADMIN'] },
];

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV.filter((item) => !item.roles || hasRole(...item.roles));

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Ticket className="size-4" aria-hidden />
            </span>
            Gatepass
          </Link>

          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            {user ? (
              <div className="hidden items-center gap-3 md:flex">
                <span className="text-right text-sm leading-tight">
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-xs text-slate-500">{user.role.toLowerCase()}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  <LogOut aria-hidden /> Log out
                </Button>
              </div>
            ) : (
              <div className="hidden gap-2 md:flex">
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Sign up
                </Link>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800"
          >
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end className={linkClass} onClick={closeMenu}>
                  {item.label}
                </NavLink>
              ))}
              {user ? (
                <button
                  type="button"
                  className={linkClass({ isActive: false })}
                  onClick={handleLogout}
                >
                  Log out ({user.name})
                </button>
              ) : (
                <>
                  <NavLink to="/login" className={linkClass} onClick={closeMenu}>
                    Log in
                  </NavLink>
                  <NavLink to="/register" className={linkClass} onClick={closeMenu}>
                    Sign up
                  </NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-800">
        Gatepass — React client for the{' '}
        <a
          className="underline hover:text-slate-900 dark:hover:text-white"
          href="https://github.com/ebrahimmorkas/event-ticketing-api"
        >
          Event Ticketing API
        </a>
      </footer>
    </div>
  );
}
