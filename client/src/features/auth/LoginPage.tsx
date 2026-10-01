import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { errorMessage } from '@/lib/api';
import { useAuth } from './auth-context';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

/** Accounts created by `npm run db:seed`. */
export const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'customer@example.com', blurb: 'Browse and book tickets' },
  { label: 'Organizer', email: 'organizer@example.com', blurb: 'Manage events and check-in' },
  { label: 'Admin', email: 'admin@example.com', blurb: 'Manage users and roles' },
] as const;
export const DEMO_PASSWORD = 'Password123!';

const showDemo = import.meta.env.VITE_DEMO_ACCOUNTS !== 'false';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/events';
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Already signed in (e.g. a bookmarked /login): go straight on.
  if (status === 'authenticated') return <Navigate to={from} replace />;

  const demoSignIn = async (email: string) => {
    setDemoLoading(email);
    await signIn(email, DEMO_PASSWORD);
    setDemoLoading(null);
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      <Card className="mt-6">
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={handleSubmit(({ email, password }) => signIn(email, password))}
          >
            {error && <Alert>{error}</Alert>}
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>

      {showDemo && (
        <section aria-labelledby="demo-heading" className="mt-6">
          <h2
            id="demo-heading"
            className="text-sm font-semibold text-slate-600 dark:text-slate-400"
          >
            Just looking around? Use a demo account
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="secondary"
                className="h-auto flex-col items-start gap-0.5 py-3 text-left whitespace-normal"
                loading={demoLoading === account.email}
                disabled={demoLoading !== null}
                onClick={() => demoSignIn(account.email)}
              >
                <span>{account.label}</span>
                <span className="text-xs font-normal text-slate-500">{account.blurb}</span>
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
