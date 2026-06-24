/**
 * 费用中心 API 类型定义
 */

// ============ 后端 DTO 类型 ============

export interface AccountInfoResponse {
    email: string;
    wallet_balance: number;
    gift_balance: number;
    currency: string;
    subscription: SubscriptionResponse | null;
    quota: QuotaResponse;
    monthly_billing: number;
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

export interface TransactionItem {
    id: number;
    uuid: string;
    user_uuid: string;
    transaction_type: string;
    amount: number;
    currency: string;
    balance_before: number;
    balance_after: number;
    description: string | null;
    order_uuid: string | null;
    status: string;
    created_at: string;
}

export interface InvoiceItem {
    id: number;
    uuid: string;
    user_uuid: string;
    invoice_number: string;
    amount: number;
    currency: string;
    subscription_uuid: string | null;
    order_uuid: string | null;
    invoice_type: string;
    status: string;
    issued_at: string | null;
    due_at: string | null;
    paid_at: string | null;
    invoice_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface AutoRenewalServiceResponse {
    id: number;
    uuid: string;
    user_uuid: string;
    service_type: string;
    service_uuid: string | null;
    service_name: string;
    renewal_price: number;
    currency: string;
    next_bill_date: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface QuotaResponse {
    workspace_uuid: string;
    max_environments: number;
    used_environments: number;
    max_team_members: number;
    used_team_members: number;
    max_proxies: number;
    used_proxies: number;
    max_rpa_tasks: number;
    used_rpa_tasks: number;
    created_at: string;
    updated_at: string;
}

export interface SubscriptionResponse {
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

// ============ 请求类型 ============

export interface TransactionsParams {
    pagination: {
        page: number;
        page_size: number;
    };
    transaction_type?: string;
}

export interface InvoicesParams {
    pagination: {
        page: number;
        page_size: number;
    };
    status?: string;
}

// ============ 响应类型 ============

export interface TransactionsResponse {
    items: TransactionItem[];
    total: number;
    page: number;
    page_size: number;
}

export interface InvoicesResponse {
    items: InvoiceItem[];
    total: number;
    page: number;
    page_size: number;
}

// ============ 优惠券类型 ============

export interface UserCoupon {
    id: number;
    user_uuid: string;
    coupon_uuid: string;
    status: 'unused' | 'used' | 'expired';
    issued_at: string;
    used_at: string | null;
    expires_at: string | null;
    // 优惠券详细信息（从关联查询获取）
    code: string;
    name?: string | null;
    description?: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number | string; // 可能是字符串（从 Decimal 序列化）
    min_amount?: number | string | null;
    max_discount?: number | string | null;
}

