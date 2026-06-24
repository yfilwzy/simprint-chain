export interface ReferralLink {
  id: string;
  name: string;
  code: string;
  url: string;
  unlocked: boolean;
  rewardRate: number;
  discountRate: number;
  description?: string;
}

export interface ReferralStats {
  code: string;
  currentLinkId: string;
  availablePoints: number;
  pendingPoints: number;
  totalEarnedPoints: number;
  linkClicks: number;
  registeredUsers: number;
  paidUsers: number;
  last30DaysConsumption: number;
  links: ReferralLink[];
}

export interface ReferralReward {
  id: string;
  createdAt: string;
  type: 'registration' | 'subscription' | 'consumption';
  description: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  referredUser?: string;
  linkId: string;
}

export interface ReferredUser {
  id: string;
  email: string;
  registeredAt: string;
  status: 'registered' | 'paid' | 'active';
  totalConsumption: number;
  last30DaysConsumption: number;
  linkId: string;
}

export interface PromoBannerSize {
  id: string;
  width: number;
  height: number;
  label: string;
}

export type RewardStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
export type UserStatusFilter = 'all' | 'registered' | 'paid' | 'active';
export type RedeemType = 'quota' | 'feature' | 'duration';
export type ReferralTab = 'overview' | 'rewards' | 'users';
