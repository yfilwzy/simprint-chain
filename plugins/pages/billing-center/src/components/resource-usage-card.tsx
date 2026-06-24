import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { ResourceUsage } from '../types';
import { getUsagePercentage, getUsageStatus } from '../utils/resource-usage';

interface ResourceUsageCardProps {
  resource: ResourceUsage;
}

/**
 * 资源使用情况卡片组件
 */
export function ResourceUsageCard({ resource }: ResourceUsageCardProps) {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const percentage = getUsagePercentage(resource.used, resource.limit);
  getUsageStatus(percentage); // 计算状态（虽然未使用，但保留逻辑）
  const Icon = resource.icon;

  return (
    <div className="bg-background border border-border rounded-lg p-4 relative">
      {/* 管理链接 - 右上角 */}
      {resource.link && (
        <button
          type="button"
          onClick={() => navigate(resource.link!)}
          className="absolute top-3 right-3 text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t('resources.manage')}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
      <div className="flex flex-col items-center gap-3">
        {/* 图标和名称 */}
        <div className="flex items-center gap-2 w-full">
          <Icon className={`h-4 w-4 ${resource.color}`} />
          <span className="text-xs font-medium text-foreground">{resource.name}</span>
        </div>

        {/* 圆形进度条 */}
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* 外层轮廓圆 */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-border"
            />
            {/* 背景圆 */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            {/* 进度圆 */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={2 * Math.PI * 40 - (percentage / 100) * (2 * Math.PI * 40)}
              className={`transition-all duration-500 ${
                percentage >= 90
                  ? 'text-destructive'
                  : percentage >= 70
                    ? 'text-warning'
                    : 'text-foreground'
              }`}
            />
          </svg>
          {/* 中心文本 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">{percentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* 使用量信息 */}
        <div className="flex flex-col items-center gap-1 w-full">
          <span
            className={`text-xs font-semibold ${
              percentage >= 90
                ? 'text-destructive'
                : percentage >= 70
                  ? 'text-warning'
                  : 'text-foreground'
            }`}
          >
            {resource.used}/{resource.limit} {resource.unit}
          </span>
        </div>
      </div>
    </div>
  );
}
