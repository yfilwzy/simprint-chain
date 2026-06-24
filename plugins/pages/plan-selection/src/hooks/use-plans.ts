import { useState, useEffect, useCallback } from 'react';
import type { BillingPlan } from '../types';
import { getPlans } from '../api';
import { transformPlanWithFeatures } from '../utils/plan-transform';

interface UsePlansReturn {
  plans: BillingPlan[];
  currentPlanId?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UsePlansParams {
  couponCode?: string;
  billingPeriod?: string;
}

/**
 * 获取套餐列表的 Hook
 */
export function usePlans(params?: UsePlansParams): UsePlansReturn {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPlans(params?.couponCode, params?.billingPeriod || 'monthly');
      const transformedPlans = result.plans.map(transformPlanWithFeatures);
      setPlans(transformedPlans);
      // TODO: 如果后端返回 currentPlanId，需要从响应中提取
      setCurrentPlanId(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取套餐列表失败');
    } finally {
      setLoading(false);
    }
  }, [params?.couponCode, params?.billingPeriod]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    currentPlanId,
    loading,
    error,
    refresh: fetchPlans,
  };
}
