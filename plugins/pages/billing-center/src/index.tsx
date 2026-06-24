import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { billingResources } from './i18n/resources';
import { useState } from 'react';
import { WalletSkeleton } from './components/wallet-skeleton';
import { InvoicesSkeleton } from './components/invoices-skeleton';
import { WalletTab } from './components/wallet-tab';
import { InvoicesTab } from './components/invoices-tab';
import { BillingTabs } from './components/billing-tabs';
import { useBillingData } from './hooks/use-billing-data';
import { useBillingTabs } from './hooks/use-billing-tabs';
import { useInvoiceFiltersState } from './hooks/use-invoice-filters-state';
import { useInvoicesData } from './hooks/use-invoices-data';

const BillingCenterPage: React.FC = () => {
  const { t } = useTranslation('billing');
  const [currentPage, setCurrentPage] = useState(1);

  // Tab 管理
  const { activeTab, setActiveTab } = useBillingTabs();

  // 数据获取
  const { accountInfo, autoRenewalServices, loading, error, refresh } = useBillingData();

  // 过滤状态管理
  const filtersState = useInvoiceFiltersState(() => {
    setCurrentPage(1);
  });

  // 发票数据（整合了过滤、分页、统计、选择等逻辑）
  const invoicesData = useInvoicesData(filtersState.filters, currentPage, activeTab);

  return (
    <main className="flex flex-col h-[calc(100vh-50px)] min-w-0">
      {/* 顶部区域 - 包含 Tab 导航 */}
      <BillingTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-h-0">
        {error && <div className="px-6 py-2 text-xs text-destructive">{t('error', { error })}</div>}
        <div className="flex-1 flex flex-col min-h-0">
          {/* 钱包标签页 */}
          {activeTab === 'wallet' &&
            (loading || !accountInfo ? (
              <WalletSkeleton />
            ) : (
              <WalletTab
                account={accountInfo}
                autoRenewalServices={autoRenewalServices}
                onRefresh={refresh}
              />
            ))}

          {/* 账单标签页 */}
          {activeTab === 'invoices' &&
            (invoicesData.invoices.loading ? (
              <InvoicesSkeleton />
            ) : (
              <InvoicesTab
                invoices={invoicesData.invoices.invoices}
                loading={invoicesData.invoices.loading}
                error={invoicesData.invoices.error}
                searchQuery={filtersState.filters.searchQuery}
                statusFilter={filtersState.filters.statusFilter}
                typeFilter={filtersState.filters.typeFilter}
                startDate={filtersState.filters.startDate}
                endDate={filtersState.filters.endDate}
                currentPage={currentPage}
                totalPages={invoicesData.pagination.totalPages}
                paginatedInvoices={invoicesData.pagination.paginatedInvoices}
                stats={invoicesData.stats}
                invoiceTypes={invoicesData.invoiceTypes}
                onSearchChange={filtersState.setSearchQuery}
                onStatusFilterChange={filtersState.setStatusFilter}
                onTypeFilterChange={filtersState.setTypeFilter}
                onStartDateChange={filtersState.setStartDate}
                onEndDateChange={filtersState.setEndDate}
                onPageChange={setCurrentPage}
                onRefresh={invoicesData.invoices.refresh}
              />
            ))}
        </div>
      </div>
    </main>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'billing-center',
    value: {
      path: '/billing',
      Component: BillingCenterPage,
    },
    priority: 10,
  });
  console.log('[billing-center] Route contributed at module load: /billing');
} catch (error) {
  console.warn('[billing-center] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'billing-center',
    value: {
      namespace: 'billing',
      resources: billingResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[billing-center] Failed to contribute i18n resources:', error);
}

const billingCenterPlugin = {
  id: 'billing-center',
  name: 'Billing Center',
  version: '1.0.0',
  component: BillingCenterPage,
  slots: [],
};

export default billingCenterPlugin;
