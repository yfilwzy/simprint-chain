import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Package, Crown, Zap, Globe, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountInfo } from '../types';

interface CurrentPlanCardProps {
  account: AccountInfo;
}

/**
 * 当前套餐信息卡片组件
 */
export function CurrentPlanCard({ account }: CurrentPlanCardProps) {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();

  return (
    <div>
      <div className="bg-background border border-border rounded-lg p-4 h-48 relative overflow-hidden">
        {/* 背景装饰图标 */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          {account.planId === 'free' ? (
            <>
              <Package className="absolute top-4 right-8 w-24 h-24 text-primary" />
              <Zap className="absolute bottom-6 left-6 w-16 h-16 text-primary" />
            </>
          ) : (
            <>
              <Crown className="absolute top-4 right-8 w-24 h-24 text-primary" />
              <Sparkles className="absolute bottom-6 left-6 w-16 h-16 text-primary" />
              <TrendingUp className="absolute top-1/2 right-12 w-12 h-12 text-primary transform -translate-y-1/2" />
            </>
          )}
        </div>
        <div className="flex flex-col justify-between h-full relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {account.planId === 'free' ? (
                <Package className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Crown className="h-4 w-4 text-primary" />
              )}
              <span className="text-sm text-muted-foreground">{account.planName}</span>
            </div>
            <div className="text-2xl font-bold text-foreground mb-2">
              {account.environmentsLimit} {t('currentPlan.windows')}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>
                  {t('dailyLimits.create')}: {account.dailyCreateLimit}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>
                  {t('dailyLimits.open')}: {account.dailyOpenLimit}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center gap-3">
            {account.planId === 'free' && (
              <div className="text-xs text-muted-foreground">{t('currentPlan.premiumPrompt')}</div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => navigate('/plans')}
            >
              {account.planId === 'free' ? t('currentPlan.purchase') : t('currentPlan.change')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
