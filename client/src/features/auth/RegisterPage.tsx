import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from './auth-context';

// Mirrors the API's registerSchema so users see errors before submitting.
const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  email: z.email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(72)
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['CUSTOMER', 'ORGANIZER']),
});
type FormValues = z.infer<typeof schema>;

const ROLES = [
  { value: 'CUSTOMER', title: 'I want to attend', text: 'Book tickets for events' },
  { value: 'ORGANIZER', title: 'I organise events', text: 'Sell tickets and check guests in' },
] as const;

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'CUSTOMER' } });

  const role = watch('role');

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const user = await signUp(values);
      toast.success('Account created');
      navigate(user.role === 'ORGANIZER' ? '/organizer' : '/events', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Already have one?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>

      <Card className="mt-6">
        <CardContent>
          <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
            {error && <Alert>{error}</Alert>}

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Account type
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'cursor-pointer rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand-500',
                      role === option.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                    )}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      className="sr-only"
                      {...register('role')}
                    />
                    <span className="block font-medium">{option.title}</span>
                    <span className="block text-xs text-slate-500">{option.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Full name" error={errors.name?.message}>
              <Input autoComplete="name" {...register('name')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field
              label="Password"
              error={errors.password?.message}
              hint="At least 8 characters, with a letter and a number."
            >
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
