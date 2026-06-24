import { CreditCard, Ticket, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import type { BillingPlan, CurrentPlan, PlanPriceInfo } from '../types';
import type { PaymentMethod } from './payment-dialog';

interface PlanDetailsPanelProps {
  plan: BillingPlan;
  priceInfo: PlanPriceInfo;
  currentPlan: CurrentPlan | null;
  agreed: boolean;
  subscribing: boolean;
  couponCode?: string;
  onAgreedChange: (agreed: boolean) => void;
  onPayment: () => void;
  onOpenCouponSelector: () => void;
}

/**
 * 右侧套餐详情面板组件
 */
export function PlanDetailsPanel({
  plan,
  priceInfo,
  currentPlan,
  agreed,
  subscribing,
  couponCode,
  onAgreedChange,
  onPayment,
  onOpenCouponSelector,
}: PlanDetailsPanelProps) {
  const { t } = useTranslation('plans');

  return (
    <div className="w-1/3 bg-background rounded-lg border p-6 space-y-6 overflow-y-auto">
      {/* 套餐详情部分 */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('right.details')}</h2>
        <div className="space-y-3">
          {/* 环境数量 */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">
              {t('right.environments')}
            </div>
            <div className="text-sm font-bold text-foreground">{plan.environmentsLimit}</div>
          </div>

          {/* 订阅时长 */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">
              {t('right.subscriptionDuration')}
            </div>
            <div className="text-sm font-medium text-foreground">{t('right.durationValue')}</div>
          </div>

          {/* 到期时间 */}
          {currentPlan?.expiresAt && (
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                {t('right.expiresAt')}
              </div>
              <div className="text-sm font-medium text-foreground">
                {new Date(currentPlan.expiresAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 分割线 */}
      <div className="border-t border-border" />

      {/* 价格信息部分 */}
      <div className="space-y-3">
        {/* 首购折扣 */}
        {priceInfo.discountPercent && (
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">
              {t('right.firstPurchaseDiscount')}
            </div>
            <div className="text-sm font-semibold text-orange-500">
              -{priceInfo.discountPercent}%
            </div>
          </div>
        )}

        {/* 套餐原价 */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">
            {t('right.originalPrice')}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-muted-foreground">
              ${priceInfo.originalPrice.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/{t('price.unit')}</span>
          </div>
        </div>

        {/* 实际价格（突出显示） */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">{t('right.actualPrice')}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-primary">
              ${priceInfo.actualPrice.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/{t('price.unit')}</span>
          </div>
        </div>

        {/* 节省金额 */}
        {priceInfo.savedAmount > 0 && (
          <div className="text-xs text-muted-foreground">
            {t('right.savedAmount', { amount: priceInfo.savedAmount.toFixed(2) })}
          </div>
        )}

        {/* 优惠券信息 */}
        <div className="space-y-2">
          {couponCode ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 flex-1">
                <Ticket className="h-3.5 w-3.5 text-primary" />
                <div className="text-xs font-medium text-primary">
                  {t('right.couponApplied', { code: couponCode })}
                </div>
              </div>
              <button
                onClick={onOpenCouponSelector}
                className="h-5 w-5 flex items-center justify-center rounded-md text-primary hover:bg-primary/20 transition-colors"
                title={t('right.changeCoupon')}
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenCouponSelector}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs text-primary"
            >
              <Ticket className="h-3.5 w-3.5" />
              {t('right.useCoupon')}
            </button>
          )}
        </div>
      </div>

      {/* 支付按钮 */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-start gap-2 mb-4">
          <Checkbox
            id="agreement"
            checked={agreed}
            onCheckedChange={(checked) => onAgreedChange(checked === true)}
          />
          <label
            htmlFor="agreement"
            className="text-[10px] text-muted-foreground leading-relaxed cursor-pointer"
          >
            {t('right.agreement.text')}{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // TODO: 打开用户协议
              }}
              className="text-primary hover:underline"
            >
              {t('right.agreement.link')}
            </a>
          </label>
        </div>
        <Button
          className="w-full"
          onClick={onPayment}
          disabled={subscribing || !agreed}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {subscribing ? t('subscribe.processing') : t('subscribe.button')}
        </Button>
      </div>
    </div>
  );
}
