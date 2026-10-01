import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Pagination } from '@/components/Pagination';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { useAuth } from '@/features/auth/auth-context';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated, Role, User } from '@/lib/types';

const ROLES: Role[] = ['CUSTOMER', 'ORGANIZER', 'ADMIN'];
const roleLabel = (role: Role) => role.charAt(0) + role.slice(1).toLowerCase();

function useUsers(role: Role | undefined, page: number) {
  return useQuery({
    queryKey: ['users', role ?? 'ALL', page],
    queryFn: ({ signal }) =>
      api<Paginated<User>>('/users', { query: { role, page, limit: 20 }, signal }),
    placeholderData: keepPreviousData,
  });
}

function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api<{ user: User }>(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: ({ user }) => {
      toast.success(`${user.name} is now ${roleLabel(user.role).toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = (params.get('role') as Role | null) ?? undefined;
  const page = Number(params.get('page') ?? 1);
  const { data, isPending, isError, error, refetch } = useUsers(role, page);
  const changeRole = useChangeRole();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-slate-500">Promote customers to organizers or admins.</p>
        </div>
        <Select
          aria-label="Filter by role"
          className="w-48"
          value={role ?? ''}
          onChange={(e) => setParams(e.target.value ? { role: e.target.value } : {})}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
      </header>

      {isPending ? (
        <Skeleton className="h-96" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Users</caption>
              <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Select
                        aria-label={`Role for ${user.name}`}
                        className="w-40"
                        value={user.role}
                        // Admins cannot demote themselves and lock everyone out.
                        disabled={user.id === me?.id || changeRole.isPending}
                        onChange={(e) =>
                          changeRole.mutate({ id: user.id, role: e.target.value as Role })
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={data.meta}
            onPage={(p) => setParams({ ...(role && { role }), page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
