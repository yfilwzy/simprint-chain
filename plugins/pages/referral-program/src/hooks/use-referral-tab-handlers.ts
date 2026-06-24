import { useCallback } from 'react';
import type { RewardStatusFilter, UserStatusFilter } from '../types';
import type { UseReferralFiltersReturn } from './use-referral-filters';

export interface UseReferralTabHandlersParams {
  filters: UseReferralFiltersReturn;
  rewardTotalPages: number;
  userTotalPages: number;
}

export interface UseReferralTabHandlersReturn {
  // 奖励相关处理函数
  handleRewardSearchChange: (query: string) => void;
  handleRewardStatusFilterChange: (filter: RewardStatusFilter) => void;
  handleRewardTypeFilterChange: (filter: string) => void;
  handleRewardPageChange: (page: number) => void;

  // 用户相关处理函数
  handleUserSearchChange: (query: string) => void;
  handleUserStatusFilterChange: (filter: UserStatusFilter) => void;
  handleUserPageChange: (page: number) => void;
}

/**
 * Tab 相关事件处理 Hook
 * 整合所有 Tab 相关的事件处理函数
 */
export function useReferralTabHandlers(
  params: UseReferralTabHandlersParams
): UseReferralTabHandlersReturn {
  const { filters, rewardTotalPages, userTotalPages } = params;

  // 奖励相关处理函数
  const handleRewardSearchChange = useCallback(
    (query: string) => {
      filters.setRewardSearchQuery(query);
    },
    [filters]
  );

  const handleRewardStatusFilterChange = useCallback(
    (filter: RewardStatusFilter) => {
      filters.setRewardStatusFilter(filter);
    },
    [filters]
  );

  const handleRewardTypeFilterChange = useCallback(
    (filter: string) => {
      filters.setRewardTypeFilter(filter);
    },
    [filters]
  );

  const handleRewardPageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > Math.max(rewardTotalPages, 1)) return;
      filters.setRewardPage(page);
    },
    [filters, rewardTotalPages]
  );

  // 用户相关处理函数
  const handleUserSearchChange = useCallback(
    (query: string) => {
      filters.setUserSearchQuery(query);
    },
    [filters]
  );

  const handleUserStatusFilterChange = useCallback(
    (filter: UserStatusFilter) => {
      filters.setUserStatusFilter(filter);
    },
    [filters]
  );

  const handleUserPageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > Math.max(userTotalPages, 1)) return;
      filters.setUserPage(page);
    },
    [filters, userTotalPages]
  );

  return {
    handleRewardSearchChange,
    handleRewardStatusFilterChange,
    handleRewardTypeFilterChange,
    handleRewardPageChange,
    handleUserSearchChange,
    handleUserStatusFilterChange,
    handleUserPageChange,
  };
}
