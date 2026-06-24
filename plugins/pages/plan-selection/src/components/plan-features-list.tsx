import { useTranslation } from 'react-i18next';
import type { BillingPlan } from '../types';
import { getFeatureIcon } from '../utils/plan-price';

interface PlanFeaturesListProps {
  plan: BillingPlan;
}

/**
 * 详细功能列表组件
 */
export function PlanFeaturesList({ plan }: PlanFeaturesListProps) {
  const { t } = useTranslation('plans');

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">{t('left.features')}</h2>
      <div className="grid grid-cols-3 gap-4">
        {plan.features.map((feature) => {
          const Icon = getFeatureIcon(feature.id);
          return (
            <div key={feature.id} className="flex items-start gap-2">
              <Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-medium text-foreground">{feature.name}</span>
                {feature.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{feature.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
