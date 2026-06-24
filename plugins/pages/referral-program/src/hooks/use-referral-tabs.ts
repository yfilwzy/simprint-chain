import { useState } from 'react';
import type { ReferralTab } from '../types';

export interface UseReferralTabsReturn {
  activeTab: ReferralTab;
  setActiveTab: (tab: ReferralTab) => void;
}

export function useReferralTabs(): UseReferralTabsReturn {
  const [activeTab, setActiveTab] = useState<ReferralTab>('overview');

  return {
    activeTab,
    setActiveTab,
  };
}
