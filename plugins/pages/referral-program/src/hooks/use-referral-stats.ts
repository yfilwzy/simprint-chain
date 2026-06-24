import { useState, useEffect, useCallback } from 'react';
import type { ReferralStats } from '../types';
import { API_ENDPOINTS } from '../constants';

export interface UseReferralStatsReturn {
  stats: ReferralStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useReferralStats(): UseReferralStatsReturn {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.STATS);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = (await res.json()) as { data: ReferralStats };
      setStats(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
