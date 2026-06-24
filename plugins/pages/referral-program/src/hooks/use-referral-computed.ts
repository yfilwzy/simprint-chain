import { useMemo } from 'react';
import type { ReferralStats, ReferralLink, ReferralReward } from '../types';

export interface UseReferralComputedParams {
  stats: ReferralStats | null;
  rewards: ReferralReward[];
}

export interface UseReferralComputedReturn {
  currentLink: ReferralLink | null;
  rewardTypes: string[];
}

/**
 * 计算衍生数据的 Hook
 */
export function useReferralComputed(params: UseReferralComputedParams): UseReferralComputedReturn {
  const { stats, rewards } = params;

  // 获取当前选中的推广链接
  const currentLink = useMemo(() => {
    if (!stats) return null;
    return stats.links.find((l) => l.id === stats.currentLinkId) || stats.links[0];
  }, [stats]);

  // 奖励类型选项
  const rewardTypes = useMemo(() => {
    const types = new Set(rewards.map((r) => r.type));
    return Array.from(types);
  }, [rewards]);

  return {
    currentLink,
    rewardTypes,
  };
}
