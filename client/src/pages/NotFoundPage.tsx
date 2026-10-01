import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-500">
        The page you are looking for doesn't exist or was moved.
      </p>
      <Link to="/" className={buttonVariants({ className: 'mt-8' })}>
        Back to home
      </Link>
    </div>
  );
}
