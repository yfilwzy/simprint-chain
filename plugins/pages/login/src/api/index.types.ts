/**
 * 登录 API 类型定义
 */

/**
 * 登录类型
 */
export type LoginType = 'basic' | 'remember';

/**
 * 基础登录数据
 */
export interface BasicLoginData {
  email: string;
  password: string;
}

/**
 * 记住密码登录数据
 */
export interface RememberLoginData {
  email: string;
  refresh_token: string;
}

/**
 * 登录请求载荷
 */
export interface LoginPayload {
  type: LoginType;
  data: BasicLoginData | RememberLoginData;
}

/**
 * 团队信息
 */
export interface TeamInfoResponse {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  owner_uuid: string;
  avatar_hash?: string;
  max_members: number;
  max_environments: number;
  max_proxies: number;
  default_proxy_uuid?: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 工作空间信息
 */
export interface WorkspaceInfoResponse {
  uuid: string;
  name: string;
  owner_uuid: string;
  workspace_type: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * 用户信息
 */
export interface UserInfoResponse {
  uuid?: string;
  id?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  avatar_hash?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  current_team?: TeamInfoResponse;
  current_workspace?: WorkspaceInfoResponse;
}

/**
 * 登录响应数据
 */
export interface LoginResponseData {
  access_token: string;
  refresh_token: string;
  user_info?: UserInfoResponse;
}
