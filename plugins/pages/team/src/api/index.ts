/**
 * 团队管理 API
 */
import { post, isSuccess } from '@/lib/request';
import type {
  ListTeamMembersRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  RemoveMemberRequest,
  BatchRemoveMembersRequest,
  SwitchTeamRequest,
  GetTeamRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  CancelInviteRequest,
  AcceptInvitationRequest,
  RejectInvitationRequest,
  InviteResponse,
  TeamMemberListResponse,
  TeamMemberDto,
  TeamDto,
  TeamListResponse,
  TeamInvitationDto,
  CreateResponse,
  AcceptInvitationResponse,
  TeamMember,
} from './index.types';

export * from './index.types';

// ============ API 端点 ============

export const API_ENDPOINTS = {
  // 团队成员
  LIST_TEAM_MEMBERS: 'teams/members',
  INVITE_MEMBER: 'teams/invite',
  UPDATE_MEMBER_ROLE: 'teams/member/role',
  REMOVE_MEMBER: 'teams/member/remove',

  // 团队管理
  GET_MY_TEAMS: 'teams/my-teams',
  GET_TEAM: 'teams/detail',
  CREATE_TEAM: 'teams/create',
  UPDATE_TEAM: 'teams/update',
  SWITCH_TEAM: 'teams/switch',
  LEAVE_TEAM: 'teams/leave',

  // 邀请管理
  GET_PENDING_INVITATIONS: 'teams/invitations',
  CANCEL_INVITATION: 'teams/invitation/cancel',
  ACCEPT_INVITATION: 'teams/invitation/accept',
  REJECT_INVITATION: 'teams/invitation/reject',
} as const;

// ============ 数据转换 ============

/**
 * 将后端 DTO 转换为前端 TeamMember 格式
 */
function transformTeamMemberDto(dto: TeamMemberDto): TeamMember {
  // 使用 user_uuid 作为 id（因为删除成员时后端使用 user_uuid）
  const memberId = dto.user_uuid || String(dto.id);
  return {
    id: memberId,
    name: dto.name || '',
    email: dto.email || '',
    avatar: dto.avatar,
    role: (dto.role as TeamMember['role']) || 'viewer',
    status: (dto.status as TeamMember['status']) || 'active',
    joinedAt: dto.joined_at || dto.created_at,
    environmentCount: dto.environment_count || 0,
    groupCount: dto.group_count || 0,
  };
}

// ============ 团队成员 API ============

/**
 * 获取团队成员列表
 */
export async function listTeamMembers(
  request: ListTeamMembersRequest
): Promise<TeamMemberListResponse> {
  const result = await post<{
    items: TeamMemberDto[];
    total: number;
    page: number;
    page_size: number;
  }>(API_ENDPOINTS.LIST_TEAM_MEMBERS, {
    workspace_uuid: request.workspace_uuid,
    page: request.page || 1,
    page_size: request.page_size || 10,
    filters: request.filters,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取团队成员列表失败');
  }

  const data = result.data!;
  return {
    items: (data.items || []).map(transformTeamMemberDto),
    total: data.total || 0,
    page: data.page || 1,
    page_size: data.page_size || 10,
  };
}

/**
 * 邀请成员
 */
export async function inviteMember(request: InviteMemberRequest): Promise<InviteResponse> {
  const result = await post<InviteResponse>(API_ENDPOINTS.INVITE_MEMBER, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '邀请成员失败');
  }
  return result.data!;
}

/**
 * 更新成员角色
 */
export async function updateMemberRole(request: UpdateMemberRoleRequest): Promise<TeamMember> {
  const result = await post<TeamMemberDto>(API_ENDPOINTS.UPDATE_MEMBER_ROLE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新成员角色失败');
  }
  return transformTeamMemberDto(result.data!);
}

/**
 * 移除成员
 */
export async function removeMember(request: RemoveMemberRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.REMOVE_MEMBER, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '移除成员失败');
  }
}

/**
 * 批量移除成员
 */
export async function batchRemoveMembers(request: BatchRemoveMembersRequest): Promise<void> {
  // 后端可能没有批量接口，这里使用 Promise.all 调用单个接口
  const promises = request.member_uuids.map((uuid) => removeMember({ member_uuid: uuid }));
  await Promise.all(promises);
}

// ============ 团队管理 API ============

/**
 * 获取我的团队列表
 */
export async function getMyTeams(): Promise<TeamListResponse> {
  const result = await post<TeamListResponse>(API_ENDPOINTS.GET_MY_TEAMS, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取团队列表失败');
  }
  return result.data!;
}

/**
 * 获取团队详情
 */
export async function getTeamDetail(request: GetTeamRequest): Promise<TeamDto> {
  const result = await post<TeamDto>(API_ENDPOINTS.GET_TEAM, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取团队详情失败');
  }
  return result.data!;
}

/**
 * 创建团队
 */
export async function createTeam(request: CreateTeamRequest): Promise<string> {
  const result = await post<CreateResponse>(API_ENDPOINTS.CREATE_TEAM, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '创建团队失败');
  }
  return result.data!.uuid;
}

/**
 * 更新团队信息
 */
export async function updateTeam(request: UpdateTeamRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_TEAM, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新团队信息失败');
  }
}

/**
 * 切换团队
 */
export async function switchTeam(teamUuid: string): Promise<void> {
  const result = await post<SwitchTeamRequest>(API_ENDPOINTS.SWITCH_TEAM, {
    team_uuid: teamUuid,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '切换团队失败');
  }
}

/**
 * 退出团队
 */
export async function leaveTeam(): Promise<void> {
  const result = await post(API_ENDPOINTS.LEAVE_TEAM, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '退出团队失败');
  }
}

// ============ 邀请管理 API ============

/**
 * 获取待处理的邀请列表
 */
export async function getPendingInvitations(): Promise<TeamInvitationDto[]> {
  const result = await post<TeamInvitationDto[]>(API_ENDPOINTS.GET_PENDING_INVITATIONS, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取邀请列表失败');
  }
  return result.data! || [];
}

/**
 * 取消邀请
 */
export async function cancelInvitation(request: CancelInviteRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.CANCEL_INVITATION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '取消邀请失败');
  }
}

/**
 * 接受邀请
 */
export async function acceptInvitation(request: AcceptInvitationRequest): Promise<string> {
  const result = await post<AcceptInvitationResponse>(API_ENDPOINTS.ACCEPT_INVITATION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '接受邀请失败');
  }
  return result.data!.team_uuid;
}

/**
 * 拒绝邀请
 */
export async function rejectInvitation(request: RejectInvitationRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.REJECT_INVITATION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '拒绝邀请失败');
  }
}
