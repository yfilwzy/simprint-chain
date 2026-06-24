import { useState, useEffect, useCallback } from 'react';
import type { ReferralReward, RewardStatusFilter } from '../types';
import { listReferralRewards } from '../api';

export interface UseReferralRewardsParams {
  page: number;
  statusFilter: RewardStatusFilter;
  typeFilter: string;
  searchQuery: string;
  enabled?: boolean;
}

export interface UseReferralRewardsReturn {
  rewards: ReferralReward[];
  totalPages: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useReferralRewards(params: UseReferralRewardsParams): UseReferralRewardsReturn {
  const { page, statusFilter, typeFilter, searchQuery, enabled = true } = params;
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listReferralRewards({
        page,
        keyword: searchQuery || null,
        reward_type: typeFilter && typeFilter !== 'all' ? typeFilter : null,
        status: statusFilter === 'all' ? null : statusFilter,
      });

      setRewards(data.items ?? []);
      const totalPagesCalc =
        data.page_size > 0 ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
      setTotalPages(totalPagesCalc);
    } catch (e) {
      console.error('Failed to fetch rewards:', e);
      setRewards([]);
      setTotalPages(1);
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, typeFilter, enabled]);

  useEffect(() => {
    void fetchRewards();
  }, [fetchRewards]);

  return {
    rewards,
    totalPages,
    loading,
    error,
    refresh: fetchRewards,
  };
}
