/**
 * 推广计划 API 实现
 *
 * - 完全参考 account-center 的分层结构
 * - 只暴露「业务模型」和调用函数，隐藏 DTO 细节
 */

import { post, isSuccess } from '@/lib/request';
import { API_ENDPOINTS, ITEMS_PER_PAGE } from '../constants';

import type {
  ReferralLink,
  ReferralReward,
  ReferredUser,
  ReferralStats,
} from '../types';

import type {
  ReferralDashboardDto,
  ReferralDashboard,
  ReferralPointsSummary,
  ListReferralRewardsRequest,
  ReferralRewardsListResponse,
  ListReferredUsersRequest,
  ReferredUsersListResponse,
  SwitchReferralLinkRequest,
  RedeemPointsRequest,
} from './index.types';

// ============ DTO → 前端模型转换 ============

function transformReferralLinkDto(
  dto: {
    uuid: string;
    code: string;
    url?: string | null;
    unlocked?: boolean | null;
    reward_rate?: string | number | null;
    discount_rate?: string | number | null;
    name?: string | null;
    description?: string | null;
  },
  index: number,
): ReferralLink {
  // 如果后端未返回完整 URL，则在前端根据邀请码 code 构造一个注册页链接
  // 目前注册路由为 /auth/register，推荐码字段为 referral_code
  const fallbackUrl =
    (typeof window !== 'undefined'
      ? `${window.location.origin}/auth/register?referral_code=${encodeURIComponent(dto.code)}`
      : '') || '';

  return {
    id: dto.uuid,
    name: dto.name?.trim() || '',
    code: dto.code,
    url: dto.url || fallbackUrl,
    unlocked: Boolean(dto.unlocked),
    rewardRate: Number(dto.reward_rate ?? 0),
    discountRate: Number(dto.discount_rate ?? 0),
    description: dto.description || undefined,
  };
}

function transformDashboardDtoToView(dto: ReferralDashboardDto): ReferralDashboard {
  const links: ReferralLink[] = dto.links.map((link, index) =>
    transformReferralLinkDto(link, index),
  );

  const currentLink: ReferralLink | null = dto.current_link
    ? transformReferralLinkDto(dto.current_link, 0)
    : null;

  const points: ReferralPointsSummary = {
    availablePoints: dto.points.available_points,
    pendingPoints: dto.points.pending_points,
    totalRewards: dto.points.total_rewards,
  };

  // 这里的统计字段目前后端还未完全对齐前端的 mock 结构，
  // 先做一个相对合理的映射，后续可以根据实际接口再调整。
  const stats: ReferralStats = {
    code: currentLink?.code || '',
    currentLinkId: currentLink?.id || '',
    availablePoints: points.availablePoints,
    pendingPoints: points.pendingPoints,
    totalEarnedPoints: points.totalRewards,
    // 下列字段暂时从 dto.stats 推导或兜底为 0
    linkClicks: dto.stats.total_referrals || 0,
    registeredUsers: dto.stats.total_referrals || 0,
    paidUsers: dto.stats.paid_referrals || 0,
    last30DaysConsumption: Number(dto.stats.last_30_days_consumption || 0),
    links,
  };

  return {
    stats,
    links,
    currentLink,
    points,
  };
}

// ============ 实际接口调用 ============

/**
 * 获取推广看板聚合数据
 */
export async function getReferralDashboard(): Promise<ReferralDashboard> {
  const result = await post<ReferralDashboardDto>(API_ENDPOINTS.DASHBOARD, {});

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取推广看板失败');
  }

  if (!result.data) {
    throw new Error('推广看板响应数据为空');
  }

  return transformDashboardDtoToView(result.data);
}

/**
 * 查询奖励记录列表
 */
export async function listReferralRewards(
  params: Omit<ListReferralRewardsRequest, 'page_size'>,
): Promise<ReferralRewardsListResponse> {
  const payload: ListReferralRewardsRequest = {
    page: params.page,
    page_size: ITEMS_PER_PAGE,
    keyword: params.keyword ?? null,
    reward_type: params.reward_type ?? null,
    status: params.status ?? null,
  };

  const result = await post<ReferralRewardsListResponse>(
    API_ENDPOINTS.REWARDS,
    payload,
  );

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取推广奖励列表失败');
  }

  return (
    result.data || {
      items: [],
      total: 0,
      page: payload.page,
      page_size: payload.page_size,
    }
  );
}

/**
 * 查询被邀请用户列表
 */
export async function listReferredUsers(
  params: Omit<ListReferredUsersRequest, 'page_size'>,
): Promise<ReferredUsersListResponse> {
  const payload: ListReferredUsersRequest = {
    page: params.page,
    page_size: ITEMS_PER_PAGE,
    keyword: params.keyword ?? null,
    status: params.status ?? null,
  };

  const result = await post<ReferredUsersListResponse>(
    API_ENDPOINTS.REFERRED_USERS,
    payload,
  );

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取被邀请用户列表失败');
  }

  return (
    result.data || {
      items: [],
      total: 0,
      page: payload.page,
      page_size: payload.page_size,
    }
  );
}

/**
 * 切换当前推广链接
 */
export async function switchReferralLink(
  payload: SwitchReferralLinkRequest,
): Promise<void> {
  const result = await post(API_ENDPOINTS.SWITCH_LINK, payload);
  if (!isSuccess(result)) {
    throw new Error(result.message || '切换推广链接失败');
  }
}

/**
 * 兑换推广积分
 */
export async function redeemReferralPoints(
  payload: RedeemPointsRequest,
): Promise<void> {
  const result = await post(API_ENDPOINTS.REDEEM, payload);
  if (!isSuccess(result)) {
    throw new Error(result.message || '兑换推广积分失败');
  }
}

// 类型再导出，方便外部直接从 ../api 引入
export type {
  ReferralDashboard,
  ReferralPointsSummary,
  ListReferralRewardsRequest,
  ReferralRewardsListResponse,
  ListReferredUsersRequest,
  ReferredUsersListResponse,
  SwitchReferralLinkRequest,
  RedeemPointsRequest,
} from './index.types';

