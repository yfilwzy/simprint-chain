import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { planResources } from './i18n/resources';
import { useState, useEffect, useMemo } from 'react';
import { PlanSelectionSkeleton } from './components/plan-selection-skeleton';
import { PlanBanner } from './components/plan-banner';
import { PlanSelectionContent } from './components/plan-selection-content';
import { PlanDetailsPanel } from './components/plan-details-panel';
import { PaymentDialog, type PaymentMethod } from './components/payment-dialog';
import { RechargeDialog } from './components/recharge-dialog';
import { CouponSelectorDialog } from './components/coupon-selector-dialog';
import { usePlans } from './hooks/use-plans';
import { useCurrentPlan } from './hooks/use-current-plan';
import { usePlanSelection } from './hooks/use-plan-selection';
import { useSubscribe } from './hooks/use-subscribe';
import { getPlanPriceInfo } from './utils/plan-price';
import { getReferralPlanSummary } from './api';
import type { ReferralPlanSummaryView } from './types';

const PlanSelectionPage: React.FC = () => {
  const { t } = useTranslation('plans');
  const [searchParams, setSearchParams] = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(0);
  const [couponSelectorOpen, setCouponSelectorOpen] = useState(false);
  const [referralSummary, setReferralSummary] = useState<ReferralPlanSummaryView | null>(null);
  
  // 从路由参数读取优惠券代码
  const couponCode = searchParams.get('coupon') || undefined;
  
  // 处理优惠券选择
  const handleCouponSelect = (code: string | null) => {
    if (code) {
      setSearchParams({ coupon: code }, { replace: true });
    } else {
      // 移除优惠券参数
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('coupon');
      setSearchParams(newParams, { replace: true });
    }
  };

  // 数据获取（传入优惠券代码，优惠券变化时自动重新加载）
  const { plans, currentPlanId: plansCurrentPlanId, loading, error } = usePlans({
    couponCode,
    billingPeriod: 'monthly', // 默认使用月度计费
  });
  const { currentPlan, refresh: refreshCurrentPlan } = useCurrentPlan();

  // 套餐选择
  const { selectedPlanId, setSelectedPlanId, selectedPlan, initializeSelection } =
    usePlanSelection(plans);

  // 订阅操作（传入优惠券代码）
  const { subscribing, subscribe } = useSubscribe(couponCode, async () => {
    // 订阅成功后，延迟一下再刷新，确保后端数据已更新
    await new Promise((resolve) => setTimeout(resolve, 500));
    await refreshCurrentPlan();
  });

  // 初始化选择
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      // 优先使用 plans API 返回的 currentPlanId，否则使用 currentPlan?.id
      // 如果 currentPlanId 不在 plans 列表中或为空，则选择第一个套餐
      const currentPlanId = plansCurrentPlanId || currentPlan?.id;
      const planExists = 
        currentPlanId && 
        typeof currentPlanId === 'string' && 
        currentPlanId.trim() !== '' && 
        plans.some((p) => p.id === currentPlanId);
      initializeSelection(plans, planExists ? currentPlanId : undefined);
    }
  }, [plans, selectedPlanId, plansCurrentPlanId, currentPlan?.id, initializeSelection]);

  // 加载推广摘要（与当前订阅绑定）
  useEffect(() => {
    const loadReferralSummary = async () => {
      try {
        const summary = await getReferralPlanSummary();
        if (!summary) {
          setReferralSummary(null);
          return;
        }
        const referralValue =
          typeof summary.referral_value_last_30_days === 'string'
            ? parseFloat(summary.referral_value_last_30_days)
            : summary.referral_value_last_30_days;
        const planPriceRaw = summary.current_plan_monthly_price;
        const planPrice =
          planPriceRaw == null
            ? null
            : typeof planPriceRaw === 'string'
              ? parseFloat(planPriceRaw)
              : planPriceRaw;
        const coverageRaw = summary.coverage_ratio;
        const coverage =
          coverageRaw == null
            ? null
            : typeof coverageRaw === 'string'
              ? parseFloat(coverageRaw)
              : coverageRaw;

        setReferralSummary({
          referralValueLast30Days: Number.isFinite(referralValue) ? referralValue : 0,
          currentPlanMonthlyPrice: planPrice,
          coverageRatio: coverage,
        });
      } catch {
        // 推广摘要失败不影响套餐页面主流程
        setReferralSummary(null);
      }
    };

    void loadReferralSummary();
  }, []);

  // 价格计算
  const priceInfo = useMemo(() => {
    if (!selectedPlan) return null;
    return getPlanPriceInfo(selectedPlan);
  }, [selectedPlan]);

  // 处理支付弹窗打开
  const handlePayment = () => {
    if (!selectedPlanId) return;
    if (!agreed) {
      toast.warning(t('subscribe.agreementRequired'));
      return;
    }
    setPaymentDialogOpen(true);
  };

  // 处理支付
  const handlePaymentConfirm = async (method: PaymentMethod) => {
    if (!selectedPlanId) return;

    try {
      if (method === 'wallet') {
        // 钱包支付，直接订阅
        await subscribe(selectedPlanId, 'wallet');
      } else {
        // TODO: 对接支付接口
        // 当前为开发阶段，直接模拟支付成功
        // 实际实现时需要：
        // 1. 调用后端创建支付订单接口
        // 2. 根据支付方式跳转到对应的支付页面（支付宝/微信）
        // 3. 处理支付回调
        // 4. 支付成功后调用订阅接口

        // 模拟支付成功
        await new Promise((resolve) => setTimeout(resolve, 1000));
        toast.success(t('payment.success', { method: t(`payment.${method}`) }));
        // 传递支付方式参数，后端将跳过钱包余额检查
        await subscribe(selectedPlanId, method);
      }
    } catch (error) {
      // 错误已在 subscribe Hook 中处理
    }
  };

  // 处理充值
  const handleRecharge = (amount: number) => {
    setRechargeAmount(amount);
    setRechargeDialogOpen(true);
  };

  // 充值成功后刷新钱包余额（支付弹窗会重新获取）
  const handleRechargeSuccess = () => {
    // 充值成功后，重新打开支付弹窗
    setPaymentDialogOpen(true);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto">
        {loading && <PlanSelectionSkeleton />}
        {error && (
          <div className="flex items-center justify-center h-full text-sm text-destructive">
            {t('error', { error })}
          </div>
        )}
        {!loading && !error && (
          <div className="w-4/5 mx-auto my-4 space-y-4">
            {/* 顶部状态横幅 */}
            <PlanBanner
              currentPlan={currentPlan}
              plans={plans}
              selectedPlanId={selectedPlanId}
              referralSummary={referralSummary}
            />

            <div className="flex h-[calc(100vh-138px)]">
              {/* 左侧内容 */}
              <PlanSelectionContent
                plans={plans}
                selectedPlanId={selectedPlanId}
                selectedPlan={selectedPlan}
                onSelect={setSelectedPlanId}
              />

              {/* 右侧内容 */}
              {selectedPlan && priceInfo && (
                <PlanDetailsPanel
                  plan={selectedPlan}
                  priceInfo={priceInfo}
                  currentPlan={currentPlan}
                  agreed={agreed}
                  subscribing={subscribing}
                  couponCode={couponCode}
                  onAgreedChange={setAgreed}
                  onPayment={handlePayment}
                  onOpenCouponSelector={() => setCouponSelectorOpen(true)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 支付弹窗 */}
      {selectedPlan && priceInfo && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          plan={selectedPlan}
          priceInfo={priceInfo}
          couponCode={couponCode}
          onPayment={handlePaymentConfirm}
          onRecharge={handleRecharge}
        />
      )}

      {/* 充值弹窗 */}
      <RechargeDialog
        open={rechargeDialogOpen}
        onOpenChange={setRechargeDialogOpen}
        amount={rechargeAmount}
        onSuccess={handleRechargeSuccess}
      />

      {/* 优惠券选择弹窗 */}
      <CouponSelectorDialog
        open={couponSelectorOpen}
        onOpenChange={setCouponSelectorOpen}
        selectedCouponCode={couponCode}
        onSelect={handleCouponSelect}
      />
    </main>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'plan-selection',
    value: {
      path: '/plans',
      Component: PlanSelectionPage,
    },
    priority: 10,
  });
  console.log('[plan-selection] Route contributed at module load: /plans');
} catch (error) {
  console.warn('[plan-selection] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'plan-selection',
    value: {
      namespace: 'plans',
      resources: planResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[plan-selection] Failed to contribute i18n resources:', error);
}

const planSelectionPlugin = {
  id: 'plan-selection',
  name: 'Plan Selection',
  version: '1.0.0',
  component: PlanSelectionPage,
  slots: [],
};

export default planSelectionPlugin;
