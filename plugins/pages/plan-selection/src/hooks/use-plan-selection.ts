import { useState, useCallback } from 'react';
import type { BillingPlan } from '../types';

interface UsePlanSelectionReturn {
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;
  selectedPlan: BillingPlan | undefined;
  initializeSelection: (plans: BillingPlan[], currentPlanId?: string) => void;
}

/**
 * 套餐选择状态管理 Hook
 */
export function usePlanSelection(plans: BillingPlan[]): UsePlanSelectionReturn {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const initializeSelection = useCallback(
    (plansToSelect: BillingPlan[], currentPlanId?: string) => {
      if (currentPlanId && plansToSelect.some((p) => p.id === currentPlanId)) {
        // 如果 currentPlanId 存在且在套餐列表中，选择它
        setSelectedPlanId(currentPlanId);
      } else if (plansToSelect.length > 0) {
        // 否则默认选择第一个套餐
        setSelectedPlanId(plansToSelect[0].id);
      }
    },
    []
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return {
    selectedPlanId,
    setSelectedPlanId,
    selectedPlan,
    initializeSelection,
  };
}
