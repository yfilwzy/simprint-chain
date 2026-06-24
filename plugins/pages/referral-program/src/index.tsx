import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { referralResources } from './i18n/resources';
import { ReferralTabs } from './components/referral-tabs';
import { OverviewTab } from './components/overview-tab';
import { RewardsTab } from './components/rewards-tab';
import { UsersTab } from './components/users-tab';
import { RedeemDialog } from './components/redeem-dialog';
import { ReferralPageSkeleton } from './components/referral-page-skeleton';
import { useReferralDashboard } from './hooks/use-referral-dashboard';
import { useReferralRewards } from './hooks/use-referral-rewards';
import { useReferredUsers } from './hooks/use-referred-users';
import { useReferralTabs } from './hooks/use-referral-tabs';
import { useReferralFilters } from './hooks/use-referral-filters';
import { useReferralHandlers } from './hooks/use-referral-handlers';
import { useReferralComputed } from './hooks/use-referral-computed';
import { useReferralTabHandlers } from './hooks/use-referral-tab-handlers';

const ReferralProgramPage: React.FC = () => {
  const { t } = useTranslation('referral');

  // Tab 管理
  const { activeTab, setActiveTab } = useReferralTabs();

  // 数据获取：使用后端聚合的看板接口
  const {
    dashboard,
    loading,
    error,
    refresh: refreshDashboard,
  } = useReferralDashboard();

  // 过滤状态管理
  const filters = useReferralFilters();

  // 奖励数据（仅在 rewards tab 激活时获取）
  const shouldFetchRewards = activeTab === 'rewards';
  const rewardsData = useReferralRewards({
    page: filters.rewardPage,
    statusFilter: filters.rewardStatusFilter,
    typeFilter: filters.rewardTypeFilter,
    searchQuery: filters.rewardSearchQuery,
    enabled: shouldFetchRewards,
  });

  // 被邀请用户数据（仅在 users tab 激活时获取）
  const shouldFetchUsers = activeTab === 'users';
  const usersData = useReferredUsers({
    page: filters.userPage,
    statusFilter: filters.userStatusFilter,
    searchQuery: filters.userSearchQuery,
    enabled: shouldFetchUsers,
  });

  // 事件处理
  const handlers = useReferralHandlers({
    stats: dashboard?.stats ?? null,
    // 交给 Dashboard Hook 统一刷新
    onStatsUpdate: () => {
      void refreshDashboard();
    },
  });

  // 计算衍生数据
  const { currentLink, rewardTypes } = useReferralComputed({
    stats: dashboard?.stats ?? null,
    rewards: rewardsData.rewards,
  });

  // Tab 相关事件处理
  const tabHandlers = useReferralTabHandlers({
    filters,
    rewardTotalPages: rewardsData.totalPages,
    userTotalPages: usersData.totalPages,
  });

  return (
    <main className="flex flex-col h-[calc(100vh-50px)] min-w-0">
      {/* 顶部区域 - 包含 Tab 导航 */}
      <ReferralTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-h-0">
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-xs text-destructive">{t('error', { error })}</div>
          </div>
        )}
        {!error && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 概览标签页 */}
            {activeTab === 'overview' &&
              (loading || !dashboard?.stats ? (
                <ReferralPageSkeleton />
              ) : (
                <OverviewTab
                  stats={dashboard.stats}
                  currentLink={currentLink}
                  onRedeem={() => handlers.setRedeemDialogOpen(true)}
                  onSwitchLink={handlers.handleSwitchLink}
                  onCopy={handlers.handleCopy}
                />
              ))}

            {/* 奖励明细标签页 */}
            {activeTab === 'rewards' && (
              <RewardsTab
                rewards={rewardsData.rewards}
                loading={rewardsData.loading}
                totalPages={rewardsData.totalPages}
                currentPage={filters.rewardPage}
                statusFilter={filters.rewardStatusFilter}
                typeFilter={filters.rewardTypeFilter}
                searchQuery={filters.rewardSearchQuery}
                rewardTypes={rewardTypes}
                onRefresh={rewardsData.refresh}
                onPageChange={tabHandlers.handleRewardPageChange}
                onStatusFilterChange={tabHandlers.handleRewardStatusFilterChange}
                onTypeFilterChange={tabHandlers.handleRewardTypeFilterChange}
                onSearchChange={tabHandlers.handleRewardSearchChange}
              />
            )}

            {/* 被邀请用户标签页 */}
            {activeTab === 'users' && (
              <UsersTab
                users={usersData.users}
                loading={usersData.loading}
                totalPages={usersData.totalPages}
                currentPage={filters.userPage}
                statusFilter={filters.userStatusFilter}
                searchQuery={filters.userSearchQuery}
                links={dashboard?.stats.links || []}
                onRefresh={usersData.refresh}
                onPageChange={tabHandlers.handleUserPageChange}
                onStatusFilterChange={tabHandlers.handleUserStatusFilterChange}
                onSearchChange={tabHandlers.handleUserSearchChange}
              />
            )}
          </div>
        )}
      </div>

      {/* 兑换对话框 */}
      <RedeemDialog
        open={handlers.redeemDialogOpen}
        onOpenChange={handlers.setRedeemDialogOpen}
        stats={dashboard?.stats ?? null}
        redeemPoints={handlers.redeemPoints}
        redeemType={handlers.redeemType}
        onRedeemPointsChange={handlers.setRedeemPoints}
        onRedeemTypeChange={handlers.setRedeemType}
        onConfirm={handlers.handleRedeem}
      />
    </main>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'referral-program',
    value: {
      path: '/referral',
      Component: ReferralProgramPage,
    },
    priority: 10,
  });
  console.log('[referral-program] Route contributed at module load: /referral');
} catch (error) {
  console.warn('[referral-program] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'referral-program',
    value: {
      namespace: 'referral',
      resources: referralResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[referral-program] Failed to contribute i18n resources:', error);
}

const referralProgramPlugin = {
  id: 'referral-program',
  name: 'Referral Program',
  version: '1.0.0',
  component: ReferralProgramPage,
  slots: [],
};

export default referralProgramPlugin;
