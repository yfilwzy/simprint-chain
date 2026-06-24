export interface BillingPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  currency: string;
  environmentsLimit: number;
  description: string;
}

export interface Invoice {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  type: string;
  description: string;
  operator: string;
}

export interface AccountInfo {
  planName: string;
  planId: string;
  email: string;
  billingDate: string | null;
  walletBalance: number;
  giftBalance: number;
  monthlyBilling: number;
  environmentsUsed: number;
  environmentsLimit: number;
  teamMembersUsed: number;
  teamMembersLimit: number;
  proxyCount: number;
  proxyLimit: number;
  dailyCreateLimit: number;
  dailyOpenLimit: number;
  dailyCreateUsed: number;
  dailyOpenUsed: number;
}

// 后端返回的账户信息格式
export interface AccountInfoResponse {
  email: string;
  wallet_balance: number;
  gift_balance: number;
  currency: string;
  subscription: SubscriptionResponse | null;
  quota: QuotaResponse;
  monthly_billing: number;
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

export interface AutoRenewalService {
  id: string;
  serviceName: string;
  renewalPrice: number;
  currency: string;
  nextBillDate: string;
}

export interface ResourceUsage {
  name: string;
  used: number;
  limit: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  link?: string;
}

export type InvoiceStatusFilter = 'all' | 'paid' | 'pending' | 'failed';
