import { useTranslation } from 'react-i18next';
import type { BillingPlan } from '../types';

interface PlanCardProps {
  plan: BillingPlan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
}

/**
 * 套餐选择卡片组件
 */
export function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  const { t } = useTranslation('plans');

  return (
    <div
      onClick={() => onSelect(plan.id)}
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${isSelected ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
        } ${plan.popular ? 'ring-1 ring-primary/20' : ''}`}
    >
      {plan.popular && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {plan.badge || t('badge.popular')}
          </span>
        </div>
      )}
      <div className="text-center">
        <h3 className="text-sm font-bold text-foreground mb-2">{plan.name}</h3>
        <p className="text-[10px] text-muted-foreground line-clamp-2">{plan.description}</p>
      </div>
    </div>
  );
}
