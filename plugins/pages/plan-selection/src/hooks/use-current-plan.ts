import { useState, useEffect, useCallback } from 'react';
import { post, isSuccess } from '@/lib/request';
import type { CurrentPlan } from '../types';
import { getCurrentSubscription } from '../api';

interface UseCurrentPlanReturn {
  currentPlan: CurrentPlan | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

interface QuotaResponse {
  workspace_uuid: string;
  max_environments: number;
  used_environments: number;
  max_team_members: number;
  used_team_members: number;
  max_proxies: number;
  used_proxies: number;
  max_rpa_tasks: number;
  used_rpa_tasks: number;
  created_at: string;
  updated_at: string;
}

/**
 * 获取工作空间配额
 */
async function getQuota(): Promise<QuotaResponse | null> {
  try {
    const result = await post<QuotaResponse>('billing/quota', {});
    if (!isSuccess(result)) {
      return null;
    }
    return result.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取当前套餐的 Hook
 */
export function useCurrentPlan(): UseCurrentPlanReturn {
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCurrentPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [subscription, quota] = await Promise.all([
        getCurrentSubscription(),
        getQuota(),
      ]);

      if (subscription) {
        setCurrentPlan({
          id: subscription.plan_uuid,
          expiresAt: subscription.expires_at,
          environmentsUsed: quota?.used_environments ?? 0,
          maxEnvironments: quota?.max_environments ?? 0,
        });
      } else if (quota) {
        // 如果没有订阅，使用配额中的默认值
        setCurrentPlan({
          id: 'free',
          expiresAt: undefined,
          environmentsUsed: quota.used_environments,
          maxEnvironments: quota.max_environments,
        });
      } else {
        setCurrentPlan(null);
      }
    } catch {
      // 忽略错误，设置为 null
      setCurrentPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentPlan();
  }, [fetchCurrentPlan]);

  return {
    currentPlan,
    loading,
    refresh: fetchCurrentPlan,
  };
}
