import { useState, useCallback } from 'react';
import type { RewardStatusFilter, UserStatusFilter } from '../types';

export interface UseReferralFiltersReturn {
  // 奖励明细页过滤
  rewardPage: number;
  setRewardPage: (page: number) => void;
  rewardStatusFilter: RewardStatusFilter;
  setRewardStatusFilter: (filter: RewardStatusFilter) => void;
  rewardTypeFilter: string;
  setRewardTypeFilter: (filter: string) => void;
  rewardSearchQuery: string;
  setRewardSearchQuery: (query: string) => void;

  // 被邀请用户页过滤
  userPage: number;
  setUserPage: (page: number) => void;
  userStatusFilter: UserStatusFilter;
  setUserStatusFilter: (filter: UserStatusFilter) => void;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
}

export function useReferralFilters(): UseReferralFiltersReturn {
  const [rewardPage, setRewardPage] = useState(1);
  const [rewardStatusFilter, setRewardStatusFilter] = useState<RewardStatusFilter>('all');
  const [rewardTypeFilter, setRewardTypeFilter] = useState<string>('');
  const [rewardSearchQuery, setRewardSearchQuery] = useState('');

  const [userPage, setUserPage] = useState(1);
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const handleRewardSearchChange = useCallback((query: string) => {
    setRewardSearchQuery(query);
    setRewardPage(1);
  }, []);

  const handleUserSearchChange = useCallback((query: string) => {
    setUserSearchQuery(query);
    setUserPage(1);
  }, []);

  return {
    rewardPage,
    setRewardPage,
    rewardStatusFilter,
    setRewardStatusFilter,
    rewardTypeFilter,
    setRewardTypeFilter,
    rewardSearchQuery: rewardSearchQuery,
    setRewardSearchQuery: handleRewardSearchChange,
    userPage,
    setUserPage,
    userStatusFilter,
    setUserStatusFilter,
    userSearchQuery: userSearchQuery,
    setUserSearchQuery: handleUserSearchChange,
  };
}
