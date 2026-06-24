import { useState } from 'react';

type BillingTab = 'wallet' | 'invoices';

interface UseBillingTabsReturn {
  activeTab: BillingTab;
  setActiveTab: (tab: BillingTab) => void;
}

/**
 * 计费中心 Tab 切换逻辑 Hook
 */
export function useBillingTabs(onTabChange?: (tab: BillingTab) => void): UseBillingTabsReturn {
  const [activeTab, setActiveTabState] = useState<BillingTab>('wallet');

  const setActiveTab = (tab: BillingTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };

  return {
    activeTab,
    setActiveTab,
  };
}
