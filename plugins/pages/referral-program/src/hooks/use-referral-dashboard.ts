import { useState, useEffect, useCallback } from 'react';
import type { ReferralDashboard } from '../api';
import { getReferralDashboard } from '../api';

export interface UseReferralDashboardReturn {
  dashboard: ReferralDashboard | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 使用后端聚合的推广看板接口。
 *
 * 注意：当前后端的字段命名和前端 mock 类型可能不完全一致，这里做了最小映射：
 * - ReferralStats 仍然作为前端展示的单一入口；
 * - links / currentLink 从 dashboard.links / dashboard.current_link 映射；
 * - points 从 dashboard.points 映射。
 */
export function useReferralDashboard(): UseReferralDashboardReturn {
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReferralDashboard();
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
  };
}

