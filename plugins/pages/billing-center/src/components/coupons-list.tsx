import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Ticket, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAvailableCoupons } from '../api';
import { CouponsDialog } from './coupons-dialog';
import type { UserCoupon } from '../api/index.types';

/**
 * 优惠券列表组件
 */
export function CouponsList() {
  const { t, i18n } = useTranslation('billing');
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await getAvailableCoupons();
      setCoupons(data || []);
    } catch (error) {
      console.error('获取优惠券失败:', error);
      setCoupons([]);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unused':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {t('coupons.status.unused')}
          </span>
        );
      case 'used':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {t('coupons.status.used')}
          </span>
        );
      case 'expired':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {t('coupons.status.expired')}
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t('coupons.title')}</h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t('coupons.title')}</h3>
        </div>
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t('coupons.noCoupons')}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 text-xs"
            onClick={() => navigate('/plans')}
          >
            {t('coupons.viewPlans')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{t('coupons.title')}</h3>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          onClick={() => setDialogOpen(true)}
        >
          {t('coupons.viewAll')}
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {coupons.slice(0, 5).map((coupon) => (
          <div
            key={coupon.id}
            className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-3 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => navigate(`/plans?coupon=${coupon.code}`)}
          >
            {/* 背景装饰 */}
            <div className="absolute right-2 top-2 opacity-10">
              <Ticket className="h-12 w-12 text-primary" />
            </div>

            {/* 内容 */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {coupon.name || coupon.code || t('coupons.unknown')}
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
                      const minAmount = typeof coupon.min_amount === 'string' 
                        ? parseFloat(coupon.min_amount) 
                        : coupon.min_amount;
                      return minAmount != null && !isNaN(minAmount) && minAmount > 0 ? (
                        <span className="ml-1">
                          {t('coupons.minAmount', { amount: minAmount.toFixed(2) })}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                {getStatusBadge(coupon.status)}
              </div>
              {coupon.expires_at && (
                <div className="text-[10px] text-muted-foreground">
                  {t('coupons.expiresAt', {
                    date: new Date(coupon.expires_at).toLocaleDateString(
                      i18n.language === 'en-US' ? 'en-US' : 'zh-CN'
                    ),
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <CouponsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
