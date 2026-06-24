import type { ResourceUsage } from '../types';
import { Globe, Users } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AccountInfo } from '../types';

/**
 * 计算资源使用情况
 */
export function calculateResourceUsages(
  account: AccountInfo | null,
  t: TFunction<'billing'>
): ResourceUsage[] {
  if (!account) return [];

  return [
    {
      name: t('resources.environments'),
      used: account.environmentsUsed,
      limit: account.environmentsLimit,
      unit: t('resources.unit'),
      icon: Globe,
      color: 'text-muted-foreground',
      link: '/',
    },
    {
      name: t('resources.teamMembers'),
      used: account.teamMembersUsed,
      limit: account.teamMembersLimit,
      unit: t('resources.unit'),
      icon: Users,
      color: 'text-muted-foreground',
      link: '/team',
    },
    {
      name: t('resources.proxies'),
      used: account.proxyCount,
      limit: account.proxyLimit,
      unit: t('resources.unit'),
      icon: Globe,
      color: 'text-muted-foreground',
      link: '/proxy',
    },
  ];
}

/**
 * 计算使用百分比
 */
export function getUsagePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

/**
 * 获取使用状态样式
 */
export function getUsageStatus(percentage: number): { color: string; bg: string } {
  if (percentage >= 90) return { color: 'text-destructive', bg: 'bg-destructive/10' };
  if (percentage >= 70) return { color: 'text-warning', bg: 'bg-warning/10' };
  return { color: 'text-primary', bg: 'bg-primary/10' };
}
