import { useState, useEffect, useCallback } from 'react';
import type { ReferredUser, UserStatusFilter } from '../types';
import { listReferredUsers } from '../api';

export interface UseReferredUsersParams {
  page: number;
  statusFilter: UserStatusFilter;
  searchQuery: string;
  enabled?: boolean;
}

export interface UseReferredUsersReturn {
  users: ReferredUser[];
  totalPages: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useReferredUsers(params: UseReferredUsersParams): UseReferredUsersReturn {
  const { page, statusFilter, searchQuery, enabled = true } = params;
  const [users, setUsers] = useState<ReferredUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReferredUsers = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listReferredUsers({
        page,
        keyword: searchQuery || null,
        status: statusFilter === 'all' ? null : statusFilter,
      });

      setUsers(data.items ?? []);
      const totalPagesCalc =
        data.page_size > 0 ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
      setTotalPages(totalPagesCalc);
    } catch (e) {
      console.error('Failed to fetch referred users:', e);
      setUsers([]);
      setTotalPages(1);
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, enabled]);

  useEffect(() => {
    void fetchReferredUsers();
  }, [fetchReferredUsers]);

  return {
    users,
    totalPages,
    loading,
    error,
    refresh: fetchReferredUsers,
  };
}
