/**
 * 费用中心 API
 */
import { post, isSuccess } from '@/lib/request';
import type {
    AccountInfoResponse,
    WalletResponse,
    TransactionsParams,
    TransactionsResponse,
    InvoicesParams,
    InvoicesResponse,
    AutoRenewalServiceResponse,
    QuotaResponse,
    SubscriptionResponse,
} from './index.types';

export * from './index.types';

// ============ API 端点 ============

export const API_ENDPOINTS = {
    ACCOUNT_INFO: 'billing/account-info',
    WALLET: 'billing/wallet',
    WALLET_TRANSACTIONS: 'billing/wallet/transactions',
    INVOICES: 'billing/invoices',
    AUTO_RENEWAL_SERVICES: 'billing/auto-renewal-services',
    QUOTA: 'billing/quota',
    SUBSCRIPTION: 'billing/subscription',
    COUPONS_AVAILABLE: 'billing/coupons/available',
    COUPONS_MY: 'billing/coupons/my-coupons',
} as const;

// ============ API 函数 ============

/**
 * 获取账户信息
 */
export async function getAccountInfo(): Promise<AccountInfoResponse> {
    const result = await post<AccountInfoResponse>(API_ENDPOINTS.ACCOUNT_INFO, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取账户信息失败');
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
 * 获取交易记录
 */
export async function getTransactions(params: TransactionsParams): Promise<TransactionsResponse> {
    const result = await post<TransactionsResponse>(API_ENDPOINTS.WALLET_TRANSACTIONS, params);
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取交易记录失败');
    }
    return result.data!;
}

/**
 * 获取发票列表
 */
export async function getInvoices(params: InvoicesParams): Promise<InvoicesResponse> {
    const result = await post<InvoicesResponse>(API_ENDPOINTS.INVOICES, params);
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取发票列表失败');
    }
    return result.data!;
}

/**
 * 获取自动续费服务列表
 */
export async function getAutoRenewalServices(): Promise<AutoRenewalServiceResponse[]> {
    const result = await post<AutoRenewalServiceResponse[]>(API_ENDPOINTS.AUTO_RENEWAL_SERVICES, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取自动续费服务列表失败');
    }
    return result.data || [];
}

/**
 * 获取工作空间配额
 */
export async function getQuota(): Promise<QuotaResponse> {
    const result = await post<QuotaResponse>(API_ENDPOINTS.QUOTA, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取配额信息失败');
    }
    return result.data!;
}

/**
 * 获取当前订阅
 */
export async function getCurrentSubscription(): Promise<SubscriptionResponse | null> {
    const result = await post<SubscriptionResponse | null>(API_ENDPOINTS.SUBSCRIPTION, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取订阅信息失败');
    }
    return result.data ?? null;
}

/**
 * 获取可用优惠券列表
 */
export async function getAvailableCoupons(): Promise<UserCoupon[]> {
    const result = await post<UserCoupon[]>(API_ENDPOINTS.COUPONS_AVAILABLE, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取优惠券列表失败');
    }
    return result.data || [];
}

/**
 * 获取我的优惠券列表
 */
export async function getMyCoupons(params: {
    pagination: { page: number; page_size: number };
    status?: string;
}): Promise<{ items: UserCoupon[]; total: number; page: number; page_size: number }> {
    const result = await post<{ items: UserCoupon[]; total: number; page: number; page_size: number }>(
        API_ENDPOINTS.COUPONS_MY,
        params
    );
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取优惠券列表失败');
    }
    return result.data || { items: [], total: 0, page: 1, page_size: 10 };
}
