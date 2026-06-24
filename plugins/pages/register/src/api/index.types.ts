/**
 * 注册 API 类型定义
 */

/**
 * 验证码类型
 */
export type CodeType = 'register' | 'reset_password';

/**
 * 发送验证码请求
 */
export interface SendCodeRequest {
  email: string;
  type: CodeType;
}

/**
 * 注册请求载荷（发送给 Tauri 命令）
 */
export interface RegisterPayload {
  email: string;
  password: string;
  code: string;
  referral_code?: string; // 邀请码（可选）
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
 * 用户信息响应
 */
export interface UserInfoResponse {
  uuid: string;
  id: string;
  nickname?: string;
  email?: string;
  phone?: string;
  avatar_hash?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  current_team?: TeamInfoResponse;
}

/**
 * 注册响应数据
 */
export interface RegisterResponseData {
  access_token: string;
  refresh_token: string;
  user_info?: UserInfoResponse;
}
