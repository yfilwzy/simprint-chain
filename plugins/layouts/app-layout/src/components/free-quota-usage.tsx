import { useEffect, useState } from 'react';
import { AlertCircle, Package } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore, useRefreshStore } from '../../../../services/store/src';
import { getWorkspaceQuota, type WorkspaceQuotaDto } from '../api/workspace-quotas';

interface FreeQuotaUsageProps {
  collapsed: boolean;
  currentPath: string;
}

// 折叠状态下的套餐选择按钮数据
const getCollapsedButtonsData = (t: (key: string) => string) => [
  {
    label: t('quota.planSelection'),
    href: '/plans',
    icon: Package,
    tooltip: t('quota.planSelection'),
  },
];

/**
 * 免费额度使用情况组件
 */
export const FreeQuotaUsage: React.FC<FreeQuotaUsageProps> = ({ collapsed, currentPath }) => {
  const { t } = useTranslation('appLayout');
  const workspacesRefreshKey = useRefreshStore((state) => state.workspaces);
  const [quota, setQuota] = useState<WorkspaceQuotaDto | null>(null);
  const [loading, setLoading] = useState(false);

  // 当侧边栏展开时，从服务器加载配额信息
  useEffect(() => {
    if (!collapsed) {
      setLoading(true);
      void getWorkspaceQuota({})
        .then((data) => {
          setQuota(data);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to load workspace quota:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [collapsed, workspacesRefreshKey]);

  const total = quota?.max_environments ?? 6;
  const used = quota?.used_environments ?? 0;
  const percentage = total > 0 ? (used / total) * 100 : 0;

  if (collapsed) {
    // 折叠状态下显示三个图标按钮
    const collapsedButtonsData = getCollapsedButtonsData(t);
    return (
      <div className="m-1 space-y-1">
        {collapsedButtonsData.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  className={`group relative rounded-lg h-11 px-3 text-sm transition-all duration-300 ease-in-out flex flex-row items-center justify-center w-11 ${
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold border-primary'
                      : 'text-sidebar-foreground/80 hover:bg-accent/60 hover:text-foreground border-transparent'
                  }`}
                >
                  {isActive && <div className='absolute -right-1 bg-primary w-1 h-6 rounded-2xl'>&nbsp;</div>}
                  <item.icon
                    className={`h-4 w-4 transition-all duration-200 ${
                      isActive ? 'text-primary' : 'text-sidebar-foreground opacity-80'
                    }`}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // 展开状态下显示完整内容
  return (
    <Link
      to="/plans"
      className="block bg-sidebar border border-sidebar-border/80 space-y-4 py-2 rounded-md mx-1 cursor-pointer mb-2"
    >
      {/* 使用剩余环境的进度 */}
      <div className="px-2 space-y-2">
        {/* 免费用量 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-sidebar-foreground/80">{t('quota.freeUsage')}</span>
            <div className="flex items-center gap-x-1">
              <div className="flex items-center gap-1.5 group/usage relative">
                <span className="text-[10px] font-medium text-sidebar-foreground">
                  {loading ? '--/--' : `${used}/${total}`}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-3 w-3 text-sidebar-foreground/50 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('quota.freeUsageDesc', { total, used })}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* 进度条 */}
          <div className="h-1.5 bg-sidebar-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: loading ? '0%' : `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

