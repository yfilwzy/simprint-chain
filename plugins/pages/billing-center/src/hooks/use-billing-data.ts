import { useEffect, useState } from 'react';
import type { AccountInfo, AutoRenewalService } from '../types';
import {
  getAccountInfo,
  getAutoRenewalServices,
  type AccountInfoResponse,
  type AutoRenewalServiceResponse,
} from '../api';

interface UseBillingDataReturn {
  accountInfo: AccountInfo | null;
  autoRenewalServices: AutoRenewalService[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 转换后端账户信息为前端格式
 */
function transformAccountInfo(data: AccountInfoResponse): AccountInfo {
  const subscription = data.subscription;
  const quota = data.quota;

  return {
    planName: subscription ? '已订阅' : '免费',
    planId: subscription?.plan_uuid || 'free',
    email: data.email,
    billingDate: subscription?.next_billing_date || null,
    walletBalance: Number(data.wallet_balance),
    giftBalance: Number(data.gift_balance),
    monthlyBilling: Number(data.monthly_billing),
    environmentsUsed: quota.used_environments,
    environmentsLimit: quota.max_environments,
    teamMembersUsed: quota.used_team_members,
    teamMembersLimit: quota.max_team_members,
    proxyCount: quota.used_proxies,
    proxyLimit: quota.max_proxies,
    dailyCreateLimit: 150, // TODO: 如果后端有这些字段，从配额中获取
    dailyOpenLimit: 500,
    dailyCreateUsed: 0,
    dailyOpenUsed: 0,
  };
}

/**
 * 转换自动续费服务
 */
function transformAutoRenewalServices(
  data: AutoRenewalServiceResponse[]
): AutoRenewalService[] {
  return data.map((item) => ({
    id: item.uuid,
    serviceName: item.service_name,
    renewalPrice: Number(item.renewal_price),
    currency: item.currency,
    nextBillDate: item.next_bill_date,
  }));
}

/**
 * 获取计费数据的 Hook
 */
export function useBillingData(): UseBillingDataReturn {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [autoRenewalServices, setAutoRenewalServices] = useState<AutoRenewalService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountData, autoRenewalData] = await Promise.all([
        getAccountInfo(),
        getAutoRenewalServices(),
      ]);

      setAccountInfo(transformAccountInfo(accountData));
      setAutoRenewalServices(transformAutoRenewalServices(autoRenewalData));
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
      setAccountInfo(null);
      setAutoRenewalServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  return {
    accountInfo,
    autoRenewalServices,
    loading,
    error,
    refresh: fetchData,
  };
}
