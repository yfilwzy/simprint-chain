import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import type { BillingPlan } from '../types';

interface PlanQuotaBarProps {
  plans: BillingPlan[];
  selectedPlan: BillingPlan | undefined;
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
}

/**
 * 环境配额显示条组件（参考创建环境的分段滑块设计）
 */
export function PlanQuotaBar({ plans, selectedPlan, selectedPlanId, onSelect }: PlanQuotaBarProps) {
  const { t } = useTranslation('plans');

  const maxQuota = plans.length > 0 ? Math.max(...plans.map((p) => p.environmentsLimit)) : 100;
  const environmentsLimit = selectedPlan?.environmentsLimit || 0;

  // 将套餐按配额排序
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => a.environmentsLimit - b.environmentsLimit);
  }, [plans]);

  // 计算每个套餐分段的位置和宽度（基于增量的智能缩放）
  const planSegments = useMemo(() => {
    if (sortedPlans.length === 0) return [];

    // 计算每个分段的增量（从上一个套餐到当前套餐的差值）
    const increments = sortedPlans.map((plan, index) => {
      const prevValue = index === 0 ? 0 : sortedPlans[index - 1].environmentsLimit;
      return {
        plan,
        increment: plan.environmentsLimit - prevValue,
      };
    });

    // 使用幂函数缩放增量（value^0.4，比平方根更激进，比对数更温和）
    // 这样可以让小增量占据更多空间，大增量占据更少空间
    const scaleIncrement = (increment: number, maxIncrement: number): number => {
      if (increment <= 0) return 0;
      if (maxIncrement <= 0) return 0;
      // 使用幂函数：increment^0.4 / maxIncrement^0.4
      const power = 0.3;
      return (Math.pow(increment, power) / Math.pow(maxIncrement, power)) * 100;
    };

    // 找到最大增量
    const maxIncrement = Math.max(...increments.map((inc) => inc.increment));

    // 计算每个增量的缩放宽度
    const scaledIncrements = increments.map((inc) => ({
      plan: inc.plan,
      scaledWidth: scaleIncrement(inc.increment, maxIncrement),
    }));

    // 计算总宽度，用于归一化到100%
    const totalScaledWidth = scaledIncrements.reduce((sum, inc) => sum + inc.scaledWidth, 0);

    // 计算每个分段的位置和宽度
    let currentPosition = 0;
    return scaledIncrements.map((item) => {
      const widthPercent = (item.scaledWidth / totalScaledWidth) * 100;
      const startPercent = currentPosition;
      const endPercent = currentPosition + widthPercent;
      currentPosition = endPercent;

      return {
        plan: item.plan,
        startPercent,
        endPercent,
        widthPercent,
        isSelected: item.plan.id === selectedPlanId,
      };
    });
  }, [sortedPlans, selectedPlanId]);

  // 计算当前选中套餐在分段中的位置
  const currentSegmentIndex = useMemo(() => {
    if (!selectedPlan) return -1;
    return planSegments.findIndex((seg) => seg.plan.id === selectedPlanId);
  }, [selectedPlan, selectedPlanId, planSegments]);

  // 计算分段渐变颜色（根据位置从浅到深）
  const getSegmentGradient = (startPercent: number, endPercent: number): string => {
    // 使用主题 primary 颜色，从 0.5 到 1.0 透明度
    const startOpacity = 0.5 + (startPercent / 100) * 0.5;
    const endOpacity = 0.5 + (endPercent / 100) * 0.5;
    const startColor = `rgba(37, 99, 235, ${startOpacity})`; // primary color #2563eb
    const endColor = `rgba(37, 99, 235, ${endOpacity})`;
    return `linear-gradient(to right, ${startColor}, ${endColor})`;
  };

  // 计算灰色渐变背景（根据位置从浅到深）
  const getGrayGradient = (startPercent: number, endPercent: number): string => {
    const startLightness = 245 - (startPercent / 100) * 20; // 245 -> 225
    const endLightness = 245 - (endPercent / 100) * 20;
    const startColor = `rgb(${startLightness}, ${startLightness + 1}, ${startLightness + 3})`;
    const endColor = `rgb(${endLightness}, ${endLightness + 1}, ${endLightness + 3})`;
    return `linear-gradient(to right, ${startColor}, ${endColor})`;
  };

  return (
    <div className="space-y-3">
      {/* 标题和配额 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{t('left.environmentQuota')}</span>
        {selectedPlan && (
          <span className="text-xs text-muted-foreground">
            {environmentsLimit} {t('left.environmentsUnit')}
          </span>
        )}
      </div>

      {/* 分段滑块样式（水平，参考创建环境的分段滑块） */}
      <div className="relative h-4 flex gap-0.5 select-none overflow-visible">
        {planSegments.map((segment, index) => {
          const isBeforeCurrent = index < currentSegmentIndex;
          const isCurrentSegment = index === currentSegmentIndex;
          const isAfterCurrent = index > currentSegmentIndex;

          // 计算当前段的高亮比例（0-1）
          // 如果完全在选中套餐之前，高亮比例为 1
          // 如果是当前段，高亮比例为 1（因为选中套餐就是当前段）
          // 如果在选中套餐之后，高亮比例为 0
          const highlightProgress = isBeforeCurrent ? 1 : isCurrentSegment ? 1 : 0;

          return (
            <button
              key={segment.plan.id}
              onClick={() => onSelect(segment.plan.id)}
              className="relative h-full overflow-hidden transition-all cursor-pointer group"
              style={{
                flex: `0 0 ${segment.widthPercent}%`,
                minWidth: 0,
                background: getGrayGradient(segment.startPercent, segment.endPercent),
                border: '1px solid transparent',
                borderRadius: '9999px',
                position: 'relative',
              }}
              title={`${segment.plan.name}: ${segment.plan.environmentsLimit} ${t('left.environmentsUnit')}`}
            >
              {/* 高亮部分 - 在段内部，使用 width 控制显示比例 */}
              {highlightProgress > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${highlightProgress * 100}%`,
                    background: getSegmentGradient(segment.startPercent, segment.endPercent),
                    borderRadius: '9999px',
                    // 如果未完全填充，添加右侧圆角遮罩
                    ...(highlightProgress < 1 && {
                      borderTopRightRadius: '9999px',
                      borderBottomRightRadius: '9999px',
                    }),
                  }}
                />
              )}

              {/* 选中状态的标记点 - 在段内部右侧 */}
              {segment.isSelected && (
                <div
                  className="absolute rounded-full bg-white border-2 border-primary shadow-lg z-20 pointer-events-none"
                  style={{
                    width: '12px',
                    height: '12px',
                    right: '2px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
