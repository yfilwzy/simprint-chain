import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { subscribePlan } from '../api';
import { DEFAULT_BILLING_PERIOD } from '../constants';

interface UseSubscribeReturn {
  subscribing: boolean;
  subscribe: (planId: string, paymentMethod?: string) => Promise<void>;
}

/**
 * 订阅操作 Hook
 */
export function useSubscribe(couponCode?: string, onSuccess?: () => void): UseSubscribeReturn {
  const { t } = useTranslation('plans');
  const [subscribing, setSubscribing] = useState(false);

  const subscribe = useCallback(
    async (planId: string, paymentMethod?: string) => {
      setSubscribing(true);
      try {
        await subscribePlan(planId, DEFAULT_BILLING_PERIOD, couponCode, paymentMethod);
        toast.success(t('subscribe.success', { plan: planId }));
        onSuccess?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('subscribe.error'));
        throw e;
      } finally {
        setSubscribing(false);
      }
    },
    [t, couponCode, onSuccess]
  );

  return {
    subscribing,
    subscribe,
  };
}
