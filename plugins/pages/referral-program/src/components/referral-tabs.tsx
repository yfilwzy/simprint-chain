import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ReferralTab } from '../types';

interface ReferralTabsProps {
  activeTab: ReferralTab;
  onTabChange: (tab: ReferralTab) => void;
}

export const ReferralTabs: React.FC<ReferralTabsProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation('referral');

  const tabs: { value: ReferralTab; key: string }[] = [
    { value: 'overview', key: 'tabs.overview' },
    { value: 'rewards', key: 'tabs.rewards' },
    { value: 'users', key: 'tabs.users' },
  ];

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background z-10">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-all duration-200',
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>
    </header>
  );
};
