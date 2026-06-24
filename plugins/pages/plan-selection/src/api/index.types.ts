/**
 * 套餐选择 API 类型定义
 */

// ============ 后端 DTO 类型 ============

export interface PlanDto {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    price_per_month: number;
    price_per_year: number;
    currency: string;
    discount_monthly: number | null;
    discount_yearly: number | null;
    max_environments: number;
    max_team_members: number;
    max_proxies: number;
    max_rpa_tasks: number;
    is_recommended: boolean | null;
    sort_order: number | null;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface PlanFeatureDto {
    id: number;
    plan_uuid: string;
    feature_key: string;
    feature_name: string;
    feature_value: string | null;
    is_included: boolean | null;
    sort_order: number | null;
    created_at: string;
}

export interface PlanPriceInfo {
    original_price: number | string;
    plan_discount: number | string;
    coupon_discount: number | string;
    final_price: number | string;
    total_saved: number | string;
    billing_period: string;
}

export interface PlanWithFeatures {
    plan: PlanDto;
    features: PlanFeatureDto[];
    calculated_price?: PlanPriceInfo | null;
}

export interface SubscriptionDto {
    id: number;
    uuid: string;
    workspace_uuid: string;
    user_uuid: string;
    plan_uuid: string;
    billing_period: string;
    price: number;
    currency: string;
    started_at: string;
    expires_at: string;
    next_billing_date: string | null;
    auto_renew: boolean | null;
    status: string;
    cancelled_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface WalletResponse {
    id: number;
    user_uuid: string;
    balance: number;
    currency: string;
    frozen_amount: number;
    auto_renewal_combined: number;
    created_at: string;
    updated_at: string;
}

// 注意：WalletResponse 与 billing-center 中的 WalletResponse 相同
// 可以统一使用 billing-center 的类型定义，但为了保持模块独立性，这里也定义一份

// ============ 请求类型 ============

export interface SubscribePlanRequest {
    plan_uuid: string;
    billing_period: string;
    coupon_code?: string;
    payment_method?: string; // wallet | alipay | wechat
}

export interface SubscribePlanResponse {
    subscription_uuid: string;
}

// ============ 响应类型 ============

export interface PlansResponse {
    plans: PlanWithFeatures[];
}

export interface CurrentPlanResponse {
    data: SubscriptionDto | null;
}

// ============ 推广摘要类型 ============

export interface ReferralPlanSummary {
    referral_value_last_30_days: string | number;
    current_plan_monthly_price: string | number | null;
    coverage_ratio: string | number | null;
}

