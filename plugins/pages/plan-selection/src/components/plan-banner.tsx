import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CurrentPlan, BillingPlan, ReferralPlanSummaryView } from '../types';

interface PlanBannerProps {
  currentPlan: CurrentPlan | null;
  plans: BillingPlan[];
  selectedPlanId?: string | null;
  referralSummary?: ReferralPlanSummaryView | null;
}

/**
 * 顶部状态横幅组件
 */
export function PlanBanner({
  currentPlan,
  plans,
  selectedPlanId,
  referralSummary,
}: PlanBannerProps) {
  const { t } = useTranslation('plans');

  if (!currentPlan) return null;

  // 获取选中套餐
  const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;

  // 如果有选中套餐，使用选中套餐的信息；否则使用当前套餐的信息
  const displayPlanName = selectedPlan
    ? selectedPlan.name
    : plans.find((p) => p.id === currentPlan.id)?.name || '免费';
  const displayMaxEnvironments = selectedPlan
    ? selectedPlan.environmentsLimit || 0
    : currentPlan.maxEnvironments || 0;

  // 实际使用的环境数量始终使用当前的实际使用量
  const usedEnvironments = currentPlan.environmentsUsed || 0;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="text-xs text-blue-900 dark:text-blue-100">
          {t('banner.current', {
            plan: displayPlanName,
            limit: displayMaxEnvironments,
          })}
          {'; '}
          {t('banner.usage', {
            used: usedEnvironments,
            total: displayMaxEnvironments,
          })}
        </div>
      </div>

      {referralSummary && referralSummary.referralValueLast30Days > 0 && (
        <div className="pl-6 text-[11px] text-blue-900/80 dark:text-blue-100/80">
          {referralSummary.currentPlanMonthlyPrice && referralSummary.coverageRatio != null
            ? t('banner.referralCoverage', {
                value: referralSummary.referralValueLast30Days.toFixed(2),
                coverage: Math.min(referralSummary.coverageRatio, 1) * 100,
              })
            : t('banner.referralValueOnly', {
                value: referralSummary.referralValueLast30Days.toFixed(2),
              })}
        </div>
      )}
    </div>
  );
}
