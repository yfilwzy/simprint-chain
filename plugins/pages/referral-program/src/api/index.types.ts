/**
 * 推广计划 API 类型定义
 */

import type {
  ReferralLink,
  ReferralReward,
  ReferredUser,
  ReferralStats,
} from '../types';

// ============ 后端 DTO / 请求 / 响应类型 ============

/**
 * 推广看板聚合响应（后端原始结构，尽量贴合 Rust `ReferralDashboardResponse`）
 */
export interface ReferralDashboardDto {
  stats: {
    total_referrals: number;
    paid_referrals: number;
    total_consumption: string;
    last_30_days_consumption: string;
    total_rewards: number;
    available_points: number;
    // 当前层级等字段前端暂不直接使用，保留以便后续扩展
    current_tier?: unknown;
    next_tier?: unknown;
    upgrade_progress?: number;
  };
  links: Array<{
    uuid: string;
    code: string;
    url?: string | null;
    unlocked?: boolean | null;
    reward_rate?: string | number | null;
    discount_rate?: string | number | null;
    // 后端目前没有 name / description，预留字段
    name?: string | null;
    description?: string | null;
  }>;
  current_link: {
    uuid: string;
    code: string;
    url?: string | null;
    unlocked?: boolean | null;
    reward_rate?: string | number | null;
    discount_rate?: string | number | null;
    name?: string | null;
    description?: string | null;
  } | null;
  tiers: unknown[];
  points: {
    available_points: number;
    pending_points: number;
    total_rewards: number;
  };
}

/** 看板积分摘要（前端展示用） */
export interface ReferralPointsSummary {
  availablePoints: number;
  pendingPoints: number;
  totalRewards: number;
}

/** 看板聚合（前端展示用） */
export interface ReferralDashboard {
  stats: ReferralStats;
  links: ReferralLink[];
  currentLink: ReferralLink | null;
  points: ReferralPointsSummary;
}

/** 查询奖励记录请求（对应 `ListReferralRewardsRequest`） */
export interface ListReferralRewardsRequest {
  page: number;
  page_size: number;
  keyword?: string | null;
  reward_type?: string | null;
  status?: string | null;
}

/** 奖励记录列表响应（后端原始结构） */
export interface ReferralRewardsListResponse {
  items: ReferralReward[];
  total: number;
  page: number;
  page_size: number;
}

/** 查询被邀请用户请求（对应 `ListReferredUsersRequest`） */
export interface ListReferredUsersRequest {
  page: number;
  page_size: number;
  keyword?: string | null;
  status?: string | null;
}

/** 被邀请用户列表响应（后端原始结构） */
export interface ReferredUsersListResponse {
  items: ReferredUser[];
  total: number;
  page: number;
  page_size: number;
}

/** 切换链接请求（对应 `SwitchReferralLinkRequest`） */
export interface SwitchReferralLinkRequest {
  link_uuid: string;
}

/** 兑换积分请求（当前前端约定：points + type） */
export interface RedeemPointsRequest {
  points: number;
  type: 'quota' | 'feature' | 'duration';
}

