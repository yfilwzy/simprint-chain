/**
 * 用户相关 API
 */
import { post, isSuccess } from '@/lib/request';

const API_ENDPOINTS = {
  GET_CURRENT_USER: 'users/me',
  UPDATE_USER: 'users/update',
  UPDATE_PASSWORD: 'users/password',
  VERIFY_PASSWORD: 'users/verify-password',
} as const;

/**
 * 当前用户信息响应（与后端 UserResponse 对应）
 */
export interface CurrentUserResponse {
  uuid: string;
  id: string;
  nickname?: string;
  email: string;
  phone?: string;
  avatar_hash?: string;
  avatar_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
  current_team?: { uuid: string; name: string; [key: string]: unknown };
  current_workspace?: { uuid: string; name: string; [key: string]: unknown };
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<CurrentUserResponse | null> {
  const result = await post<CurrentUserResponse>(API_ENDPOINTS.GET_CURRENT_USER, {});

  if (!isSuccess(result) || !result.data) {
    return null;
  }

  return result.data;
}

/**
 * 更新用户信息请求
 */
export interface UpdateUserRequest {
  nickname?: string;
  phone?: string;
  email?: string;
}

/**
 * 更新当前用户信息
 */
export async function updateCurrentUser(
  payload: UpdateUserRequest
): Promise<{ ok: boolean; message?: string }> {
  const result = await post(API_ENDPOINTS.UPDATE_USER, payload);

  if (!isSuccess(result)) {
    return { ok: false, message: result.message || '更新失败' };
  }

  return { ok: true };
}

/**
 * 修改密码请求
 */
export interface UpdatePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

/**
 * 修改密码
 */
export async function updatePassword(
  payload: UpdatePasswordRequest
): Promise<{ ok: boolean; message?: string }> {
  const result = await post(API_ENDPOINTS.UPDATE_PASSWORD, payload);

  if (!isSuccess(result)) {
    return { ok: false, message: result.message || '修改密码失败' };
  }

  return { ok: true };
}

/**
 * 校验当前用户密码
 */
export async function verifyCurrentUserPassword(
  payload: VerifyPasswordRequest
): Promise<{ ok: boolean; valid: boolean; message?: string }> {
  const result = await post<{ valid: boolean }>(API_ENDPOINTS.VERIFY_PASSWORD, payload);

  if (!isSuccess(result) || !result.data) {
    return { ok: false, valid: false, message: result.message || '校验失败' };
  }

  return { ok: true, valid: result.data.valid };
}
