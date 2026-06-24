/**
 * 重置密码 API 服务
 */
import { post, isSuccess } from '@/lib/request';
import type { SendCodeRequest, ResetPasswordRequest, CodeType } from './index.types';

// 导出类型
export * from './index.types';

// API 端点配置
export const API_ENDPOINTS = {
  SEND_CODE: 'users/reset-password-send-code',
  RESET_PASSWORD: 'users/reset-password',
} as const;

/**
 * 发送重置密码验证码
 */
export async function sendResetCode(
  email: string,
  type: CodeType = 'reset_password'
): Promise<void> {
  const requestData: SendCodeRequest = {
    email,
    type,
  };

  const result = await post(API_ENDPOINTS.SEND_CODE, requestData);

  if (!isSuccess(result)) {
    throw new Error(result.message || '发送验证码失败');
  }
}

/**
 * 重置密码
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const requestData: ResetPasswordRequest = {
    email,
    code,
    new_password: newPassword,
  };

  const result = await post(API_ENDPOINTS.RESET_PASSWORD, requestData);

  if (!isSuccess(result)) {
    throw new Error(result.message || '重置密码失败');
  }
}
