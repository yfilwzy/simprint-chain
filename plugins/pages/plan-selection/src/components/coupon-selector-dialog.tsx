import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, Check } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
// @ts-ignore - Cross-plugin import
import { getAvailableCoupons } from '../../../billing-center/src/api';
// @ts-ignore - Cross-plugin import
import type { UserCoupon } from '../../../billing-center/src/api/index.types';

interface CouponSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCouponCode?: string;
  onSelect: (couponCode: string | null) => void;
}

/**
 * 优惠券选择弹窗组件
 */
export function CouponSelectorDialog({
  open,
  onOpenChange,
  selectedCouponCode,
  onSelect,
}: CouponSelectorDialogProps) {
  const { t, i18n } = useTranslation('plans');
  const [allCoupons, setAllCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadCoupons();
    }
  }, [open]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await getAvailableCoupons();
      setAllCoupons(data || []);
    } catch (error) {
      console.error('获取优惠券失败:', error);
      setAllCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDiscount = (coupon: UserCoupon) => {
    let value: number;
    if (typeof coupon.discount_value === 'string') {
      value = parseFloat(coupon.discount_value);
    } else if (typeof coupon.discount_value === 'number') {
      value = coupon.discount_value;
    } else {
      value = 0;
    }

    if (isNaN(value) || value == null) {
      return '-$0.00';
    }

    if (coupon.discount_type === 'percentage') {
      return `-${value}%`;
    } else {
      return `-$${value.toFixed(2)}`;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';
    return date.toLocaleDateString(locale);
  };

  const handleSelect = (coupon: UserCoupon) => {
    if (selectedCouponCode === coupon.code) {
      // 如果已选中，则取消选择
      onSelect(null);
    } else {
      onSelect(coupon.code);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[520px]"
      header={{
        icon: Ticket,
        iconColor: 'text-blue-500',
        title: t('couponSelector.title'),
        description: t('couponSelector.description'),
      }}
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : allCoupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
            <Ticket className="h-8 w-8 text-blue-500/60" />
          </div>
          <h4 className="text-sm font-medium text-foreground mb-1">{t('couponSelector.noCoupons')}</h4>
          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            {t('couponSelector.noCouponsDescription')}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] -mx-1 px-1">
          <div className="space-y-2">
            {allCoupons.map((coupon) => {
                  const isSelected = selectedCouponCode === coupon.code;
                  return (
                    <div
                      key={coupon.id}
                      className={`relative overflow-hidden rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent hover:border-primary/40'
                      }`}
                      onClick={() => handleSelect(coupon)}
                    >
                      {/* 选中标记 */}
                      {isSelected && (
                        <div className="absolute right-2 top-2 z-20">
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}

                      {/* 背景装饰 */}
                      <div className="absolute right-2 top-2 opacity-10">
                        <Ticket className="h-12 w-12 text-primary" />
                      </div>

                      {/* 内容 */}
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 pr-6">
                            <div className="flex items-center gap-2 mb-1">
                              <Ticket className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">
                                {coupon.name || coupon.code || t('couponSelector.unknown')}
                              </span>
                            </div>
                            {coupon.description && (
                              <div className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
                                {coupon.description}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mb-2">
                              {formatDiscount(coupon)}
                              {coupon.min_amount != null && (() => {
                                const minAmount =
                                  typeof coupon.min_amount === 'string'
                                    ? parseFloat(coupon.min_amount)
                                    : coupon.min_amount;
                                return minAmount != null && !isNaN(minAmount) && minAmount > 0 ? (
                                  <span className="ml-1">
                                    {t('couponSelector.minAmount', {
                                      amount: minAmount.toFixed(2),
                                    })}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                        {coupon.expires_at && (
                          <div className="text-[10px] text-muted-foreground">
                            {t('couponSelector.expiresAt', {
                              date: formatDate(coupon.expires_at),
                            })}
                          </div>
                        )}
                      </div>
                    </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onOpenChange(false)}
        >
          {t('couponSelector.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          {t('couponSelector.confirm')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
