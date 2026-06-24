import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type BillingTab = 'wallet' | 'invoices';

interface BillingTabsProps {
  activeTab: BillingTab;
  onTabChange: (tab: BillingTab) => void;
}

/**
 * 计费中心 Tab 导航组件
 */
export function BillingTabs({ activeTab, onTabChange }: BillingTabsProps) {
  const { t } = useTranslation('billing');

  const tabs: { value: BillingTab; key: string }[] = [
    { value: 'wallet', key: 'tabs.wallet' },
    { value: 'invoices', key: 'tabs.invoices' },
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
}
