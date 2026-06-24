/**
 * 套餐选择 API
 */
import { post, isSuccess } from '@/lib/request';
import type {
    PlanDto,
    PlanFeatureDto,
    PlanWithFeatures,
    SubscriptionDto,
    WalletResponse,
    SubscribePlanRequest,
    SubscribePlanResponse,
    PlansResponse,
    CurrentPlanResponse,
    ReferralPlanSummary,
} from './index.types';

export * from './index.types';

// ============ API 端点 ============

export const API_ENDPOINTS = {
    PLANS: 'billing/plans',
    SUBSCRIPTION: 'billing/subscription',
    SUBSCRIPTION_SUBSCRIBE: 'billing/subscription/subscribe',
    WALLET: 'billing/wallet',
    REFERRAL_PLAN_SUMMARY: 'referral/summary-for-plan',
} as const;

// ============ API 函数 ============

/**
 * 获取套餐列表（包含特性）
 */
export async function getPlans(couponCode?: string, billingPeriod: string = 'monthly'): Promise<PlansResponse> {
    const result = await post<PlansResponse>(API_ENDPOINTS.PLANS, {
        coupon_code: couponCode,
        billing_period: billingPeriod,
    });
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取套餐列表失败');
    }
    return result.data!;
}

/**
 * 获取当前订阅
 */
export async function getCurrentSubscription(): Promise<SubscriptionDto | null> {
    const result = await post<SubscriptionDto | null>(API_ENDPOINTS.SUBSCRIPTION, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取当前订阅失败');
    }
    return result.data ?? null;
}

/**
 * 订阅套餐
 */
export async function subscribePlan(
    planUuid: string,
    billingPeriod: string = 'monthly',
    couponCode?: string,
    paymentMethod?: string
): Promise<SubscribePlanResponse> {
    const payload: SubscribePlanRequest = {
        plan_uuid: planUuid,
        billing_period: billingPeriod,
    };
    if (couponCode) {
        payload.coupon_code = couponCode;
    }
    if (paymentMethod) {
        payload.payment_method = paymentMethod;
    }

    const result = await post<SubscribePlanResponse>(API_ENDPOINTS.SUBSCRIPTION_SUBSCRIBE, payload);
    if (!isSuccess(result)) {
        throw new Error(result.message || '订阅失败');
    }
    return result.data!;
}

/**
 * 获取钱包信息
 */
export async function getWallet(): Promise<WalletResponse> {
    const result = await post<WalletResponse>(API_ENDPOINTS.WALLET, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取钱包信息失败');
    }
    return result.data!;
}

/**
 * 获取套餐页推广摘要信息
 */
export async function getReferralPlanSummary(): Promise<ReferralPlanSummary | null> {
    const result = await post<ReferralPlanSummary | null>(API_ENDPOINTS.REFERRAL_PLAN_SUMMARY, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取推广摘要失败');
    }
    return result.data ?? null;
}

