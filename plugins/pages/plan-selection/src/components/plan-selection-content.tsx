import { useTranslation } from 'react-i18next';
import type { BillingPlan } from '../types';
import { PlanCard } from './plan-card';
import { PlanQuotaBar } from './plan-quota-bar';
import { PlanFeaturesList } from './plan-features-list';

interface PlanSelectionContentProps {
  plans: BillingPlan[];
  selectedPlanId: string | null;
  selectedPlan: BillingPlan | undefined;
  onSelect: (planId: string) => void;
}

/**
 * 左侧套餐选择内容组件
 */
export function PlanSelectionContent({
  plans,
  selectedPlanId,
  selectedPlan,
  onSelect,
}: PlanSelectionContentProps) {
  const { t } = useTranslation('plans');

  return (
    <div className="flex-1 w-2/3 p-6 space-y-6 overflow-y-auto">
      {/* 套餐选择卡片 */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('left.selectPlan')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {/* 环境配额显示 */}
      <PlanQuotaBar
        plans={plans}
        selectedPlan={selectedPlan}
        selectedPlanId={selectedPlanId}
        onSelect={onSelect}
      />

      {/* 分割线 */}
      <div className="border-t border-border" />

      {/* 详细功能列表 */}
      {selectedPlan && <PlanFeaturesList plan={selectedPlan} />}
    </div>
  );
}
