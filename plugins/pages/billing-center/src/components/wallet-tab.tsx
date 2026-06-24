import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WalletCard } from './wallet-card';
import { CurrentPlanCard } from './current-plan-card';
import { ResourceUsageCard } from './resource-usage-card';
import { AutoRenewalServices } from './auto-renewal-services';
import { CouponsList } from './coupons-list';
import { calculateResourceUsages } from '../utils/resource-usage';
import type { AccountInfo, AutoRenewalService } from '../types';

interface WalletTabProps {
  account: AccountInfo;
  autoRenewalServices: AutoRenewalService[];
  onRefresh: () => void;
}

/**
 * 钱包标签页组件
 */
export function WalletTab({
  account,
  autoRenewalServices,
  onRefresh,
}: WalletTabProps) {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const resourceUsages = calculateResourceUsages(account, t);

  return (
    <div className="m-4 ml-0">
      <div className="flex h-[calc(100vh-120px)]">
        {/* 左侧内容 - 2/3 宽度 */}
        <div className="flex-1 w-2/3 p-4 py-0 space-y-4 h-full">
          {/* 当前套餐信息 */}
          <CurrentPlanCard account={account} />

          {/* 资源使用情况 */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">{t('resources.title')}</h2>
            <div className="grid grid-cols-3 gap-4">
              {resourceUsages.map((resource) => (
                <ResourceUsageCard key={resource.name} resource={resource} />
              ))}
            </div>
          </div>

          {/* 自动续订服务 */}
          <AutoRenewalServices services={autoRenewalServices} />
        </div>

        {/* 右侧内容 - 1/3 宽度 */}
        <div className="w-1/3 bg-background rounded-lg border p-4 space-y-8">
          {/* 钱包信息 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t('wallet.title')}</h3>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {/* 银行卡样式 - 使用 WalletCard 组件 */}
            <WalletCard balance={account.walletBalance} giftBalance={account.giftBalance} />
            <Button className="w-full" size="sm" onClick={() => navigate('/plans')}>
              {t('wallet.recharge')}
            </Button>
          </div>

          {/* 分割线 */}
          <div className="border-t border-border" />

          {/* 优惠券列表 */}
          <CouponsList />

          {/* 月结费用 */}
          {account.monthlyBilling > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('monthly.title')}</h3>
              <div className="text-2xl font-bold text-foreground mb-2">
                ${account.monthlyBilling.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {t('monthly.basicPackage')}: ${account.monthlyBilling.toFixed(2)}
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs">
                {t('monthly.upgrade')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
